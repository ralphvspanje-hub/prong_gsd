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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Send,
  Loader2,
  Check,
  Zap,
  Clock,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CrashCoursePillar {
  name: string;
  description: string;
  focus_areas: string[];
  starting_level: number;
}

interface CrashCourseOutputs {
  topic: string;
  deadline: string | null;
  intensity: string;
  weak_areas: string[];
  pillars: CrashCoursePillar[];
  plan_duration_weeks: number;
  time_commitment: string;
}

const MAX_MSG_LENGTH = 3000;

const TEXTAREA_BASE =
  "w-full resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mt-5 [&::-webkit-scrollbar-track]:pb-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground";

// ---------------------------------------------------------------------------
// CrashCourseOnboarding — generic crash course setup (AI chat → review → confirm)
// ---------------------------------------------------------------------------

const CrashCourseOnboarding = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Phase flow: chat → review (no context upload phase — AI insists on context)
  const [phase, setPhase] = useState<"chat" | "review">("chat");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [outputs, setOutputs] = useState<CrashCourseOutputs | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState(
    "Setting up your crash course...",
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startedRef = useRef(false);

  // Warn before refresh/close during plan generation
  useEffect(() => {
    if (!saving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saving]);

  // Auto-start conversation on mount
  useEffect(() => {
    if (!startedRef.current && user) {
      startedRef.current = true;
      startConversation();
    }
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---- Chat handlers ----

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

  const startConversation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-crashcourse-onboarding",
        { body: { messages: [], action: "start" } },
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
    } catch (err: any) {
      toast.error("Failed to start conversation: " + err.message);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    if (userMessage.length > MAX_MSG_LENGTH) {
      toast.error(`Message too long. Max ${MAX_MSG_LENGTH} characters.`);
      return;
    }
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-crashcourse-onboarding",
        { body: { messages: newMessages, action: "continue" } },
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
            content: data.message || "Here's your crash course plan!",
          },
        ]);
      } else if (data.message) {
        setMessages([
          ...newMessages,
          { role: "assistant", content: data.message },
        ]);
      }
    } catch (err: any) {
      toast.error("Failed to send message: " + err.message);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  // ---- Confirm handler ----

  const handleConfirm = async () => {
    if (!outputs || !user) return;
    setSaving(true);
    try {
      // Create pillars with sort_order >= 100 (crash course scope)
      const pillarIds: string[] = [];
      for (let i = 0; i < outputs.pillars.length; i++) {
        const p = outputs.pillars[i];
        const { data: pillarData } = await supabase
          .from("pillars")
          .insert({
            user_id: user.id,
            name: p.name,
            description: p.description,
            why_it_matters: `Crash course focus: ${p.focus_areas.join(", ")}`,
            starting_level: p.starting_level,
            current_level: p.starting_level,
            sort_order: 100 + i,
          })
          .select()
          .single();

        if (pillarData) {
          pillarIds.push(pillarData.id);
          await supabase.from("topic_map").insert({
            pillar_id: pillarData.id,
            cluster_name: `${p.name} — Core Topics`,
            subtopics: p.focus_areas,
            difficulty_level: p.starting_level,
            priority_order: 0,
          });
        }
      }

      // Save time_commitment to user_profile (for plan generation)
      await supabase.from("user_profile").upsert(
        {
          user_id: user.id,
          name: user.email?.split("@")[0] || "Learner",
          time_commitment: outputs.time_commitment || "60_min_daily",
        },
        { onConflict: "user_id" },
      );

      setSavingMessage("Building your crash course...");

      // Generate the crash course plan (reuse interview_plan mode)
      const { data: planResult, error: planError } =
        await supabase.functions.invoke("gsd-generate-plan", {
          body: {
            mode: "interview_plan",
            crashcourse_type: "generic",
            crashcourse_topic: outputs.topic,
            crashcourse_deadline: outputs.deadline,
          },
        });

      if (planError) {
        console.error("Plan generation failed:", planError);
        toast.error(
          "Pillars saved, but plan generation failed. Please try again.",
        );
        setSaving(false);
        return;
      }

      localStorage.setItem("pronggsd-dashboard-view", "interview_prep");
      toast.success("Crash course is ready! Let's get to work.");

      // Navigate to the specific crash course dashboard
      const planId = planResult?.plan_id;
      if (planId) {
        navigate(`/crash-course/${planId}`);
      } else {
        navigate("/crash-course");
      }
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const daysUntilDeadline = outputs?.deadline
    ? Math.max(
        0,
        Math.ceil(
          (new Date(outputs.deadline).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-orange-500" />
            <span className="font-serif text-lg font-bold">
              Crash Course Setup
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/crash-course")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
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
        {/* =============== CHAT PHASE =============== */}
        {phase === "chat" && (
          <div className="flex flex-col h-[calc(100vh-10rem)]">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pb-4">
                {messages.length === 0 && loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-16 gap-3 text-center"
                  >
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                    <p className="text-base text-muted-foreground">
                      Setting up your crash course coach...
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
                <div className="flex flex-col border border-border bg-background rounded-2xl focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500 transition-shadow pr-2">
                  <div className="relative overflow-hidden rounded-t-2xl">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) =>
                        setInput(e.target.value.slice(0, MAX_MSG_LENGTH))
                      }
                      onInput={handleTextareaInput}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        messages.length === 0
                          ? "Waiting for your coach..."
                          : "Tell me what you need to prepare for..."
                      }
                      disabled={loading || messages.length === 0}
                      rows={1}
                      className={`${TEXTAREA_BASE} min-h-[80px] max-h-[200px] px-4 pt-5 pb-3`}
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-background rounded-t-2xl" />
                  </div>
                  <div className="flex items-center justify-between px-4 pb-2">
                    <span className="text-xs text-muted-foreground">
                      {input.length}/{MAX_MSG_LENGTH}
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

        {/* =============== REVIEW PHASE =============== */}
        {phase === "review" && outputs && (
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl font-bold">
                Your Crash Course Plan
              </h1>
              <p className="text-muted-foreground">
                Review your setup before we build your daily plan.
              </p>
            </div>

            {/* Overview Card */}
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Topic</p>
                      <p className="font-medium">{outputs.topic}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="font-medium">
                        {outputs.plan_duration_weeks} week
                        {outputs.plan_duration_weeks > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {daysUntilDeadline !== null && (
                    <div className="flex items-center gap-3">
                      <AlertTriangle
                        className={`h-5 w-5 shrink-0 ${daysUntilDeadline <= 7 ? "text-red-500" : "text-orange-500"}`}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Deadline In
                        </p>
                        <p className="font-medium">
                          {daysUntilDeadline} day
                          {daysUntilDeadline !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-orange-500/10 text-orange-600 dark:text-orange-400"
                  >
                    {outputs.intensity === "100_percent"
                      ? "Full Intensity"
                      : "Adapted Pace"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Weak Areas */}
            {outputs.weak_areas.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-serif text-xl font-semibold">
                  Focus Areas
                </h2>
                <div className="flex flex-wrap gap-2">
                  {outputs.weak_areas.map((area, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-sm border-orange-500/30"
                    >
                      {area}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Pillars */}
            <section className="space-y-4">
              <h2 className="font-serif text-xl font-semibold">
                Crash Course Pillars
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Level:
                        </span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((l) => (
                            <div
                              key={l}
                              className={`h-2 w-2 rounded-full ${l <= p.starting_level ? "bg-orange-500" : "bg-muted"}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.focus_areas.map((area, j) => (
                          <Badge
                            key={j}
                            variant="secondary"
                            className="text-xs"
                          >
                            {area}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <div className="flex gap-3 justify-center pt-4 pb-8">
              <Button variant="outline" onClick={() => setPhase("chat")}>
                Adjust Something
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {savingMessage}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Start Crash Course
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

export default CrashCourseOnboarding;
