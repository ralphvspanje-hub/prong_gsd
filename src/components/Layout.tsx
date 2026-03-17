import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";
import { useTheme } from "@/hooks/useTheme";
import { useMentorName } from "@/hooks/useMentorName";
import { supabase } from "@/integrations/supabase/client";
import {
  Sun,
  Moon,
  LogOut,
  Zap,
  Map,
  BarChart3,
  Clock,
  Settings,
  MessageSquare,
  Target,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Paths that indicate the user is in crash course mode (expanded from INTERVIEW_PATHS)
const CRASH_COURSE_PATHS = [
  "/crash-course",
  "/crashcourse-onboarding",
  "/interview-dashboard",
  "/interview-onboarding",
  "/mock-interview",
];

export const Layout = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const { isDemo, disableDemo } = useDemo();
  const { theme, toggleTheme } = useTheme();
  const { mentorName } = useMentorName();
  const location = useLocation();
  const navigate = useNavigate();
  const userId = user?.id;

  const isOnCrashCoursePath = CRASH_COURSE_PATHS.some((p) =>
    location.pathname.startsWith(p),
  );
  const isCrashCourseMode =
    isOnCrashCoursePath ||
    localStorage.getItem("pronggsd-dashboard-view") === "interview_prep";

  // Extract active crash course plan ID from URL, fall back to localStorage for shared pages
  const crashCoursePlanId =
    location.pathname.match(/^\/crash-course\/([^/]+)/)?.[1] ||
    localStorage.getItem("pronggsd-active-crashcourse-id");

  // Query active crash course plans for the header button
  const { data: crashPlans } = useQuery({
    queryKey: ["crash-course-plans-count", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learning_plans")
        .select("id")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .eq("plan_type", "interview_prep");
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !isDemo,
    staleTime: 30000,
  });

  const crashPlanCount = crashPlans?.length ?? 0;

  // Determine where the crash course button navigates
  const handleCrashCourseClick = () => {
    if (crashPlanCount === 1 && crashPlans) {
      navigate(`/crash-course/${crashPlans[0].id}`);
    } else {
      navigate("/crash-course");
    }
  };

  // Learning nav items (default)
  const learningNavItems = [
    { path: "/dashboard", label: "Today", icon: Zap, mobileVisible: true },
    { path: "/plan", label: "Plan", icon: Map, mobileVisible: true },
    {
      path: "/progress",
      label: "Progress",
      icon: BarChart3,
      mobileVisible: true,
    },
    { path: "/history", label: "History", icon: Clock, mobileVisible: false },
    {
      path: "/settings",
      label: "Settings",
      icon: Settings,
      mobileVisible: true,
    },
    {
      path: "/mentor",
      label: mentorName,
      icon: MessageSquare,
      mobileVisible: true,
    },
  ];

  // Crash course nav items (swapped when on crash course pages)
  const crashCourseNavItems = [
    {
      path: crashCoursePlanId
        ? `/crash-course/${crashCoursePlanId}`
        : "/crash-course",
      label: "Prep",
      icon: Target,
      mobileVisible: true,
    },
    { path: "/plan", label: "Plan", icon: Map, mobileVisible: true },
    {
      path: "/progress",
      label: "Progress",
      icon: BarChart3,
      mobileVisible: true,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: Settings,
      mobileVisible: true,
    },
    {
      path: "/mentor",
      label: mentorName,
      icon: MessageSquare,
      mobileVisible: true,
    },
  ];

  const navItems = isCrashCourseMode ? crashCourseNavItems : learningNavItems;

  // Active highlight: startsWith for crash course Prep item, exact match for others
  const isActive = (itemPath: string) => {
    if (
      itemPath.startsWith("/crash-course") &&
      location.pathname.startsWith("/crash-course")
    )
      return true;
    return location.pathname === itemPath;
  };

  // Logo links to the appropriate dashboard
  const homePath = isCrashCourseMode ? "/crash-course" : "/dashboard";

  const handleSignOut = () => {
    if (isDemo) {
      disableDemo();
      navigate("/auth");
    } else {
      signOut();
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <Link to={homePath} className="flex items-center gap-2">
            <img src="/Fork.png" className="h-5 w-5" />
            <span className="font-serif text-lg font-bold tracking-tight">
              ProngGSD
            </span>
            {isCrashCourseMode && (
              <span className="text-[10px] font-medium text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
                PREP
              </span>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive(item.path) ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            {/* Crash Course header button */}
            {isCrashCourseMode ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground flex"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Back to Learning</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white flex"
                onClick={handleCrashCourseClick}
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Crash Course</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
        <div className="flex justify-around py-2">
          {navItems
            .filter((item) => item.mobileVisible)
            .map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex-col gap-0.5 h-auto py-1.5 px-2 ${isActive(item.path) ? "text-accent" : "text-muted-foreground"}`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="text-[10px] truncate max-w-[48px]">
                    {item.label}
                  </span>
                </Button>
              </Link>
            ))}
        </div>
      </nav>

      <main className="container pb-20 md:pb-8 pt-6">{children}</main>

      <footer className="border-t border-border py-4 text-center pb-20 md:pb-4">
        <Link
          to="/about"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          About ProngGSD
        </Link>
      </footer>
    </div>
  );
};
