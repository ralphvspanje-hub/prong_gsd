import { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Zap,
  Upload,
  FileCheck,
  Loader2,
  ArrowRight,
  Info,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { parsePdf } from "@/lib/parsePdf";

const ContextUpload = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const linkedinInputRef = useRef<HTMLInputElement>(null);

  const [resumeFile, setResumeFile] = useState<string | null>(null);
  const [linkedinFile, setLinkedinFile] = useState<string | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadingLinkedin, setUploadingLinkedin] = useState(false);
  const [generating, setGenerating] = useState(false);
  const isOwner =
    user?.email?.toLowerCase() ===
    import.meta.env.VITE_OWNER_EMAIL?.toLowerCase();

  const handleAdminReset = async () => {
    if (!window.confirm("Reset all data and start over?")) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("gsd-reset-user-data", {
        body: { mode: "full" },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      window.location.reload();
    } catch (err: any) {
      toast.error("Reset failed: " + err.message);
    }
  };

  // If user already has a plan, skip straight to dashboard
  const { data: hasPlan, isLoading } = useQuery({
    queryKey: ["has-plan", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("learning_plans")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_active", true);
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  // Check if pillars already exist (post-rewind state — can skip onboarding)
  const { data: hasPillars } = useQuery({
    queryKey: ["has-pillars", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("pillars")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id && !isLoading && !hasPlan,
  });

  if (hasPlan) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("gsd-generate-plan", {
        body: { mode: "full_plan" },
      });
      if (error) throw error;
      toast.success("Plan generated! Redirecting...");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(
        "Plan generation failed: " + (err.message || "Unknown error"),
      );
      setGenerating(false);
    }
  };

  const handleFileUpload = async (
    file: File,
    column: "resume_text" | "linkedin_context",
    setUploading: (v: boolean) => void,
    setFileName: (v: string) => void,
    label: string,
  ) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Max 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const text = await parsePdf(file);
      const { error } = await supabase
        .from("user_profile")
        .upsert(
          { user_id: user!.id, [column]: text },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      setFileName(file.name);
      toast.success(`${label} uploaded and parsed.`);
    } catch (err: any) {
      toast.error(`Failed to process ${label.toLowerCase()}: ${err.message}`);
    }
    setUploading(false);
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileUpload(
      file,
      "resume_text",
      setUploadingResume,
      setResumeFile,
      "Resume",
    );
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  };

  const handleLinkedinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileUpload(
      file,
      "linkedin_context",
      setUploadingLinkedin,
      setLinkedinFile,
      "LinkedIn profile",
    );
    if (linkedinInputRef.current) linkedinInputRef.current.value = "";
  };

  const isUploading = uploadingResume || uploadingLinkedin;

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

      <div className="flex-1 container max-w-lg py-4">
        <div className="space-y-8">
          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="font-serif text-3xl font-bold">
              Give your mentor some context
            </h1>
            <p className="text-base text-muted-foreground max-w-md mx-auto">
              Upload your resume and LinkedIn profile so the AI can build a plan
              that fits your actual background. Both are optional.
            </p>
          </div>

          {/* Resume upload */}
          <Card className="border-border">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium">Resume (PDF)</span>
                {resumeFile && (
                  <span className="flex items-center gap-1 text-sm text-green-500">
                    <FileCheck className="h-3.5 w-3.5" />
                    {resumeFile}
                  </span>
                )}
              </div>
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf"
                onChange={handleResumeChange}
                className="hidden"
              />
              <Button
                variant="outline"
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
                    {resumeFile ? "Replace resume" : "Upload resume"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* LinkedIn upload */}
          <Card className="border-border">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-medium">
                  LinkedIn Profile (PDF)
                </span>
                {linkedinFile && (
                  <span className="flex items-center gap-1 text-sm text-green-500">
                    <FileCheck className="h-3.5 w-3.5" />
                    {linkedinFile}
                  </span>
                )}
              </div>
              <input
                ref={linkedinInputRef}
                type="file"
                accept=".pdf"
                onChange={handleLinkedinChange}
                className="hidden"
              />
              <Button
                variant="outline"
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
                    {linkedinFile
                      ? "Replace LinkedIn PDF"
                      : "Upload LinkedIn PDF"}
                  </>
                )}
              </Button>

              {/* LinkedIn export instructions */}
              <div className="flex gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">
                    How to export your LinkedIn profile:
                  </p>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>Go to your own LinkedIn profile page</li>
                    <li>
                      Click the <strong>"Resources"</strong> button in the top
                      header (where your name is)
                    </li>
                    <li>
                      Click <strong>"Save to PDF"</strong>
                    </li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            {hasPillars ? (
              <>
                <Button
                  className="w-full gap-2"
                  onClick={handleGeneratePlan}
                  disabled={isUploading || generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Building your
                      plan...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Generate Plan from Existing
                      Pillars
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    onClick={() => navigate("/onboarding")}
                    disabled={isUploading || generating}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Or re-do onboarding from scratch
                  </button>
                </div>
              </>
            ) : (
              <>
                <Button
                  className="w-full gap-2"
                  onClick={() => navigate("/onboarding")}
                  disabled={isUploading}
                >
                  Continue to onboarding <ArrowRight className="h-4 w-4" />
                </Button>
                <div className="text-center">
                  <button
                    onClick={() => navigate("/onboarding")}
                    disabled={isUploading}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContextUpload;
