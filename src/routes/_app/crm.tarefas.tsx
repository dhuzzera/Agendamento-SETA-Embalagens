import { createFileRoute } from "@tanstack/react-router";
import { CrmTasks } from "@/features/crm/CrmTasks";

export const Route = createFileRoute("/_app/crm/tarefas")({
  component: CrmTasks,
});
