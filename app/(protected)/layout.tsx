import { AppThemeProvider } from "@/contexts/app-theme-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AppThemeProvider>{children}</AppThemeProvider>;
}
