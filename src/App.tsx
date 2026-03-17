import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { DemoProvider, useDemo } from "@/hooks/useDemo";
import { Loader2 } from "lucide-react";

// Eager-load the most common landing pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// Lazy-load everything else — splits into separate chunks
const ContextUpload = lazy(() => import("./pages/ContextUpload"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Progress = lazy(() => import("./pages/Progress"));
const History = lazy(() => import("./pages/History"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const Mentor = lazy(() => import("./pages/Mentor"));
const PlanOverview = lazy(() => import("./pages/PlanOverview"));
const InterviewDashboard = lazy(() => import("./pages/InterviewDashboard"));
const InterviewOnboarding = lazy(() => import("./pages/InterviewOnboarding"));
const MockInterview = lazy(() => import("./pages/MockInterview"));
const CrashCourseSelector = lazy(() => import("./pages/CrashCourseSelector"));
const CrashCourseOnboarding = lazy(
  () => import("./pages/CrashCourseOnboarding"),
);
const CrashCourseDashboard = lazy(() => import("./pages/CrashCourseDashboard"));
const SprintCheckin = lazy(() => import("./pages/SprintCheckin"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const { isDemo } = useDemo();
  if (isDemo) return <>{children}</>;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthRoute = () => {
  const { session, loading } = useAuth();
  const { isDemo } = useDemo();
  if (isDemo) return <Navigate to="/dashboard" replace />;
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <DemoProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-background">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/auth" element={<AuthRoute />} />
                  <Route
                    path="/"
                    element={<Navigate to="/dashboard" replace />}
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/plan"
                    element={
                      <ProtectedRoute>
                        <PlanOverview />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/context-upload"
                    element={
                      <ProtectedRoute>
                        <ContextUpload />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-dashboard"
                    element={
                      <ProtectedRoute>
                        <InterviewDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/interview-onboarding"
                    element={
                      <ProtectedRoute>
                        <InterviewOnboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/crash-course"
                    element={
                      <ProtectedRoute>
                        <CrashCourseSelector />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/crashcourse-onboarding"
                    element={
                      <ProtectedRoute>
                        <CrashCourseOnboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/crash-course/:planId"
                    element={
                      <ProtectedRoute>
                        <CrashCourseDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sprint-checkin"
                    element={
                      <ProtectedRoute>
                        <SprintCheckin />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mock-interview/:id"
                    element={
                      <ProtectedRoute>
                        <MockInterview />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/progress"
                    element={
                      <ProtectedRoute>
                        <Progress />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <ProtectedRoute>
                        <History />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/mentor"
                    element={
                      <ProtectedRoute>
                        <Mentor />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </DemoProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
