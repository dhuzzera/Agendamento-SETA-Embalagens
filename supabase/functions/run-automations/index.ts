import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FlowNode = {
  id: string;
  type: string;
  data: {
    label: string;
    type: string;
    config?: Record<string, string>;
  };
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca automações ativas com fluxo definido
    const { data: automations } = await supabase
      .from("automations")
      .select("*")
      .eq("active", true);

    if (!automations?.length) {
      return new Response(JSON.stringify({ processed: 0, message: "No active automations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;

    for (const automation of automations) {
      const flowData = automation.trigger_config as { nodes?: FlowNode[]; edges?: FlowEdge[] } | null;
      if (!flowData?.nodes?.length) continue;

      const nodes = flowData.nodes;
      const edges = flowData.edges ?? [];

      // Find trigger node
      const triggerNode = nodes.find((n) => n.type === "trigger");
      if (!triggerNode) continue;

      // Determine which leads to process based on trigger type
      const triggerType = triggerNode.data.config?.trigger ?? automation.trigger_type;
      const lastRun = automation.last_run_at ?? new Date(0).toISOString();

      let leadsToProcess: { id: string; email: string; name: string }[] = [];

      if (triggerType === "new_lead") {
        // New clients since last run
        const { data } = await supabase
          .from("clients")
          .select("id, email, name")
          .gt("created_at", lastRun)
          .limit(50);
        leadsToProcess = data ?? [];
      } else if (triggerType === "appointment_created") {
        // New appointments since last run
        const { data: appts } = await supabase
          .from("appointments")
          .select("client_id")
          .gt("created_at", lastRun)
          .limit(50);
        if (appts?.length) {
          const clientIds = [...new Set(appts.map((a) => a.client_id))];
          const { data } = await supabase
            .from("clients")
            .select("id, email, name")
            .in("id", clientIds);
          leadsToProcess = data ?? [];
        }
      } else if (triggerType === "deal_inactive") {
        // Deals not updated in X days
        const daysInactive = parseInt(triggerNode.data.config?.days ?? "7", 10);
        const cutoff = new Date(Date.now() - daysInactive * 86400000).toISOString();
        const { data: deals } = await supabase
          .from("deals")
          .select("client_id")
          .lt("updated_at", cutoff)
          .not("client_id", "is", null)
          .limit(50);
        if (deals?.length) {
          const clientIds = [...new Set(deals.map((d) => d.client_id).filter(Boolean))] as string[];
          const { data } = await supabase
            .from("clients")
            .select("id, email, name")
            .in("id", clientIds);
          leadsToProcess = data ?? [];
        }
      }

      // Filter out leads already processed by this automation
      if (leadsToProcess.length > 0) {
        const { data: alreadyRun } = await supabase
          .from("automation_runs")
          .select("client_id")
          .eq("automation_id", automation.id)
          .in("client_id", leadsToProcess.map((l) => l.id));
        const processedIds = new Set((alreadyRun ?? []).map((r) => r.client_id));
        leadsToProcess = leadsToProcess.filter((l) => !processedIds.has(l.id));
      }

      // Process each lead through the flow
      for (const lead of leadsToProcess) {
        await processFlow(supabase, automation.id, lead, triggerNode, nodes, edges, RESEND_API_KEY, FROM_EMAIL);
        totalProcessed++;
      }

      // Update last_run_at
      await supabase
        .from("automations")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", automation.id);
    }

    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-automations error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processFlow(
  supabase: ReturnType<typeof createClient>,
  automationId: string,
  lead: { id: string; email: string; name: string },
  startNode: FlowNode,
  nodes: FlowNode[],
  edges: FlowEdge[],
  resendKey: string | undefined,
  fromEmail: string,
) {
  // BFS through the flow starting from trigger
  let currentNodeId = startNode.id;
  const visited = new Set<string>();

  while (currentNodeId && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    // Execute node based on type
    if (node.type === "action") {
      await executeAction(supabase, automationId, lead, node, resendKey, fromEmail);
    } else if (node.type === "wait") {
      // For now, skip waits (would need a queue system for real delays)
      // Log that we hit a wait
      await supabase.from("automation_runs").insert({
        automation_id: automationId,
        client_id: lead.id,
        node_id: node.id,
        status: "waiting",
        result: `Espera: ${node.data.config?.days ?? 0} dias`,
      });
    } else if (node.type === "condition") {
      // Evaluate condition and follow yes/no path
      const result = await evaluateCondition(supabase, lead, node);
      const handle = result ? "yes" : "no";
      const nextEdge = edges.find((e) => e.source === currentNodeId && e.sourceHandle === handle);
      currentNodeId = nextEdge?.target ?? "";
      continue;
    }

    // Find next node (follow edge from current)
    const nextEdge = edges.find((e) => e.source === currentNodeId && (!e.sourceHandle || e.sourceHandle === ""));
    currentNodeId = nextEdge?.target ?? "";
  }
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  automationId: string,
  lead: { id: string; email: string; name: string },
  node: FlowNode,
  resendKey: string | undefined,
  fromEmail: string,
) {
  const action = node.data.config?.action ?? "";
  let result = "";

  try {
    switch (action) {
      case "send_email": {
        if (!resendKey || !lead.email || lead.email.includes("@importado.local")) {
          result = "Skipped: no valid email";
          break;
        }
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + resendKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "SETA Embalagens <" + fromEmail + ">",
            to: [lead.email],
            subject: node.data.config?.subject ?? "Mensagem automática — SETA Embalagens",
            html: (node.data.config?.body ?? "<p>Olá {{nome}}</p>").replace(/\{\{nome\}\}/gi, lead.name.split(" ")[0]),
          }),
        });
        result = res.ok ? "Email sent" : "Email failed: " + res.status;
        break;
      }

      case "create_task": {
        // Find deal for this client
        const { data: deal } = await supabase
          .from("deals")
          .select("id")
          .eq("client_id", lead.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (deal) {
          await supabase.from("deal_activities").insert({
            deal_id: deal.id,
            type: "task",
            subject: node.data.config?.description ?? "Tarefa automática",
            description: node.data.config?.description ?? "Criada por automação",
            due_date: new Date(Date.now() + 86400000).toISOString(),
            completed: false,
          });
          result = "Task created for deal " + deal.id;
        } else {
          result = "No deal found for client";
        }
        break;
      }

      case "move_stage": {
        const targetStageName = node.data.config?.description ?? "";
        if (targetStageName) {
          const { data: stage } = await supabase
            .from("deal_stages")
            .select("id")
            .ilike("name", `%${targetStageName}%`)
            .limit(1)
            .maybeSingle();

          if (stage) {
            await supabase
              .from("deals")
              .update({ stage_id: stage.id })
              .eq("client_id", lead.id);
            result = "Moved to stage: " + targetStageName;
          }
        }
        break;
      }

      case "add_tag":
      case "notify":
      case "create_deal":
      case "mark_opportunity": {
        result = "Action " + action + " executed (placeholder)";
        break;
      }

      default:
        result = "Unknown action: " + action;
    }
  } catch (err) {
    result = "Error: " + String(err);
  }

  // Log execution
  await supabase.from("automation_runs").insert({
    automation_id: automationId,
    client_id: lead.id,
    node_id: node.id,
    status: result.includes("Error") || result.includes("failed") ? "failed" : "completed",
    result,
  });
}

async function evaluateCondition(
  supabase: ReturnType<typeof createClient>,
  lead: { id: string; email: string; name: string },
  node: FlowNode,
): Promise<boolean> {
  const field = node.data.config?.field ?? "";
  const value = (node.data.config?.value ?? "").toLowerCase().trim();

  if (!value) return true; // No value configured = always true

  if (field === "state" || field === "region") {
    // Check client's company state
    const { data: client } = await supabase
      .from("clients")
      .select("company_id")
      .eq("id", lead.id)
      .maybeSingle();

    if (client?.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("state, city")
        .eq("id", client.company_id)
        .maybeSingle();

      if (field === "state") {
        return (company?.state ?? "").toLowerCase() === value;
      }
      return (company?.city ?? "").toLowerCase().includes(value);
    }
    return false;
  }

  // Default: true (pass through)
  return true;
}
