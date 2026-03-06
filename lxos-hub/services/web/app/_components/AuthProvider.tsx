"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiGet } from "./api";

export type UserRole = "viewer" | "editor" | "admin" | "owner" | "";

type AuthState = {
  role: UserRole;
  userId: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  scopes: string[];
  ready: boolean;
  can: (scope: string) => boolean;
  roleAtLeast: (role: UserRole) => boolean;
  isAdmin: boolean;
  refresh: () => void;
};

const ROLE_ORDER: Record<string, number> = {
  "": 0, viewer: 1, editor: 2, admin: 3, owner: 4,
};

// Safe default — no permissions until /auth/me resolves
const DEFAULT: AuthState = {
  role: "", userId: "", email: "", username: "",
  displayName: "", avatarUrl: "", scopes: [],
  ready: false,
  can: () => false,
  roleAtLeast: () => false,
  isAdmin: false,
  refresh: () => {},
};

const Ctx = createContext<AuthState>(DEFAULT);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "can" | "roleAtLeast" | "isAdmin" | "refresh">>({
    role: "", userId: "", email: "", username: "",
    displayName: "", avatarUrl: "", scopes: [], ready: false,
  });

  const load = async () => {
    try {
      const me = await apiGet("/auth/me");
      setState({
        role:        (me.role        || "viewer") as UserRole,
        userId:      me.user_id      || "",
        email:       me.email        || "",
        username:    me.username     || "",
        displayName: me.display_name || "",
        avatarUrl:   me.avatar_url   || "",
        scopes:      me.scopes       || [],
        ready: true,
      });
    } catch {
      // API unreachable or unauthenticated — stay as empty/ready
      setState(s => ({ ...s, role: "viewer", ready: true }));
    }
  };

  useEffect(() => { load(); }, []);

  const value: AuthState = {
    ...state,
    can: (scope) => state.scopes.includes(scope),
    roleAtLeast: (r) =>
      (ROLE_ORDER[state.role] ?? 0) >= (ROLE_ORDER[r] ?? 999),
    isAdmin: (ROLE_ORDER[state.role] ?? 0) >= ROLE_ORDER.admin,
    refresh: load,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
