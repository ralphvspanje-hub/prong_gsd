import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, MessageSquare, RotateCcw } from "lucide-react";

interface PlanCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalWeeks: number;
}

/** Shown when the entire multi-week plan is complete. */
export const PlanCompletionModal = ({
  open,
  onOpenChange,
  totalWeeks,
}: PlanCompletionModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <Trophy className="h-12 w-12 text-accent mb-2" />
          <DialogTitle className="font-serif text-xl">
            You did it!
          </DialogTitle>
          <DialogDescription>
            Your {totalWeeks}-week plan is complete.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <Button
            onClick={() => { onOpenChange(false); navigate("/mentor"); }}
            className="w-full gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            What's next?
          </Button>
          <Button
            variant="outline"
            onClick={() => { onOpenChange(false); navigate("/onboarding"); }}
            className="w-full gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Start fresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
