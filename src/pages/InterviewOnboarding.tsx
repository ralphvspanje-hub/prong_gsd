import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { parsePdf } from "@/lib/parsePdf";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Send,
  Loader2,
  Check,
  Target,
  Clock,
  AlertTriangle,
  Upload,
  FileCheck,
  FileText,
  Info,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface InterviewPillar {
  name: string;
  description: string;
  focus_areas: string[];
  starting_level: number;
}

interface InterviewPrepOutputs {
  target_role: string;
  company: string | null;
  company_context: string | null;
  interview_date: string | null;
  intensity: string;
  weak_areas: string[];
  interview_format: string;
  interview_pillars: InterviewPillar[];
  plan_duration_weeks: number;
  time_commitment: string;
}

const MAX_MSG_LENGTH = 3000;

const TEXTAREA_BASE =
  "w-full resize-none bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-track]:mt-5 [&::-webkit-scrollbar-track]:pb-2 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-content [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground";

const InterviewOnboarding = () => {
  const { user, session, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Phase flow: context → chat → review
  const [phase, setPhase] = useState<"context" | "chat" | "review">("context");

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [outputs, setOutputs] = useState<InterviewPrepOutputs | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState(
    "Setting up your prep plan...",
  );

  // Review phase: editable company context
  const [companyName, setCompanyName] = useState("");
  const [companyContext, setCompanyContext] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Context phase state
  const [contextJobDescription, setContextJobDescription] = useState("");
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [linkedinFileName, setLinkedinFileName] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingLinkedin, setUploadingLinkedin] = useState(false);
  const [savingContext, setSavingContext] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const linkedinInputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  // Fetch existing profile to show indicators
  const { data: existingProfile } = useQuery({
    queryKey: ["interview-context-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profile")
        .select("resume_text, linkedin_context, interview_company_context")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Set indicators from existing profile
  useEffect(() => {
    if (!existingProfile) return;
    if (existingProfile.resume_text)
      setResumeFileName("Resume already on file");
    if (existingProfile.linkedin_context)
      setLinkedinFileName("LinkedIn already on file");
    if (existingProfile.interview_company_context && !contextJobDescription) {
      setContextJobDescription(existingProfile.interview_company_context);
    }
  }, [existingProfile]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---- Context phase handlers ----

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5 MB.");
      return;
    }
    setUploadingResume(true);
    try {
      const text = await parsePdf(file);
      const { error } = await supabase.from("user_profile").upsert(
        {
          user_id: user!.id,
          name: user!.email?.split("@")[0] || "Learner",
          resume_text: text,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
      setResumeFileName(file.name);
      toast.success("Resume uploaded and parsed.");
    } catch (err: any) {
      toast.error("Failed to process resume: " + err.message);
    }
    setUploadingResume(false);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  const handleLinkedinUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5 MB.");
      return;
    }
    setUploadingLinkedin(true);
    try {
      const text = await parsePdf(file);
      const { error } = await supabase
        .from("user_profile")
        .upsert(
          {
            user_id: user!.id,
            name: user!.email?.split("@")[0] || "Learner",
            linkedin_context: text,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      setLinkedinFileName(file.name);
      toast.success("LinkedIn profile uploaded and parsed.");
    } catch (err: any) {
      toast.error("Failed to process LinkedIn PDF: " + err.message);
    }
    setUploadingLinkedin(false);
    if (linkedinInputRef.current) linkedinInputRef.current.value = "";
  };

  const handleContextContinue = async () => {
    setSavingContext(true);
    if (contextJobDescription.trim()) {
      await supabase.from("user_profile").upsert(
        {
          user_id: user!.id,
          name: user!.email?.split("@")[0] || "Learner",
          interview_company_context: contextJobDescription.trim(),
        },
        { onConflict: "user_id" },
      );
    }
    setPhase("chat");
    startConversation();
    setSavingContext(false);
  };

  // ---- Chat phase handlers ----

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
        "gsd-interview-onboarding",
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
    const newMessages = [
      ...messages,
      { role: "user" as const, content: userMessage },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "gsd-interview-onboarding",
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
        setCompanyName(data.outputs.company || "");
        setCompanyContext(data.outputs.company_context || "");
        setJobDescription(contextJobDescription); // Pre-populate from context phase
        setPhase("review");
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.message || "Here's your prep plan!",
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

  // ---- Review phase handler ----

  const handleConfirm = async () => {
    if (!outputs || !user) return;
    setSaving(true);
    try {
      const interviewData: Record<string, any> = {
        user_id: user.id,
        interview_target_role: outputs.target_role,
        interview_company: companyName || null,
        interview_company_context:
          [companyContext, jobDescription]
            .filter(Boolean)
            .join("\n\nJOB DESCRIPTION:\n") || null,
        interview_date: outputs.interview_date || null,
        interview_intensity: outputs.intensity,
        interview_weak_areas: outputs.weak_areas,
        interview_format: outputs.interview_format,
      };
      interviewData.name = user.email?.split("@")[0] || "Learner";
      await supabase.from("user_profile").upsert(interviewData);

      const pillarIds: string[] = [];
      for (let i = 0; i < outputs.interview_pillars.length; i++) {
        const p = outputs.interview_pillars[i];
        const { data: pillarData } = await supabase
          .from("pillars")
          .insert({
            user_id: user.id,
            name: p.name,
            description: p.description,
            why_it_matters: `Interview prep focus: ${p.focus_areas.join(", ")}`,
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

      setSavingMessage("Building your crash course...");
      const { error: planError } = await supabase.functions.invoke(
        "gsd-generate-plan",
        { body: { mode: "interview_plan" } },
      );

      if (planError) {
        console.error("Plan generation failed:", planError);
        toast.error(
          "Profile saved, but plan generation failed. Please try again.",
        );
        setSaving(false);
        return;
      }

      localStorage.setItem("pronggsd-dashboard-view", "interview_prep");
      toast.success("Interview prep is ready! Let's crush this.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  const daysUntilInterview = outputs?.interview_date
    ? Math.max(
        0,
        Math.ceil(
          (new Date(outputs.interview_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-orange-500" />
            <span className="font-serif text-lg font-bold">
              Interview Prep Setup
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
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
        {/* =============== CONTEXT PHASE =============== */}
        {phase === "context" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl font-bold">
                Prepare Your Context
              </h1>
              <p className="text-muted-foreground">
                Help your prep coach build a targeted plan. All fields are
                optional.
              </p>
            </div>

            {/* Job Description — prominent */}
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="context-jd" className="text-base font-medium">
                    Job Description
                  </Label>
                  <Badge
                    variant="secondary"
                    className="bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs"
                  >
                    Recommended
                  </Badge>
                </div>
                <Textarea
                  id="context-jd"
                  placeholder="Paste the full job description here..."
                  value={contextJobDescription}
                  onChange={(e) => setContextJobDescription(e.target.value)}
                  rows={6}
                  className="focus-visible:ring-orange-500/50"
                />
                <p className="text-xs text-muted-foreground">
                  The more detail you provide, the more targeted your crash
                  course will be.
                </p>
              </CardContent>
            </Card>

            {/* Resume + LinkedIn uploads */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Resume */}
              <Card className="border-border">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Resume (PDF)</span>
                    {resumeFileName && (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <FileCheck className="h-3 w-3" />
                        {resumeFileName}
                      </span>
                    )}
                  </div>
                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => resumeInputRef.current?.click()}
                    disabled={uploadingResume}
                  >
                    {uploadingResume ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Parsing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />{" "}
                        {resumeFileName ? "Replace resume" : "Upload resume"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* LinkedIn */}
              <Card className="border-border">
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">LinkedIn (PDF)</span>
                    {linkedinFileName && (
                      <span className="flex items-center gap-1 text-xs text-green-500">
                        <FileCheck className="h-3 w-3" />
                        {linkedinFileName}
                      </span>
                    )}
                  </div>
                  <input
                    ref={linkedinInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleLinkedinUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => linkedinInputRef.current?.click()}
                    disabled={uploadingLinkedin}
                  >
                    {uploadingLinkedin ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Parsing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />{" "}
                        {linkedinFileName
                          ? "Replace LinkedIn PDF"
                          : "Upload LinkedIn PDF"}
                      </>
                    )}
                  </Button>
                  <div className="flex gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      LinkedIn → your profile → Resources → Save to PDF
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-3 pt-2">
              <Button
                onClick={handleContextContinue}
                disabled={savingContext || uploadingResume || uploadingLinkedin}
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {savingContext ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" /> Continue to Chat
                  </>
                )}
              </Button>
              <button
                onClick={() => {
                  setPhase("chat");
                  startConversation();
                }}
                disabled={savingContext}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip — start chatting
              </button>
            </div>
          </div>
        )}

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
                      Setting up your prep coach...
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
                          ? "Waiting for your prep coach..."
                          : "Tell me about your interview..."
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
                Your Interview Prep Plan
              </h1>
              <p className="text-muted-foreground">
                Review your crash course setup before we build your daily plan.
              </p>
            </div>

            {/* Overview Card */}
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-orange-500 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Target Role
                      </p>
                      <p className="font-medium">{outputs.target_role}</p>
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
                  {daysUntilInterview !== null && (
                    <div className="flex items-center gap-3">
                      <AlertTriangle
                        className={`h-5 w-5 shrink-0 ${daysUntilInterview <= 7 ? "text-red-500" : "text-orange-500"}`}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Interview In
                        </p>
                        <p className="font-medium">
                          {daysUntilInterview} day
                          {daysUntilInterview !== 1 ? "s" : ""}
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
                  <Badge variant="secondary">{outputs.interview_format}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Company Context (editable) */}
            <section className="space-y-3">
              <h2 className="font-serif text-xl font-semibold">
                Company Context (optional)
              </h2>
              <p className="text-sm text-muted-foreground">
                Add details about the company or role to make your prep more
                targeted. You can skip this.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    placeholder="e.g., Spotify"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="company-context">
                    Company / Product Description
                  </Label>
                  <Textarea
                    id="company-context"
                    placeholder="e.g., Music streaming platform focused on personalization and data-driven product decisions..."
                    value={companyContext}
                    onChange={(e) => setCompanyContext(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="job-description">Job Description</Label>
                  <Textarea
                    id="job-description"
                    placeholder="Paste the job description or key requirements here to tailor your prep..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </section>

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
              <h2 className="font-serif text-xl font-semibold">Prep Pillars</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {outputs.interview_pillars.map((p, i) => (
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

export default InterviewOnboarding;
