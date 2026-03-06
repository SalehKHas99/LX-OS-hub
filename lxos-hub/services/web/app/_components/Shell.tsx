"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function NavItem({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const active = path === href || (href !== "/" && path.startsWith(href));
  return (
    <Link href={href} style={{
      display: "block", padding: "7px 12px", borderRadius: "var(--radius-sm)",
      fontSize: 13, fontWeight: active ? 700 : 500,
      color: active ? "var(--text)" : "var(--text-muted)",
      background: active ? "var(--bg-hover)" : "transparent",
      textDecoration: "none",
      borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
      transition: "all var(--ease)",
    }}>
      {label}
    </Link>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        color: "var(--text-dim)", padding: "0 12px", marginBottom: 4,
        textTransform: "uppercase",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function Shell({ title, children }: { title?: string; children: React.ReactNode }) {
  const auth = useAuth();
  const theme = useTheme();
  const nav = theme.navItems;

  function handleSignOut() {
    const token = typeof window !== "undefined" ? localStorage.getItem("lxos_api_key") : null;
    if (token?.startsWith("lxos_sess_")) {
      fetch(`${API}/auth/logout`, {
        method: "POST", headers: { authorization: `Bearer ${token}` },
      }).finally(() => {
        localStorage.removeItem("lxos_api_key");
        localStorage.removeItem("lxos_session_token");
        window.location.href = "/auth/login";
      });
    } else {
      window.location.href = "/auth/login";
    }
  }

  const isSignedIn = typeof window !== "undefined" &&
    !!localStorage.getItem("lxos_api_key");

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      background: "var(--bg)", color: "var(--text)", fontFamily: "var(--sans)",
    }}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <nav style={{
        width: 228, flexShrink: 0, borderRight: "1px solid var(--border)",
        background: "var(--bg-panel)", padding: "20px 10px",
        display: "flex", flexDirection: "column", gap: 0,
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        {/* Logo / Site name */}
        <Link href="/" style={{ display: "block", padding: "0 12px 22px", textDecoration: "none" }}>
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt={theme.siteName}
              style={{ height: 28, objectFit: "contain", maxWidth: 160 }} />
          ) : (
            <span style={{
              fontFamily: "var(--mono)", fontWeight: 800, fontSize: 15,
              color: "var(--accent)", letterSpacing: 1,
            }}>
              {theme.siteName}
            </span>
          )}
        </Link>

        <NavGroup label="Discover">
          <NavItem href="/" label="Home" />
          {nav.feed    !== false && <NavItem href="/feed"    label="Feed" />}
          {nav.library !== false && <NavItem href="/library" label="Library" />}
          {nav.lab     !== false && <NavItem href="/lab"     label="Lab" />}
          <NavItem href="/me" label="Profile" />
        </NavGroup>

        <NavGroup label="Build">
          <NavItem href="/app"  label="Studio" />
          <NavItem href="/runs" label="Runs" />
          {nav.benchmarks !== false && <NavItem href="/benchmarks" label="Benchmarks" />}
          {nav.optimize   !== false && <NavItem href="/optimize"   label="Optimizer" />}
        </NavGroup>

        <NavGroup label="Govern">
          <NavItem href="/studio" label="Governance" />
          {auth.can("integrations:read") && <NavItem href="/integrations" label="Integrations" />}
          {auth.can("access:read")       && <NavItem href="/access"       label="Access" />}
        </NavGroup>

        <NavGroup label="System">
          {auth.ready && auth.isAdmin && <NavItem href="/admin" label="⚙ Admin" />}
          <NavItem href="/setup" label="Setup" />
        </NavGroup>

        {/* User footer */}
        <div style={{
          marginTop: "auto", padding: "12px",
          borderTop: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)", marginBottom: 8 }}>
            {auth.ready ? `role: ${auth.role || "guest"}` : "…"}
          </div>
          <button
            onClick={handleSignOut}
            style={{
              width: "100%", background: "none",
              border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              padding: "5px 10px", color: "var(--text-muted)",
              cursor: "pointer", fontSize: 11, textAlign: "left",
            }}
          >
            {isSignedIn ? "Sign out" : "Sign in →"}
          </button>
        </div>
      </nav>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "32px 36px", overflowX: "auto", minWidth: 0 }}>
        {title && (
          <h1 style={{
            margin: "0 0 26px", fontSize: 22, fontWeight: 800, letterSpacing: -0.5,
            color: "var(--text)",
          }}>
            {title}
          </h1>
        )}
        {children}
      </main>
    </div>
  );
}
