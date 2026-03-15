import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PacingBannerProps {
  pacingNotes: string[];
}

/** Contextual pacing message. Only renders when there are notes to show. */
export const PacingBanner = ({ pacingNotes }: PacingBannerProps) => {
  // Filter out empty/null notes and deduplicate
  const notes = [...new Set(pacingNotes.filter(Boolean))];
  if (notes.length === 0) return null;

  return (
    <Alert variant="default" className="border-accent/20 bg-accent/5">
      <Info className="h-4 w-4 text-accent" />
      <AlertDescription className="text-sm">
        {notes.map((note, i) => (
          <p key={i} className={i > 0 ? "mt-1" : ""}>{note}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
};
