import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Pillar = Tables<"pillars">;

interface PillarLevelCardsProps {
  pillars: Pillar[];
}

const trendIcon = (trend: string | null) => {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export const PillarLevelCards = ({ pillars }: PillarLevelCardsProps) => {
  if (pillars.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-serif text-lg font-semibold">Pillar Levels</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {pillars.map((p) => {
          const levelDelta = p.current_level - p.starting_level;
          return (
            <Card key={p.id} className="border-border">
              <CardContent className="py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-semibold text-sm">{p.name}</span>
                  <div className="flex items-center gap-2">
                    {levelDelta > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{levelDelta} since start
                      </Badge>
                    )}
                    {trendIcon(p.trend)}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((l) => (
                    <div
                      key={l}
                      className={`h-2 w-full rounded-full ${
                        l <= p.current_level ? "bg-accent" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Level {p.current_level}/5</span>
                  <span>{p.blocks_completed_at_level} blocks at this level</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
