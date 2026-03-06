"use client";
/**
 * ThemeProvider — fetches active theme tokens from /theme/css,
 * injects them as a <style> tag into :root, and re-applies on change.
 * Uses /theme/site-config (public, no auth) for branding/nav config.
 */
import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

type ThemeCtx = {
  tokens: Record<string, string>;
  siteName: string;
  siteTagline: string;
  logoUrl: string;
  navItems: Record<string, boolean>;
  refresh: () => void;
};

const Ctx = createContext<ThemeCtx>({
  tokens: {}, siteName: "LX-OS Hub", siteTagline: "", logoUrl: "",
  navItems: {}, refresh: () => {},
});

export function useTheme() { return useContext(Ctx); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] = useState<Record<string, string>>({});
  // site-config: flat key→value (branding + nav only, public endpoint)
  const [siteConfig, setSiteConfig] = useState<Record<string, string>>({});

  const applyCSS = useCallback((css: string) => {
    let el = document.getElementById("lxos-theme-vars") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "lxos-theme-vars";
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Inject live CSS tokens (design tokens only, public)
      const cssRes = await fetch(`${API}/theme/css`, { cache: "no-store" });
      if (cssRes.ok) applyCSS(await cssRes.text());

      // Fetch token map for JS access
      const tokRes = await fetch(`${API}/theme/tokens`, { cache: "no-store" });
      if (tokRes.ok) setTokens(await tokRes.json());

      // Fetch site config (public — branding + nav only, no auth required)
      const cfgRes = await fetch(`${API}/theme/site-config`, { cache: "no-store" });
      if (cfgRes.ok) setSiteConfig(await cfgRes.json());
    } catch { /* api not ready yet */ }
  }, [applyCSS]);

  useEffect(() => { refresh(); }, [refresh]);

  const g = (k: string, fallback = "") => siteConfig[k] ?? fallback;

  const value: ThemeCtx = {
    tokens,
    siteName:    g("site_name",     "LX-OS Hub"),
    siteTagline: g("site_tagline",  "AI Prompt Engineering Workspace"),
    logoUrl:     g("site_logo_url", ""),
    navItems: {
      feed:       g("nav_show_feed",     "true") === "true",
      library:    g("nav_show_library",  "true") === "true",
      lab:        g("nav_show_lab",      "true") === "true",
      benchmarks: g("nav_show_bench",    "true") === "true",
      optimize:   g("nav_show_optimize", "true") === "true",
    },
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
