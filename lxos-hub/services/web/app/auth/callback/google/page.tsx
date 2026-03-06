"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GoogleCallback() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("session_token");
    if (token) {
      localStorage.setItem("lxos_session_token", token);
      localStorage.setItem("lxos_api_key", token);
      router.push("/");
    } else {
      router.push("/auth/login?error=google_failed");
    }
  }, []);
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--sans)", color: "var(--text-muted)", fontSize: 14 }}>
      Completing sign-in…
    </div>
  );
}
