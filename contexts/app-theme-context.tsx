"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type AppThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
};

const APP_THEME_STORAGE_KEY = "drawgle-app-theme";
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      return storedTheme;
    }

    return "system";
  });
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    document.body.classList.toggle("dark", resolvedTheme === "dark");
    document.body.style.colorScheme = resolvedTheme;

    return () => {
      document.body.classList.remove("dark");
      document.body.style.removeProperty("color-scheme");
    };
  }, [resolvedTheme]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
      },
    }),
    [resolvedTheme, theme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <div className={cn("contents dg-app-theme", resolvedTheme === "dark" && "dark")}>
        {children}
      </div>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider.");
  }

  return context;
}
