import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  MessageSquare,
  Square,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { MistakeJournalForm } from "@/components/plan/MistakeJournalForm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Feedback {
  overall_score: number;
  strengths: string[];
  areas_to_improve: string[];
  key_mistakes: string[];
  question_scores: { question: string; score: number; note: string }[];
  suggested_follow_up: string;
}

const MAX_MSG_LENGTH = 2000;

const TEXTAREA_BASE =
  "w-full resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mt-5 [&::-webkit-scrollbar-track]:pb-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground";

const TYPE_LABELS: Record<string, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  sql: "SQL",
  system_design: "System Design",
  case_study: "Case Study",
};

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-500";
  if (score >= 6) return "text-orange-500";
  return "text-red-500";
}

const MockInterview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const userId = session?.user?.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [interviewType, setInterviewType] = useState("");
  const [planTaskId, setPlanTaskId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [startTime] = useState(Date.now());
  const [showConversation, setShowConversation] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load existing mock interview data
  useEffect(() => {
    if (!id || !userId) return;
    (async () => {
      const { data, error } = await supabase
        .from("mock_interviews")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Mock interview not found");
        navigate("/interview-dashboard");
        return;
      }
      if (data.user_id !== userId) {
        toast.error("Unauthorized");
        navigate("/interview-dashboard");
        return;
      }

      setInterviewType(data.interview_type || "");
      setPlanTaskId(data.plan_task_id || null);
      const msgs: Message[] = (data.messages as Message[]) || [];
      setMessages(msgs);

      if (data.status === "completed") {
        setCompleted(true);
        setFeedback(data.ai_feedback as Feedback | null);
      }
      setInitialLoading(false);
    })();
  }, [id, userId, navigate]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when ready
  useEffect(() => {
    if (!initialLoading && !completed) {
      inputRef.current?.focus();
    }
  }, [initialLoading, completed]);

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

  const sendMessage = async () => {
    if (!input.trim() || loading || !id) return;
    const userMessage = input.trim();
    if (userMessage.length > MAX_MSG_LENGTH) {
      toast.error(`Message too long. Max ${MAX_MSG_LENGTH} characters.`);
      return;
    }

    const updatedMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-mock-interview",
        {
          body: { action: "continue", mock_id: id, message: userMessage },
        },
      );

      if (error || !data?.message) {
        toast.error("Failed to get response");
        setLoading(false);
        return;
      }

      // Strip completion tags from displayed message
      const displayMessage =
        data.message
          .replace(/\[INTERVIEW_COMPLETE\][\s\S]*?\[\/INTERVIEW_COMPLETE\]/, "")
          .trim() || data.message;

      setMessages([
        ...updatedMessages,
        { role: "assistant", content: displayMessage },
      ]);

      if (data.completed && data.feedback) {
        setCompleted(true);
        setFeedback(data.feedback);
      }
    } catch {
      toast.error("Failed to get response");
    }
    setLoading(false);
  };

  const endInterview = async () => {
    if (!id || ending) return;
    setEnding(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-mock-interview",
        {
          body: { action: "complete", mock_id: id },
        },
      );

      if (error || !data) {
        toast.error("Failed to end interview");
        setEnding(false);
        return;
      }

      if (data.message) {
        const displayMessage =
          data.message
            .replace(
              /\[INTERVIEW_COMPLETE\][\s\S]*?\[\/INTERVIEW_COMPLETE\]/,
              "",
            )
            .trim() || data.message;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: displayMessage },
        ]);
      }

      if (data.feedback) {
        setCompleted(true);
        setFeedback(data.feedback);
      }
    } catch {
      toast.error("Failed to end interview");
    }
    setEnding(false);
  };

  const typeLabel = TYPE_LABELS[interviewType] || "Mock";
  const elapsed = formatDuration(Date.now() - startTime);

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-500" />
            <span className="font-serif text-lg font-bold">Mock Interview</span>
            <Badge
              variant="outline"
              className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs"
            >
              {typeLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {!completed && (
              <button
                onClick={endInterview}
                disabled={ending || messages.length < 2}
                className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50"
              >
                {ending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
                End Interview
              </button>
            )}
            <button
              onClick={() => navigate("/interview-dashboard")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Dashboard
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
        {!completed && (
          <div className="flex flex-col h-[calc(100vh-10rem)]">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4 pb-4">
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
                            ? "bg-primary text-primary-foreground"
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
                {loading && (
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

            {/* Input area */}
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
                      placeholder="Type your answer..."
                      disabled={loading}
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
                      <TooltipContent>Send (Enter)</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =============== REVIEW PHASE =============== */}
        {completed && feedback && (
          <div className="space-y-6">
            {/* Score card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl font-bold">
                  Interview Feedback
                </h2>
                <div className="text-center">
                  <span
                    className={`text-3xl font-bold ${scoreColor(feedback.overall_score)}`}
                  >
                    {feedback.overall_score}
                  </span>
                  <span className="text-lg text-muted-foreground">/10</span>
                </div>
              </div>

              {/* Strengths */}
              {feedback.strengths.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-green-500 mb-2">
                    Strengths
                  </h3>
                  <ul className="space-y-1">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to improve */}
              {feedback.areas_to_improve.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-orange-500 mb-2">
                    Areas to Improve
                  </h3>
                  <ul className="space-y-1">
                    {feedback.areas_to_improve.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key mistakes */}
              {feedback.key_mistakes && feedback.key_mistakes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-red-500 mb-2">
                    Key Mistakes
                  </h3>
                  <ul className="space-y-1">
                    {feedback.key_mistakes.map((m, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        - {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Question scores */}
              {feedback.question_scores &&
                feedback.question_scores.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium mb-2">
                      Question Breakdown
                    </h3>
                    <div className="space-y-2">
                      {feedback.question_scores.map((q, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground truncate mr-2">
                            {q.question}
                          </span>
                          <span
                            className={`font-medium shrink-0 ${scoreColor(q.score)}`}
                          >
                            {q.score}/10
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Follow-up suggestion */}
              {feedback.suggested_follow_up && (
                <div className="pt-3 border-t border-orange-500/20">
                  <p className="text-sm text-muted-foreground">
                    <strong>Next step:</strong> {feedback.suggested_follow_up}
                  </p>
                </div>
              )}
            </motion.div>

            {/* Conversation review */}
            <div>
              <button
                onClick={() => setShowConversation(!showConversation)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Review Conversation
                {showConversation ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showConversation && (
                <div className="mt-3 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-card-foreground border border-border"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">{children}</p>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold">
                                  {children}
                                </strong>
                              ),
                              ul: ({ children }) => (
                                <ul className="list-disc pl-5 space-y-1">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal pl-5 space-y-1">
                                  {children}
                                </ol>
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mistake Journal Form */}
            <MistakeJournalForm
              mockInterviewId={id!}
              planTaskId={planTaskId}
              userId={userId!}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MockInterview;
