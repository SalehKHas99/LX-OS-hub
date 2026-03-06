"use client";
/**
 * AdminGuard — wraps any page that requires admin/owner role.
 * - While auth is resolving: shows a neutral loading state (no flash of content).
 * - If role < admin: shows a 403 wall with no admin content rendered at all.
 * - Only renders children when role is confirmed admin/owner.
 */
import React from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  // Auth still resolving — render nothing (no flash)
  if (!auth.ready) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "var(--bg)", fontFamily: "var(--mono)",
        fontSize: 12, color: "var(--text-dim)",
      }}>
        Authenticating…
      </div>
    );
  }

  // Confirmed non-admin — hard wall, no admin UI rendered
  if (!auth.isAdmin) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--bg)", display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "var(--sans)",
      }}>
        <div style={{
          width: 400, padding: 40, textAlign: "center",
          background: "var(--bg-panel)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(245,107,107,0.1)", border: "1px solid var(--red)40",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, margin: "0 auto 20px",
          }}>
            🔒
          </div>

          <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
            Access Denied
          </h2>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            This area requires <strong style={{ color: "var(--text)" }}>Admin</strong> or{" "}
            <strong style={{ color: "var(--text)" }}>Owner</strong> role.
          </p>
          <p style={{ margin: "0 0 28px", fontSize: 12, color: "var(--text-dim)" }}>
            Your current role:{" "}
            <span style={{
              fontFamily: "var(--mono)", padding: "2px 8px",
              background: "var(--bg-elevated)", borderRadius: 4,
              color: "var(--text-muted)", border: "1px solid var(--border)",
            }}>
              {auth.role || "unauthenticated"}
            </span>
          </p>

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/" style={{
              padding: "10px 20px", background: "var(--accent)", color: "#fff",
              borderRadius: "var(--radius-sm)", textDecoration: "none",
              fontSize: 13, fontWeight: 700,
            }}>
              Go Home
            </Link>
            {!auth.role && (
              <Link href="/auth/login" style={{
                padding: "10px 20px", background: "var(--bg-elevated)",
                color: "var(--text-muted)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", textDecoration: "none", fontSize: 13,
              }}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Role confirmed — render admin content
  return <>{children}</>;
}
