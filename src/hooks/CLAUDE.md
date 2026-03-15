# src/hooks/ — Agent Context

## All Hooks

| File | Hook | Exports | Purpose |
|------|------|---------|---------|
| useAuth.tsx | useAuth | `AuthProvider`, `useAuth` → `{ session, user, loading, signOut }` | Supabase auth state management. Wraps the app as a provider. |
| useDemo.tsx | useDemo | `DemoProvider`, `useDemo` → `{ isDemo, enableDemo, disableDemo }` + `DEMO_*` fixtures | Demo mode. Gates entire app into read-only state with hardcoded sample data. No auth required. |
| useTheme.tsx | useTheme | `ThemeProvider`, `useTheme` → `{ theme, toggleTheme }` | Dark/light theme. Stored in `localStorage` under `pronggsd-theme`. Default: `dark`. Toggles `dark` class on `<html>`. |
| useMentorName.tsx | useMentorName | `{ mentorName, setMentorName, loading }` | Fetches mentor name from `user_profile.mentor_name`. Demo fallback: `"Sage"`. |
| use-mobile.tsx | useIsMobile | `useIsMobile` → `boolean` | Returns `true` when viewport width < 768px. |
| use-toast.ts | useToast | `useToast`, `toast`, toast reducer | Toast notification state management (used by the Radix toast component). |
| ~~useUnitGeneration.tsx~~ | — | — | **Removed in Phase 4.** File deleted in Phase 8. |
