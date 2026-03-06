/**
 * Run Panel — executes prompts from VS Code and shows results.
 * Opens a webview panel with the run output, score, and token usage.
 */
import * as vscode from 'vscode';
import { api, Run } from './api';

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;

export async function runPromptFromEditor(
  context: vscode.ExtensionContext,
  promptVersionId?: string,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  // If no version ID given, ask user
  let pvId = promptVersionId;
  if (!pvId) {
    pvId = await vscode.window.showInputBox({
      prompt: 'Enter Prompt Version ID (from LX-OS Hub library)',
      placeHolder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    });
    if (!pvId) return;
  }

  // Optional: collect inputs
  const inputsRaw = await vscode.window.showInputBox({
    prompt: 'Inputs as JSON (optional, press Enter to skip)',
    placeHolder: '{"topic": "machine learning", "tone": "casual"}',
    value: '{}',
  });
  let inputs: Record<string, unknown> = {};
  try { inputs = JSON.parse(inputsRaw || '{}'); } catch { inputs = {}; }

  // Model selection
  const model = await vscode.window.showQuickPick(
    ['gpt-4o-mini', 'gpt-4o', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6'],
    { placeHolder: 'Select model (default: gpt-4o-mini)', title: 'LX-OS Hub — Run Prompt' },
  ) ?? 'gpt-4o-mini';

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'LX-OS Hub: Queuing run…', cancellable: false },
    async () => {
      try {
        const { run_id } = await api.createRun({ prompt_version_id: pvId!, model, inputs });
        await showRunPanel(context, run_id);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`LX-OS Hub run failed: ${msg}`);
      }
    },
  );
}

async function showRunPanel(context: vscode.ExtensionContext, runId: string): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'lxosHubRun',
    `LX-OS Run`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  panel.webview.html = loadingHtml(runId);

  // Poll until complete
  let polls = 0;
  const interval = setInterval(async () => {
    polls++;
    try {
      const run = await api.getRun(runId);
      panel.webview.html = renderRunHtml(run);

      if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'refused') {
        clearInterval(interval);
        // Open in browser if user wants more detail
        panel.webview.onDidReceiveMessage(msg => {
          if (msg.command === 'openInHub') {
            const { base } = { base: vscode.workspace.getConfiguration('lxosHub').get<string>('apiBase') || 'http://localhost:8000' };
            const frontendBase = base.replace(':8000', ':3000');
            vscode.env.openExternal(vscode.Uri.parse(`${frontendBase}/runs/${runId}`));
          }
        });
      }
    } catch { /* keep polling */ }

    if (polls >= MAX_POLLS) {
      clearInterval(interval);
      panel.webview.html = errorHtml(runId, 'Timed out waiting for run result');
    }
  }, POLL_INTERVAL_MS);

  panel.onDidDispose(() => clearInterval(interval));
}

function loadingHtml(runId: string): string {
  return `<!DOCTYPE html><html><body style="background:#0c0e11;color:#e8eaf0;font-family:monospace;padding:24px">
    <h2 style="color:#5b8ff5">⏳ Run Queued</h2>
    <p style="color:#6b7385">Run ID: <code style="color:#5b8ff5">${runId}</code></p>
    <p style="color:#6b7385">Waiting for worker to pick up job…</p>
    <div class="spinner" style="margin-top:16px;color:#3ddba3">▶ Running…</div>
  </body></html>`;
}

function errorHtml(runId: string, msg: string): string {
  return `<!DOCTYPE html><html><body style="background:#0c0e11;color:#e8eaf0;font-family:monospace;padding:24px">
    <h2 style="color:#f56b6b">✗ Run Error</h2>
    <p>${msg}</p>
    <p style="color:#6b7385">Run ID: ${runId}</p>
  </body></html>`;
}

function renderRunHtml(run: Run): string {
  const statusColor = run.status === 'succeeded' ? '#3ddba3' : run.status === 'failed' ? '#f56b6b' : '#f5c543';
  const output = escHtml(run.output_text || '(no output)');

  return `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background:#0c0e11; color:#e8eaf0; font-family:'IBM Plex Mono',monospace; padding:24px; font-size:13px; }
  h2  { color:#5b8ff5; margin-bottom:16px; font-size:16px; }
  .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;
           background:${statusColor}22; color:${statusColor}; border:1px solid ${statusColor}44; margin-bottom:16px; }
  .meta  { display:flex; gap:24px; margin-bottom:20px; flex-wrap:wrap; }
  .meta span { color:#6b7385; font-size:12px; }
  .meta strong { color:#e8eaf0; }
  .output { background:#12151a; border:1px solid #232a35; border-radius:8px;
            padding:16px; white-space:pre-wrap; line-height:1.6; color:#c8d0df;
            max-height:480px; overflow-y:auto; }
  .btn { margin-top:16px; background:#1e2330; border:1px solid #5b8ff5; color:#5b8ff5;
         padding:7px 16px; border-radius:6px; cursor:pointer; font-family:inherit; font-size:12px; }
  .btn:hover { background:#5b8ff5; color:#0c0e11; }
</style>
</head>
<body>
  <h2>LX-OS Hub — Run Result</h2>
  <div class="badge">${run.status.toUpperCase()}</div>

  <div class="meta">
    <span>Model: <strong>${run.model || '—'}</strong></span>
    <span>Latency: <strong>${run.latency_ms ? run.latency_ms + ' ms' : '—'}</strong></span>
    <span>Tokens in: <strong>${run.tokens_in ?? '—'}</strong></span>
    <span>Tokens out: <strong>${run.tokens_out ?? '—'}</strong></span>
    <span>Cost: <strong>${run.cost_usd != null ? '$' + run.cost_usd.toFixed(6) : '—'}</strong></span>
    <span>ID: <strong style="color:#5b8ff5">${run.id}</strong></span>
  </div>

  <div class="output">${output}</div>
  <button class="btn" onclick="acquireVsCodeApi().postMessage({command:'openInHub'})">
    Open full run in LX-OS Hub →
  </button>

  <script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => {
      vscode.postMessage({ command: 'openInHub' });
    }));
  </script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
