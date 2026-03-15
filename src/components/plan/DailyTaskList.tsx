import { TaskItem } from "./TaskItem";
import { Tables } from "@/integrations/supabase/types";

type PlanTask = Tables<"plan_tasks">;
type PlanBlock = Tables<"plan_blocks">;

interface PillarInfo {
  id: string;
  name: string;
}

interface DailyTaskListProps {
  blocks: PlanBlock[];
  tasks: PlanTask[];
  pillars: PillarInfo[];
  onToggleTask: (taskId: string, completed: boolean) => void;
}

/** Primary task list grouped by pillar. Incomplete tasks first, completed at bottom. */
export const DailyTaskList = ({ blocks, tasks, pillars, onToggleTask }: DailyTaskListProps) => {
  // Build a pillar name lookup
  const pillarNames = new Map(pillars.map((p) => [p.id, p.name]));

  // Group tasks by pillar via their parent plan_block
  const blockPillarMap = new Map(blocks.map((b) => [b.id, b.pillar_id]));

  const pillarGroups = new Map<string, { name: string; blockTitle: string; tasks: PlanTask[] }>();

  for (const task of tasks) {
    const pillarId = blockPillarMap.get(task.plan_block_id) || "unknown";
    if (!pillarGroups.has(pillarId)) {
      const block = blocks.find((b) => b.pillar_id === pillarId);
      pillarGroups.set(pillarId, {
        name: pillarNames.get(pillarId) || "Tasks",
        blockTitle: block?.title || "",
        tasks: [],
      });
    }
    pillarGroups.get(pillarId)!.tasks.push(task);
  }

  // Sort tasks within each group: incomplete first, then completed
  for (const group of pillarGroups.values()) {
    group.tasks.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      return a.task_order - b.task_order;
    });
  }

  const groups = Array.from(pillarGroups.values());
  const showHeaders = groups.length > 1;

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No tasks for this week yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.name}>
          {showHeaders && (
            <div className="mb-2">
              <h3 className="text-sm font-medium">{group.name}</h3>
              {group.blockTitle && (
                <p className="text-xs text-muted-foreground">{group.blockTitle}</p>
              )}
            </div>
          )}
          <div className="divide-y divide-border">
            {group.tasks.map((task) => (
              <TaskItem key={task.id} task={task} onToggle={onToggleTask} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
