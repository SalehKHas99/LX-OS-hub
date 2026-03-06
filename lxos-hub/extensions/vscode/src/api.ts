/**
 * LX-OS Hub API client for the VS Code extension.
 * All HTTP calls go through this module — one import, one config point.
 */
import * as vscode from 'vscode';

function cfg(): { base: string; key: string } {
  const c = vscode.workspace.getConfiguration('lxosHub');
  return {
    base: (c.get<string>('apiBase') || 'http://localhost:8000').replace(/\/$/, ''),
    key:  c.get<string>('apiKey') || '',
  };
}

function headers(): Record<string, string> {
  const { key } = cfg();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) h['Authorization'] = `Bearer ${key}`;
  return h;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { base } = cfg();
  const url = `${base}${path}`;
  const resp = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`LX-OS Hub API ${resp.status}: ${text}`);
  }
  return resp.json() as Promise<T>;
}

// ── Typed API surface ────────────────────────────────────────

export interface Prompt {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags: string[];
  visibility: string;
  aggregate_score: number;
  avg_rating: number;
  fork_count: number;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  version_num: number;
  commit_message: string;
  dsl_yaml: string;
  compiled_template: string;
  created_at: string;
}

export interface Run {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'refused';
  model: string;
  output_text?: string;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  created_at: string;
}

export interface Benchmark {
  id: string;
  title: string;
  description?: string;
  created_at: string;
}

export interface Suggestion {
  suggestions: Array<{
    rule: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    path?: string;
  }>;
}

export interface Health {
  status: string;
  provider: string;
  version: string;
}

// ── API methods ──────────────────────────────────────────────

export const api = {
  health: () => request<Health>('GET', '/health'),

  // Auth / identity
  me: () => request<{ user_id: string; role: string; email: string; username: string }>('GET', '/auth/me'),

  // Prompt library
  listPrompts: (q = '', limit = 50) =>
    request<{ prompts: Prompt[] }>('GET', `/prompts?q=${encodeURIComponent(q)}&limit=${limit}`),

  searchPrompts: (q: string, limit = 20) =>
    request<{ results: Prompt[] }>('GET', `/search?q=${encodeURIComponent(q)}&mode=hybrid&limit=${limit}`),

  getPrompt: (id: string) =>
    request<Prompt & { versions: PromptVersion[] }>('GET', `/prompts/${id}`),

  listVersions: (promptId: string) =>
    request<PromptVersion[]>('GET', `/prompts/${promptId}/versions`),

  createPrompt: (data: { title: string; description?: string; dsl_yaml?: string; visibility?: string }) =>
    request<Prompt>('POST', '/prompts', data),

  forkPrompt: (promptId: string) =>
    request<{ fork_id: string }>('POST', `/prompts/${promptId}/fork`),

  // Runs
  createRun: (data: { prompt_version_id: string; model?: string; inputs?: Record<string, unknown> }) =>
    request<{ run_id: string }>('POST', '/runs', data),

  getRun: (runId: string) =>
    request<Run>('GET', `/runs/${runId}`),

  listRuns: (limit = 20) =>
    request<{ runs: Run[] }>('GET', `/runs?limit=${limit}`),

  // DSL suggestions / lint
  suggest: (dsl_yaml: string, mode: 'lint_only' | 'lint_plus_llm' = 'lint_only') =>
    request<Suggestion>('POST', '/suggest', { dsl_yaml, mode }),

  // Benchmarks
  listBenchmarks: () =>
    request<Benchmark[]>('GET', '/benchmarks'),
};
