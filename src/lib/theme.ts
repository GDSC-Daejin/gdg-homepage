"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "auto";

const STORAGE_KEY = "theme";

function apply(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("auto");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "auto";
    setThemeState(stored);
    apply(stored);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(STORAGE_KEY) as Theme | null ?? "auto") === "auto") {
        apply("auto");
      }
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    apply(next);
  }, []);

  return { theme, setTheme };
}
