import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  GitBranch,
  Clock,
  Mail,
  Zap,
  CheckSquare,
  ArrowRight,
  Plus,
  Save,
  Trash2,
  Tag,
  Users,
  Handshake,
  Bell,
  Merge,
  CircleStop,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Node Types ─────────────────────────────────────────────────────────────

type NodeData = {
  label: string;
  type: string;
  config?: Record<string, string>;
};

function TriggerNode({ data }: { data: NodeData }) {
  return (
    <div className="rounded-lg border-2 border-green-500 bg-green-50 px-4 py-3 shadow-md dark:bg-green-950/50 min-w-[180px]">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-green-600" />
        <span className="text-xs font-bold uppercase text-green-700 dark:text-green-400">Trigger</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{data.label}</p>
      {data.config?.description && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{data.config.description}</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}

function ConditionNode({ data }: { data: NodeData }) {
  return (
    <div className="rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-3 shadow-md dark:bg-blue-950/50 min-w-[200px]">
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-bold uppercase text-blue-700 dark:text-blue-400">Condição</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{data.label}</p>
      {data.config?.field && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{data.config.field}: {data.config.value}</p>
      )}
      <Handle type="source" position={Position.Right} id="yes" className="!bg-green-500 !w-3 !h-3 !top-[35%]" />
      <Handle type="source" position={Position.Right} id="no" className="!bg-red-500 !w-3 !h-3 !top-[65%]" />
      <span className="absolute right-[-30px] top-[30%] text-[9px] font-bold text-green-600">SIM</span>
      <span className="absolute right-[-30px] top-[60%] text-[9px] font-bold text-red-600">NÃO</span>
    </div>
  );
}

function WaitNode({ data }: { data: NodeData }) {
  return (
    <div className="rounded-lg border-2 border-yellow-500 bg-yellow-50 px-4 py-3 shadow-md dark:bg-yellow-950/50 min-w-[160px]">
      <Handle type="target" position={Position.Left} className="!bg-yellow-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-yellow-600" />
        <span className="text-xs font-bold uppercase text-yellow-700 dark:text-yellow-400">Espera</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{data.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-yellow-500 !w-3 !h-3" />
    </div>
  );
}

function ActionNode({ data }: { data: NodeData }) {
  const iconMap: Record<string, React.ReactNode> = {
    send_email: <Mail className="h-4 w-4 text-purple-600" />,
    create_task: <CheckSquare className="h-4 w-4 text-purple-600" />,
    add_tag: <Tag className="h-4 w-4 text-purple-600" />,
    move_stage: <ArrowRight className="h-4 w-4 text-purple-600" />,
    notify: <Bell className="h-4 w-4 text-purple-600" />,
    create_deal: <Handshake className="h-4 w-4 text-purple-600" />,
    mark_opportunity: <Zap className="h-4 w-4 text-purple-600" />,
  };

  return (
    <div className="rounded-lg border-2 border-purple-500 bg-purple-50 px-4 py-3 shadow-md dark:bg-purple-950/50 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        {iconMap[data.config?.action ?? ""] ?? <Zap className="h-4 w-4 text-purple-600" />}
        <span className="text-xs font-bold uppercase text-purple-700 dark:text-purple-400">Ação</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{data.label}</p>
      {data.config?.description && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{data.config.description}</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}

function MergeNode({ data }: { data: NodeData }) {
  return (
    <div className="rounded-lg border-2 border-gray-400 bg-gray-50 px-4 py-3 shadow-md dark:bg-gray-800 min-w-[140px]">
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <Merge className="h-4 w-4 text-gray-600" />
        <span className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Unir</span>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{data.label}</p>
      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-3 !h-3" />
    </div>
  );
}

function EndNode({ data }: { data: NodeData }) {
  return (
    <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 shadow-md dark:bg-red-950/50 min-w-[120px]">
      <Handle type="target" position={Position.Left} className="!bg-red-500 !w-3 !h-3" />
      <div className="flex items-center gap-2">
        <CircleStop className="h-4 w-4 text-red-500" />
        <span className="text-xs font-bold uppercase text-red-600 dark:text-red-400">Fim</span>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  wait: WaitNode,
  action: ActionNode,
  merge: MergeNode,
  end: EndNode,
};

// ─── Node Templates ─────────────────────────────────────────────────────────

const NODE_TEMPLATES = [
  { type: "trigger", label: "Lead converteu", icon: Play, color: "text-green-600", data: { label: "Lead converteu", type: "trigger", config: { trigger: "new_lead", description: "Quando um novo lead entra" } } },
  { type: "trigger", label: "Mudou estágio", icon: Play, color: "text-green-600", data: { label: "Mudou estágio", type: "trigger", config: { trigger: "stage_change", description: "Quando deal muda de estágio" } } },
  { type: "trigger", label: "Reunião agendada", icon: Play, color: "text-green-600", data: { label: "Reunião agendada", type: "trigger", config: { trigger: "appointment_created", description: "Quando uma reunião é agendada" } } },
  { type: "condition", label: "Dividir por segmentação", icon: GitBranch, color: "text-blue-600", data: { label: "Dividir por segmentação", type: "condition", config: { field: "region", value: "" } } },
  { type: "condition", label: "Dividir por tag", icon: GitBranch, color: "text-blue-600", data: { label: "Dividir por tag", type: "condition", config: { field: "tag", value: "" } } },
  { type: "condition", label: "Dividir por UF", icon: GitBranch, color: "text-blue-600", data: { label: "Dividir por UF", type: "condition", config: { field: "state", value: "" } } },
  { type: "wait", label: "Espera 1 dia", icon: Clock, color: "text-yellow-600", data: { label: "Espera 1 dia", type: "wait", config: { days: "1", hours: "0" } } },
  { type: "wait", label: "Espera 3 dias", icon: Clock, color: "text-yellow-600", data: { label: "Espera 3 dias", type: "wait", config: { days: "3", hours: "0" } } },
  { type: "wait", label: "Espera 7 dias", icon: Clock, color: "text-yellow-600", data: { label: "Espera 7 dias", type: "wait", config: { days: "7", hours: "0" } } },
  { type: "action", label: "Enviar e-mail", icon: Mail, color: "text-purple-600", data: { label: "Enviar e-mail", type: "action", config: { action: "send_email", description: "Envia e-mail para o lead" } } },
  { type: "action", label: "Criar tarefa", icon: CheckSquare, color: "text-purple-600", data: { label: "Criar tarefa", type: "action", config: { action: "create_task", description: "Cria tarefa para o responsável" } } },
  { type: "action", label: "Adicionar tag", icon: Tag, color: "text-purple-600", data: { label: "Adicionar tag", type: "action", config: { action: "add_tag", description: "" } } },
  { type: "action", label: "Mover estágio", icon: ArrowRight, color: "text-purple-600", data: { label: "Mover estágio", type: "action", config: { action: "move_stage", description: "" } } },
  { type: "action", label: "Notificar responsável", icon: Bell, color: "text-purple-600", data: { label: "Notificar responsável", type: "action", config: { action: "notify", description: "" } } },
  { type: "action", label: "Criar negociação no CRM", icon: Handshake, color: "text-purple-600", data: { label: "Criar negociação no CRM", type: "action", config: { action: "create_deal", description: "Funil Inbound, etapa Leads de Entrada" } } },
  { type: "action", label: "Marcar Oportunidade", icon: Zap, color: "text-purple-600", data: { label: "Marcar Oportunidade", type: "action", config: { action: "mark_opportunity", description: "" } } },
  { type: "merge", label: "Unir caminho", icon: Merge, color: "text-gray-600", data: { label: "Unir caminho", type: "merge", config: {} } },
  { type: "end", label: "Fim do fluxo", icon: CircleStop, color: "text-red-500", data: { label: "Fim", type: "end", config: {} } },
];

// ─── Main Component ─────────────────────────────────────────────────────────

type Props = {
  automationId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave: (nodes: Node[], edges: Edge[]) => void;
  onClose: () => void;
};

export function AutomationFlowEditor({ automationId, initialNodes, initialEdges, onSave, onClose }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const addNode = (template: (typeof NODE_TEMPLATES)[number]) => {
    const id = `node_${Date.now()}`;
    const newNode: Node = {
      id,
      type: template.type,
      position: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 300 },
      data: { ...template.data },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const handleSave = () => {
    onSave(nodes, edges);
    toast.success("Fluxo salvo!");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold">Editor de Automação</h2>
          {selectedNode && (
            <Button size="sm" variant="destructive" onClick={deleteSelected}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir nó
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Sair do editor
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Node palette */}
        <div className="w-64 shrink-0 overflow-y-auto border-r bg-muted/20 p-3">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Arraste para adicionar
          </p>
          <div className="space-y-1.5">
            {NODE_TEMPLATES.map((tpl, i) => {
              const Icon = tpl.icon;
              return (
                <button
                  key={i}
                  onClick={() => addNode(tpl)}
                  className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent hover:shadow-sm"
                >
                  <Icon className={cn("h-3.5 w-3.5", tpl.color)} />
                  {tpl.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node)}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted/10"
          >
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              className="!bg-card !border-border"
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
