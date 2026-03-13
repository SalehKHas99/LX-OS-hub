import { create } from 'zustand'
import type { User } from '../types'
import { authApi } from '../api'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (login: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: async (login, password) => {
    set({ isLoading: true })
    try {
      const { data } = await authApi.login({ login, password })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const { data: user } = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (e) { set({ isLoading: false }); throw e }
  },

  register: async (username, email, password) => {
    set({ isLoading: true })
    try {
      const { data } = await authApi.register({ username, email, password })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      const { data: user } = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch (e) { set({ isLoading: false }); throw e }
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return
    try {
      const { data } = await authApi.me()
      set({ user: data, isAuthenticated: true })
    } catch {
      localStorage.clear()
      set({ user: null, isAuthenticated: false })
    }
  },
}))

// ── Theme store — persists to localStorage, syncs with html class ────────────
// Andromeda — always dark (galaxy theme)
const initialDark = true

// Apply immediately on load
if (initialDark) {
  document.documentElement.classList.add('dark')
  document.documentElement.classList.remove('light')
} else {
  document.documentElement.classList.add('light')
  document.documentElement.classList.remove('dark')
}

interface ThemeState {
  dark: boolean
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  dark: initialDark,
  toggle: () => {
    const next = !get().dark
    set({ dark: next })
    if (next) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', next ? 'dark' : 'light')
  },
}))
