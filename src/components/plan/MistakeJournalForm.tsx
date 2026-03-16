import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface MistakeEntry {
  category: string;
  mistake_description: string;
  lesson_learned: string;
}

interface MistakeJournalFormProps {
  mockInterviewId: string;
  planTaskId: string | null;
  userId: string;
}

const CATEGORIES = [
  { value: "technical", label: "Technical Accuracy" },
  { value: "behavioral", label: "Behavioral / STAR" },
  { value: "communication", label: "Communication" },
  { value: "time_management", label: "Time Management" },
  { value: "confidence", label: "Confidence" },
  { value: "other", label: "Other" },
];

const emptyEntry = (): MistakeEntry => ({
  category: "technical",
  mistake_description: "",
  lesson_learned: "",
});

export const MistakeJournalForm = ({ mockInterviewId, planTaskId, userId }: MistakeJournalFormProps) => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MistakeEntry[]>([emptyEntry()]);
  const [saving, setSaving] = useState(false);

  const updateEntry = (index: number, field: keyof MistakeEntry, value: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, emptyEntry()]);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    // Filter out entries with no description
    const valid = entries.filter((e) => e.mistake_description.trim());
    if (valid.length === 0) {
      // Skip journal — just mark task complete and go
      await markTaskComplete();
      navigate("/dashboard");
      return;
    }

    setSaving(true);
    try {
      for (const entry of valid) {
        const { error } = await supabase.from("mistake_journal").insert({
          user_id: userId,
          mock_interview_id: mockInterviewId,
          category: entry.category,
          mistake_description: entry.mistake_description.trim(),
          lesson_learned: entry.lesson_learned.trim() || null,
        });
        if (error) throw error;
      }

      await markTaskComplete();
      toast.success(`${valid.length} mistake${valid.length > 1 ? "s" : ""} logged`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const markTaskComplete = async () => {
    if (!planTaskId) return;
    try {
      await supabase
        .from("plan_tasks")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq("id", planTaskId);
    } catch {
      // Non-critical — don't block navigation
    }
  };

  const handleSkip = async () => {
    await markTaskComplete();
    navigate("/dashboard");
  };

  return (
    <div className="rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-5 w-5 text-orange-500" />
        <h3 className="font-serif text-lg font-bold">Mistake Journal</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Log what went wrong so you can spot patterns. This is where real improvement happens.
      </p>

      {entries.map((entry, i) => (
        <div key={i} className="space-y-3 border-b border-border pb-4 last:border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <Badge
                  key={cat.value}
                  variant="outline"
                  className={`cursor-pointer text-xs transition-colors ${
                    entry.category === cat.value
                      ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => updateEntry(i, "category", cat.value)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
            {entries.length > 1 && (
              <button
                onClick={() => removeEntry(i)}
                className="text-muted-foreground hover:text-red-500 transition-colors ml-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <textarea
            value={entry.mistake_description}
            onChange={(e) => updateEntry(i, "mistake_description", e.target.value)}
            placeholder="What went wrong? Be specific."
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />

          <textarea
            value={entry.lesson_learned}
            onChange={(e) => updateEntry(i, "lesson_learned", e.target.value)}
            placeholder="What will you do differently next time? (optional)"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
          />
        </div>
      ))}

      <button
        onClick={addEntry}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" /> Add another mistake
      </button>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip & return to dashboard
        </button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {saving ? "Saving..." : "Save & Return to Dashboard"}
        </Button>
      </div>
    </div>
  );
};
