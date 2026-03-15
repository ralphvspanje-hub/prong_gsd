import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

interface PrimerViewProps {
  blockId: string;
  contextBrief: string;
}

/** Dismissible primer/intro for level 1 users or new pillar introductions. */
export const PrimerView = ({ blockId, contextBrief }: PrimerViewProps) => {
  const storageKey = `pronggsd-primer-dismissed-${blockId}`;
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(storageKey) === "true"
  );

  if (dismissed || !contextBrief) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, "true");
    setDismissed(true);
  };

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4 text-accent" />
          Before you start
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
          <ReactMarkdown>{contextBrief}</ReactMarkdown>
        </div>
        <Button variant="secondary" size="sm" onClick={handleDismiss}>
          Got it, show me the tasks
        </Button>
      </CardContent>
    </Card>
  );
};
