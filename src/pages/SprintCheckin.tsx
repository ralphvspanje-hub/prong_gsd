import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, ArrowRight, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedPillar {
  pillar_name: string;
  reason: string;
}

interface CheckinSummary {
  sprint_review: string;
  difficulty_signals: Record<string, string>;
  suggested_focus: SuggestedPillar[];
  pacing_note: string;
}

const TEXTAREA_BASE =
  "w-full resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mt-5 [&::-webkit-scrollbar-track]:pb-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SprintCheckin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [phase, setPhase] = useState<"chat" | "review">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CheckinSummary | null>(null);
  const [suggestedPillars, setSuggestedPillars] = useState<SuggestedPillar[]>(
    [],
  );
  const [selectedPillars, setSelectedPillars] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sprintNumber, setSprintNumber] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch active sprint plan
  const { data: plan } = useQuery({
    queryKey: ["learning-plan", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_plans")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .eq("plan_type", "learning")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch all pillars for selection
  const { data: pillars } = useQuery({
    queryKey: ["pillars", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pillars")
        .select("id, name, current_level, sort_order")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start check-in on mount
  useEffect(() => {
    if (!plan?.id || checkinId || messages.length > 0) return;

    const startCheckin = async () => {
      setIsSending(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "gsd-sprint-checkin",
          { body: { action: "start", plan_id: plan.id } },
        );

        if (error) throw error;

        setCheckinId(data.checkin_id);
        setSprintNumber(data.sprint_number || 1);

        if (data.messages) {
          setMessages(data.messages);
        } else if (data.message) {
          setMessages([{ role: "assistant", content: data.message }]);
        }

        // Restore review phase if checkin was already completed
        if (data.completed && data.summary) {
          setSummary(data.summary);
          setSuggestedPillars(data.suggested_pillars || []);
          const dbPillars =
            queryClient.getQueryData<any[]>(["pillars", userId]) || [];
          const matchedNames = (data.suggested_pillars || [])
            .map(
              (sp: SuggestedPillar) =>
                dbPillars.find(
                  (p: any) =>
                    p.name.toLowerCase() === sp.pillar_name.toLowerCase() ||
                    p.name
                      .toLowerCase()
                      .includes(sp.pillar_name.toLowerCase()) ||
                    sp.pillar_name.toLowerCase().includes(p.name.toLowerCase()),
                )?.name,
            )
            .filter(Boolean)
            .slice(0, 2);
          setSelectedPillars(matchedNames);
          setPhase("review");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to start check-in");
      } finally {
        setIsSending(false);
      }
    };

    startCheckin();
  }, [plan?.id, checkinId, messages.length]);

  // Send message
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending || !checkinId) return;

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-sprint-checkin",
        {
          body: { action: "continue", checkin_id: checkinId, message: text },
        },
      );

      if (error) throw error;

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
      }

      if (data.completed && data.summary) {
        setSummary(data.summary);
        setSuggestedPillars(data.suggested_pillars || []);
        // Pre-select AI-suggested pillars (match against actual DB pillar names)
        const dbPillars =
          queryClient.getQueryData<any[]>(["pillars", userId]) || [];
        const matchedNames = (data.suggested_pillars || [])
          .map(
            (sp: SuggestedPillar) =>
              dbPillars.find(
                (p: any) =>
                  p.name.toLowerCase() === sp.pillar_name.toLowerCase() ||
                  p.name.toLowerCase().includes(sp.pillar_name.toLowerCase()) ||
                  sp.pillar_name.toLowerCase().includes(p.name.toLowerCase()),
              )?.name,
          )
          .filter(Boolean)
          .slice(0, 2);
        setSelectedPillars(matchedNames);
        setPhase("review");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, checkinId]);

  // Auto-resize textarea
  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle pillar selection
  const togglePillar = (name: string) => {
    setSelectedPillars((prev) => {
      if (prev.includes(name)) {
        return prev.filter((p) => p !== name);
      }
      if (prev.length >= 2) {
        toast.error("Maximum 2 pillars per sprint");
        return prev;
      }
      return [...prev, name];
    });
  };

  // Start next sprint
  const handleStartNextSprint = async () => {
    if (!plan || selectedPillars.length === 0) {
      toast.error("Select at least one pillar");
      return;
    }

    setIsGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("gsd-generate-plan", {
        body: {
          mode: "next_sprint",
          plan_id: plan.id,
          sprint_number: sprintNumber,
          checkin_summary: summary,
          focus_pillars: selectedPillars,
        },
      });

      if (error) throw error;

      toast.success("Next sprint generated!");
      queryClient.invalidateQueries({ queryKey: ["learning-plan", userId] });
      queryClient.invalidateQueries({ queryKey: ["plan-blocks-current"] });
      queryClient.invalidateQueries({ queryKey: ["plan-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-progress", userId] });
      queryClient.invalidateQueries({ queryKey: ["pillars", userId] });
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate next sprint");
    } finally {
      setIsGenerating(false);
    }
  };

  // Redirect if no sprint plan
  if (plan && (plan as any).plan_format !== "sprint") {
    navigate("/dashboard");
    return null;
  }

  // ---------------------------------------------------------------------------
  // Review phase — pillar selection + summary
  // ---------------------------------------------------------------------------

  if (phase === "review" && summary) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-6 space-y-6">
          <div className="text-center space-y-2">
            <Sparkles className="h-8 w-8 text-accent mx-auto" />
            <h1 className="font-serif text-2xl font-bold">
              Sprint {sprintNumber} Review
            </h1>
          </div>

          {/* Sprint summary */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm">{summary.sprint_review}</p>
              {summary.pacing_note && (
                <p className="text-sm text-muted-foreground">
                  {summary.pacing_note}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pillar selection */}
          <div className="space-y-3">
            <h2 className="font-serif text-lg font-semibold">
              Choose your next focus (1-2 pillars)
            </h2>

            <p className="text-sm text-muted-foreground">
              Want to add a new pillar or change your plan first?{" "}
              <a href="/mentor" className="text-accent hover:underline">
                Talk to your mentor
              </a>{" "}
              before picking.
            </p>

            <div className="grid gap-2">
              {(pillars || [])
                .filter((p) => (p.sort_order || 0) < 100)
                .sort((a, b) => {
                  // AI-suggested pillars first
                  const aIsSuggested = suggestedPillars.some(
                    (s) =>
                      s.pillar_name
                        .toLowerCase()
                        .includes(a.name.toLowerCase()) ||
                      a.name
                        .toLowerCase()
                        .includes(s.pillar_name.toLowerCase()),
                  );
                  const bIsSuggested = suggestedPillars.some(
                    (s) =>
                      s.pillar_name
                        .toLowerCase()
                        .includes(b.name.toLowerCase()) ||
                      b.name
                        .toLowerCase()
                        .includes(s.pillar_name.toLowerCase()),
                  );
                  if (aIsSuggested && !bIsSuggested) return -1;
                  if (!aIsSuggested && bIsSuggested) return 1;
                  return (a.sort_order || 0) - (b.sort_order || 0);
                })
                .map((pillar) => {
                  const isSelected = selectedPillars.includes(pillar.name);
                  const suggestion = suggestedPillars.find(
                    (s) =>
                      s.pillar_name.toLowerCase() === pillar.name.toLowerCase(),
                  );

                  return (
                    <button
                      key={pillar.id}
                      onClick={() => togglePillar(pillar.name)}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-accent bg-accent"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-accent-foreground" />
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-sm">
                            {pillar.name}
                          </span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            Level {pillar.current_level}
                          </Badge>
                          {suggestion && (
                            <Badge
                              variant="outline"
                              className="ml-1.5 text-xs border-accent/40 text-accent"
                            >
                              Recommended
                            </Badge>
                          )}
                          {suggestion && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {suggestion.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Start next sprint button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleStartNextSprint}
            disabled={selectedPillars.length === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating Sprint {sprintNumber + 1}...
              </>
            ) : (
              <>
                Start Sprint {sprintNumber + 1}{" "}
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </Layout>
    );
  }

  // ---------------------------------------------------------------------------
  // Chat phase
  // ---------------------------------------------------------------------------

  return (
    <Layout>
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="py-4 border-b">
          <h1 className="font-serif text-xl font-bold">
            Sprint {sprintNumber} Check-in
          </h1>
          <p className="text-sm text-muted-foreground">
            Review your sprint and plan what's next
          </p>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 py-4" ref={scrollRef}>
          <div className="space-y-4 pr-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t py-3">
          <div className="flex items-end gap-2 rounded-xl border bg-card px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
              onInput={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="How did the sprint go?"
              rows={1}
              className={`${TEXTAREA_BASE} min-h-[2.5rem] max-h-[200px]`}
              disabled={isSending}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SprintCheckin;
