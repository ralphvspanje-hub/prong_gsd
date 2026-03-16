import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

interface MistakeJournalDisplayProps {
  userId: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  communication: "Communication",
  time_management: "Time Mgmt",
  confidence: "Confidence",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  behavioral: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  communication: "bg-green-500/10 text-green-600 border-green-500/20",
  time_management: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  confidence: "bg-red-500/10 text-red-600 border-red-500/20",
  other: "bg-muted text-muted-foreground border-border",
};

export const MistakeJournalDisplay = ({ userId }: MistakeJournalDisplayProps) => {
  const { data: mistakes } = useQuery({
    queryKey: ["recent-mistakes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mistake_journal")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  if (!mistakes || mistakes.length === 0) return null;

  // Count by category for pattern detection
  const categoryCounts: Record<string, number> = {};
  for (const m of mistakes) {
    const cat = m.category || "other";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const showPattern = topCategory && topCategory[1] >= 3;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-orange-500" />
        <h3 className="text-sm font-medium">Mistake Journal</h3>
        <span className="text-xs text-muted-foreground">Recent</span>
      </div>

      {showPattern && (
        <div className="text-xs text-orange-500 bg-orange-500/5 rounded px-2 py-1">
          Pattern: {topCategory[1]} of your last {mistakes.length} mistakes are in{" "}
          <strong>{CATEGORY_LABELS[topCategory[0]] || topCategory[0]}</strong>
        </div>
      )}

      <div className="space-y-2">
        {mistakes.slice(0, 5).map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${
                CATEGORY_COLORS[m.category || "other"] || CATEGORY_COLORS.other
              }`}
            >
              {CATEGORY_LABELS[m.category || "other"] || m.category}
            </Badge>
            <div className="min-w-0">
              <p className="text-xs text-foreground truncate">{m.mistake_description}</p>
              {m.lesson_learned && (
                <p className="text-xs text-muted-foreground truncate">{m.lesson_learned}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {mistakes.length > 5 && (
        <p className="text-xs text-muted-foreground">
          +{mistakes.length - 5} more mistake{mistakes.length - 5 > 1 ? "s" : ""} logged
        </p>
      )}
    </div>
  );
};
