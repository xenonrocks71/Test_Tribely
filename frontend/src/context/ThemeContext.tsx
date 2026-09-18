"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

interface ThemeContextType {
  theme: ResolvedTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isMounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [isMounted, setIsMounted] = useState(false);

  const getSystemTheme = useCallback((): ResolvedTheme => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  const applyThemeToDOM = useCallback((activeTheme: ResolvedTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (activeTheme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, []);

  const resolveAndApply = useCallback((mode: ThemeMode) => {
    const nextResolved = mode === "system" ? getSystemTheme() : mode;
    setResolvedTheme(nextResolved);
    applyThemeToDOM(nextResolved);
  }, [getSystemTheme, applyThemeToDOM]);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("tribely_theme") as ThemeMode | null;
    const initialMode: ThemeMode =
      saved === "dark" || saved === "light" || saved === "system"
        ? saved
        : "dark";

    setThemeModeState(initialMode);
    resolveAndApply(initialMode);

    // Listen to system OS preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentSaved = localStorage.getItem("tribely_theme") as ThemeMode | null;
      if (currentSaved === "system" || !currentSaved) {
        const sys = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(sys);
        applyThemeToDOM(sys);
      }
    };

    try {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } catch {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [resolveAndApply, applyThemeToDOM]);

  const setThemeMode = useCallback((newMode: ThemeMode) => {
    setThemeModeState(newMode);
    localStorage.setItem("tribely_theme", newMode);
    try {
      document.cookie = `tribely_theme=${encodeURIComponent(newMode)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
    resolveAndApply(newMode);
  }, [resolveAndApply]);

  const toggleTheme = useCallback(() => {
    const nextResolved = resolvedTheme === "dark" ? "light" : "dark";
    setThemeMode(nextResolved);
  }, [resolvedTheme, setThemeMode]);

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themeMode,
        setThemeMode,
        setTheme: setThemeMode,
        toggleTheme,
        isMounted,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
