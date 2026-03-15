import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface CheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekNumber: number;
  pillarName: string;
  onSubmit: (difficulty: string, note: string) => Promise<void>;
}

const DIFFICULTY_OPTIONS = [
  { value: "too_easy", label: "Too easy", emoji: "😴" },
  { value: "just_right", label: "Just right", emoji: "👍" },
  { value: "too_hard", label: "Too hard", emoji: "😰" },
];

/** Shown when all tasks in a plan block are completed. Captures difficulty feedback. */
export const CheckinModal = ({
  open,
  onOpenChange,
  weekNumber,
  pillarName,
  onSubmit,
}: CheckinModalProps) => {
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(difficulty || "just_right", note);
    setSubmitting(false);
    setDifficulty(null);
    setNote("");
  };

  const handleDismiss = async () => {
    // Dismiss without feedback — still triggers completion
    setSubmitting(true);
    await onSubmit("", "");
    setSubmitting(false);
    setDifficulty(null);
    setNote("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !submitting) handleDismiss();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Week {weekNumber} — {pillarName} complete!
          </DialogTitle>
          <DialogDescription>
            How did this week feel?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Difficulty selection */}
          <div className="flex gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={difficulty === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficulty(opt.value)}
                className="flex-1"
                disabled={submitting}
              >
                {opt.emoji} {opt.label}
              </Button>
            ))}
          </div>

          {/* Optional note */}
          <Textarea
            placeholder="Anything else? (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            disabled={submitting}
          />

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparing next week...</>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
