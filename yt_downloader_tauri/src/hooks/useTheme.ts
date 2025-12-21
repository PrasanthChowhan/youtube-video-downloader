/** Theme management hook with system preference detection */

import { useState, useEffect, useCallback } from "react";

export type ThemeOption = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "app-theme";

/**
 * Detects the system color scheme preference
 */
function getSystemTheme(): ResolvedTheme {
    if (typeof window !== "undefined" && window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark"; // Default to dark
}

/**
 * Applies the theme to the document root
 */
function applyTheme(theme: ResolvedTheme) {
    const root = document.documentElement;
    if (theme === "light") {
        root.setAttribute("data-theme", "light");
    } else {
        root.removeAttribute("data-theme");
    }
}

/**
 * Get the stored theme preference
 */
function getStoredTheme(): ThemeOption {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
            return stored;
        }
    }
    return "system";
}

export function useTheme() {
    const [theme, setThemeState] = useState<ThemeOption>(getStoredTheme);
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        const stored = getStoredTheme();
        return stored === "system" ? getSystemTheme() : stored;
    });

    // Apply theme on mount and when it changes
    useEffect(() => {
        const resolved: ResolvedTheme = theme === "system" ? getSystemTheme() : theme;
        setResolvedTheme(resolved);
        applyTheme(resolved);
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    // Listen for system theme changes
    useEffect(() => {
        if (theme !== "system") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e: MediaQueryListEvent) => {
            const newTheme: ResolvedTheme = e.matches ? "dark" : "light";
            setResolvedTheme(newTheme);
            applyTheme(newTheme);
        };

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, [theme]);

    const setTheme = useCallback((newTheme: ThemeOption) => {
        setThemeState(newTheme);
    }, []);

    return {
        theme,
        resolvedTheme,
        setTheme,
        isDark: resolvedTheme === "dark",
        isLight: resolvedTheme === "light",
    };
}
