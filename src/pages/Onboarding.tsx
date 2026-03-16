import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Send,
  Loader2,
  Zap,
  ChevronDown,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Pillar {
  name: string;
  description: string;
  why_it_matters: string;
  starting_level: number;
  key_topics: string[];
}

interface Phase {
  name: string;
  timeline_start: string;
  timeline_end: string;
  goal: string;
  weights: Record<string, number>;
}

interface TopicCluster {
  pillar: string;
  cluster_name: string;
  subtopics: string[];
  difficulty_level: number;
}

interface OnboardingOutputs {
  pillars: Pillar[];
  phases: Phase[];
  topicMap: TopicCluster[];
  // ProngGSD Phase 2 — captured during onboarding, written to user_profile
  pacing_profile?: string;
  time_commitment?: string;
  job_situation?: string;
  job_timeline_weeks?: number | null;
  tool_setup?: Record<string, boolean | null>;
  primary_focus?: string; // "interview_prep" | "long_term_learning"
}

const MAX_ONBOARDING_MSG_LENGTH = 3000;

const TEXTAREA_BASE =
  "w-full resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mt-5 [&::-webkit-scrollbar-track]:pb-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground";

const Onboarding = () => {
  const { user, session, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"chat" | "review">("chat");
  const [outputs, setOutputs] = useState<OnboardingOutputs | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState("Saving your profile...");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startedRef = useRef(false);
  const isOwner =
    user?.email?.toLowerCase() ===
    import.meta.env.VITE_OWNER_EMAIL?.toLowerCase();

  const handleAdminReset = async () => {
    if (!window.confirm("Reset all data and start over?")) return;
    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("gsd-reset-user-data", {
        body: { mode: "full" },
        headers: { Authorization: `Bearer ${s?.access_token}` },
      });
      window.location.href = "/context-upload";
    } catch (err: any) {
      toast.error("Reset failed: " + err.message);
    }
  };

  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (!authLoading && session && !startedRef.current) {
      startedRef.current = true;
      startConversation();
    }
  }, [authLoading, session]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-onboarding-chat",
        {
          body: { messages: [], action: "start" },
        },
      );
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (data.message) {
        setMessages([{ role: "assistant", content: data.message }]);
      }
      await supabase.from("onboarding_conversations").upsert({
        user_id: user!.id,
        messages: [{ role: "assistant", content: data.message }],
        status: "in_progress",
      });
    } catch (err: any) {
      toast.error("Failed to start conversation: " + err.message);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    if (userMessage.length > MAX_ONBOARDING_MSG_LENGTH) {
      toast.error(
        `Message too long. Max ${MAX_ONBOARDING_MSG_LENGTH} characters.`,
      );
      return;
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    const newMessages = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-onboarding-chat",
        {
          body: { messages: newMessages, action: "continue" },
        },
      );
      if (error) {
        let msg = error.message;
        try {
          const body = await (error as any).context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      if (data.outputs) {
        setOutputs(data.outputs);
        setPhase("review");
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.message || "Here's what I've prepared for you:",
          },
        ]);
      } else if (data.message) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.message },
        ]);
      }

      await supabase
        .from("onboarding_conversations")
        .update({
          messages: [
            ...newMessages,
            { role: "assistant", content: data.message },
          ],
          status: data.outputs ? "completed" : "in_progress",
        })
        .eq("user_id", user!.id);
    } catch (err: any) {
      toast.error("Failed to send message: " + err.message);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleConfirm = async () => {
    if (!outputs || !user) return;

    // Interview prep detection: route to dedicated flow if primary focus is interview prep
    if (
      outputs.primary_focus === "interview_prep" &&
      outputs.job_timeline_weeks != null &&
      outputs.job_timeline_weeks <= 3
    ) {
      // Save basic profile data so it persists
      await supabase.from("user_profile").upsert({
        user_id: user.id,
        name: user.email?.split("@")[0] || "Learner",
        job_situation: outputs.job_situation || "interviewing",
        job_timeline_weeks: outputs.job_timeline_weeks,
      });
      // Mark onboarding as completed
      await supabase
        .from("onboarding_conversations")
        .update({ status: "completed" })
        .eq("user_id", user.id);

      toast.info("Looks like you need interview prep! Let's set that up.");
      navigate("/interview-onboarding");
      return;
    }

    setSaving(true);
    try {
      await supabase.from("user_profile").upsert({
        user_id: user.id,
        name: user.email?.split("@")[0] || "Learner",
        // ProngGSD Phase 2 — persist onboarding-captured context to user_profile
        pacing_profile: outputs.pacing_profile || "steady",
        time_commitment: outputs.time_commitment || null,
        job_situation: outputs.job_situation || null,
        job_timeline_weeks: outputs.job_timeline_weeks ?? null,
        tool_setup: outputs.tool_setup || {},
      });

      for (let i = 0; i < outputs.pillars.length; i++) {
        const p = outputs.pillars[i];
        const { data: pillarData } = await supabase
          .from("pillars")
          .insert({
            user_id: user.id,
            name: p.name,
            description: p.description,
            why_it_matters: p.why_it_matters,
            starting_level: p.starting_level,
            current_level: p.starting_level,
            sort_order: i,
          })
          .select()
          .single();

        if (pillarData) {
          const topics = outputs.topicMap.filter((t) => t.pillar === p.name);
          for (let j = 0; j < topics.length; j++) {
            await supabase.from("topic_map").insert({
              pillar_id: pillarData.id,
              cluster_name: topics[j].cluster_name,
              subtopics: topics[j].subtopics,
              difficulty_level: topics[j].difficulty_level,
              priority_order: j,
            });
          }
        }
      }

      for (let i = 0; i < outputs.phases.length; i++) {
        const ph = outputs.phases[i];
        await supabase.from("phases").insert({
          user_id: user.id,
          name: ph.name,
          timeline_start: ph.timeline_start,
          timeline_end: ph.timeline_end,
          goal: ph.goal,
          is_active: i === 0,
          sort_order: i,
        });
      }

      await supabase
        .from("onboarding_conversations")
        .update({ status: "completed" })
        .eq("user_id", user.id);

      // Generate the sprint-based learning plan
      setSavingMessage("Building your personalized sprint plan...");
      const { error: planError } = await supabase.functions.invoke(
        "gsd-generate-plan",
        {
          body: { mode: "sprint_plan" },
        },
      );

      if (planError) {
        console.error("Plan generation failed:", planError);
        toast.error(
          "Profile saved, but plan generation failed. Please try again.",
        );
        setSaving(false);
        return;
      }

      toast.success("Setup complete! Your learning plan is ready.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <span className="font-serif text-lg font-bold">ProngGSD Setup</span>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && (
              <button
                onClick={handleAdminReset}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                title="Reset all data"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 container max-w-2xl py-6">
        {phase === "chat" && (
          <div className="flex flex-col h-[calc(100vh-10rem)]">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pb-4">
                {/* Initial loading state — shown before the mentor's first message */}
                {messages.length === 0 && loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 gap-3 text-center"
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    <p className="text-base text-muted-foreground">
                      Your mentor is getting ready...
                    </p>
                  </motion.div>
                )}

                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-4 py-3 text-base leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                            : "bg-card text-card-foreground border border-border"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p className="mb-3 last:mb-0">{children}</p>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold">
                                  {children}
                                </strong>
                              ),
                              hr: () => <hr className="my-3 border-border" />,
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-5 space-y-1">
                                  {children}
                                </ol>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc pl-5 space-y-1">
                                  {children}
                                </ul>
                              ),
                              li: ({ children }) => (
                                <li className="pl-0.5">{children}</li>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {/* Typing indicator — shown while waiting for a reply (not during initial load) */}
                {loading && messages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-card border border-border rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </motion.div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            <div className="pt-4 border-t border-border">
              <div className="max-w-[680px] mx-auto">
                <div className="flex flex-col border border-border bg-background rounded-2xl focus-within:ring-2 focus-within:ring-accent/50 focus-within:border-accent transition-shadow pr-2">
                  <div className="relative overflow-hidden rounded-t-2xl">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) =>
                        setInput(
                          e.target.value.slice(0, MAX_ONBOARDING_MSG_LENGTH),
                        )
                      }
                      onInput={handleTextareaInput}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        messages.length === 0
                          ? "Waiting for your mentor..."
                          : "Tell me about your goals..."
                      }
                      disabled={loading || messages.length === 0}
                      rows={1}
                      className={`${TEXTAREA_BASE} min-h-[80px] max-h-[200px] px-4 pt-5 pb-3`}
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-background rounded-t-2xl" />
                  </div>
                  <div className="flex items-center justify-between px-4 pb-2">
                    <span className="text-xs text-muted-foreground">
                      {input.length}/{MAX_ONBOARDING_MSG_LENGTH}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => sendMessage()}
                          disabled={loading || !input.trim()}
                          className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                            input.trim()
                              ? "text-foreground hover:bg-muted"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Send</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "review" && outputs && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl font-bold">
                Your Learning Blueprint
              </h1>
              <p className="text-muted-foreground">
                Review and confirm your personalized learning plan.
              </p>
            </div>

            <section className="space-y-4">
              <h2 className="font-serif text-xl font-semibold">
                Strategic Pillars
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {outputs.pillars.map((p, i) => (
                  <Card key={i} className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-serif">
                        {p.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {p.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {p.why_it_matters}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Level:
                        </span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((l) => (
                            <div
                              key={l}
                              className={`h-2 w-2 rounded-full ${l <= p.starting_level ? "bg-accent" : "bg-muted"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.key_topics?.map((t, j) => (
                          <Badge
                            key={j}
                            variant="secondary"
                            className="text-xs"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-serif text-xl font-semibold">
                Career Phases
              </h2>
              <div className="space-y-3">
                {outputs.phases.map((ph, i) => (
                  <Card key={i} className="border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-serif">
                          {ph.name}
                        </CardTitle>
                        <span className="text-sm text-muted-foreground">
                          {ph.timeline_start} → {ph.timeline_end}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        {ph.goal}
                      </p>
                      {ph.weights && (
                        <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
                          {Object.entries(ph.weights).map(
                            ([name, weight], j) => (
                              <div
                                key={j}
                                className="bg-accent/70 first:rounded-l-full last:rounded-r-full"
                                style={{ width: `${weight}%` }}
                                title={`${name}: ${weight}%`}
                              />
                            ),
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-serif text-xl font-semibold">Topic Map</h2>
              {outputs.pillars.map((p, i) => {
                const topics = outputs.topicMap.filter(
                  (t) => t.pillar === p.name,
                );
                return (
                  <Collapsible key={i}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-card border border-border rounded-lg hover:bg-secondary transition-colors">
                      <span className="font-serif text-base font-medium">
                        {p.name}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 space-y-1">
                      {topics.map((t, j) => (
                        <div
                          key={j}
                          className="pl-4 py-2 border-l-2 border-border ml-4"
                        >
                          <span className="text-base font-medium">
                            {t.cluster_name}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.subtopics.map((s, k) => (
                              <Badge
                                key={k}
                                variant="outline"
                                className="text-xs"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </section>

            <div className="flex gap-3 justify-center pt-4 pb-8">
              <Button variant="outline" onClick={() => setPhase("chat")}>
                Adjust Something
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {savingMessage}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm & Start Learning
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
