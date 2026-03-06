/**
 * LX-OS Hub VS Code Extension — Entrypoint
 *
 * Registers:
 * - Prompt Library sidebar tree view
 * - Recent Runs tree view
 * - DSL lint diagnostics (real-time via /suggest)
 * - Run prompt command (opens webview with results)
 * - Open in browser command
 * - Set API key command
 */
import * as vscode from 'vscode';
import { api } from './api';
import { PromptLibraryProvider, PromptNode } from './promptsPanel';
import { createLintProvider } from './lintProvider';
import { runPromptFromEditor } from './runPanel';

export function activate(context: vscode.ExtensionContext): void {
  console.log('LX-OS Hub extension activating…');

  // ── Diagnostics collection ──────────────────────────────────
  const diagnostics = vscode.languages.createDiagnosticCollection('lxos-hub');
  context.subscriptions.push(diagnostics);

  // ── Prompt Library sidebar ──────────────────────────────────
  const libraryProvider = new PromptLibraryProvider();
  vscode.window.registerTreeDataProvider('lxosHub.promptLibrary', libraryProvider);

  // ── Recent Runs sidebar (simple tree) ──────────────────────
  const runsProvider: vscode.TreeDataProvider<vscode.TreeItem> = {
    onDidChangeTreeData: new vscode.EventEmitter<void>().event,
    getTreeItem: (el) => el,
    getChildren: async () => {
      try {
        const data = await api.listRuns(10);
        const runs = data.runs ?? [];
        if (runs.length === 0) return [new vscode.TreeItem('No runs yet')];
        return runs.map(r => {
          const icon = r.status === 'succeeded' ? '✓' : r.status === 'failed' ? '✗' : '⏳';
          const item = new vscode.TreeItem(`${icon} ${r.model || 'run'}`);
          item.description = r.status;
          item.tooltip = `${r.id}\nLatency: ${r.latency_ms ?? '—'}ms`;
          item.iconPath = new vscode.ThemeIcon(
            r.status === 'succeeded' ? 'pass' : r.status === 'failed' ? 'error' : 'sync~spin',
          );
          return item;
        });
      } catch {
        return [new vscode.TreeItem('API unreachable')];
      }
    },
  };
  vscode.window.registerTreeDataProvider('lxosHub.recentRuns', runsProvider);

  // ── Benchmarks sidebar ──────────────────────────────────────
  const benchProvider: vscode.TreeDataProvider<vscode.TreeItem> = {
    onDidChangeTreeData: new vscode.EventEmitter<void>().event,
    getTreeItem: (el) => el,
    getChildren: async () => {
      try {
        const benches = await api.listBenchmarks();
        if (!benches.length) return [new vscode.TreeItem('No benchmarks')];
        return benches.map(b => {
          const item = new vscode.TreeItem(b.title);
          item.iconPath = new vscode.ThemeIcon('beaker');
          item.description = b.description?.slice(0, 40) || '';
          return item;
        });
      } catch {
        return [new vscode.TreeItem('API unreachable')];
      }
    },
  };
  vscode.window.registerTreeDataProvider('lxosHub.benchmarks', benchProvider);

  // ── Lint provider ───────────────────────────────────────────
  const lintDisposables = createLintProvider(diagnostics);
  context.subscriptions.push(...lintDisposables);

  // ── Commands ────────────────────────────────────────────────

  // Run prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.runPrompt', (node?: PromptNode) => {
      const pvId = node?.prompt?.id;
      runPromptFromEditor(context, pvId);
    }),
  );

  // Lint current DSL file
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.lintDsl', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open a .yaml or .lxdsl file first');
        return;
      }
      const dsl = editor.document.getText();
      try {
        const result = await api.suggest(dsl, 'lint_only');
        const count = result.suggestions?.length ?? 0;
        vscode.window.showInformationMessage(
          count === 0 ? 'LX-OS Hub: No lint issues found ✓' : `LX-OS Hub: ${count} suggestion(s) — see Problems panel`,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`LX-OS Hub lint failed: ${msg}`);
      }
    }),
  );

  // Refresh library
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.refreshLibrary', () => {
      libraryProvider.refresh();
      vscode.window.showInformationMessage('LX-OS Hub: Library refreshed');
    }),
  );

  // Open in browser
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.openInHub', (node?: PromptNode) => {
      const base = vscode.workspace
        .getConfiguration('lxosHub')
        .get<string>('apiBase', 'http://localhost:8000')
        .replace(':8000', ':3000');
      const path = node?.prompt ? `/library/${node.prompt.id}` : '/';
      vscode.env.openExternal(vscode.Uri.parse(`${base}${path}`));
    }),
  );

  // Set API key via input box (stores in workspace secrets)
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your LX-OS Hub session token or API key',
        placeHolder: 'lxos_sess_... or raw API key',
        password: true,
      });
      if (key !== undefined) {
        await vscode.workspace.getConfiguration('lxosHub').update('apiKey', key, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('LX-OS Hub: API key saved ✓');
        libraryProvider.refresh();
      }
    }),
  );

  // Create prompt from selection
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.createPrompt', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('Select some DSL YAML text first');
        return;
      }
      const selected = editor.document.getText(editor.selection);
      const title = await vscode.window.showInputBox({ prompt: 'Prompt title' });
      if (!title) return;
      try {
        const prompt = await api.createPrompt({ title, dsl_yaml: selected, visibility: 'private' });
        vscode.window.showInformationMessage(`LX-OS Hub: Prompt "${title}" created (ID: ${prompt.id})`);
        libraryProvider.refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`Failed to create prompt: ${msg}`);
      }
    }),
  );

  // Fork prompt
  context.subscriptions.push(
    vscode.commands.registerCommand('lxosHub.forkPrompt', async (node?: PromptNode) => {
      const id = node?.prompt?.id;
      if (!id) {
        vscode.window.showWarningMessage('Select a prompt in the Library panel to fork');
        return;
      }
      try {
        const result = await api.forkPrompt(id);
        vscode.window.showInformationMessage(`LX-OS Hub: Forked → new prompt ID ${result.fork_id}`);
        libraryProvider.refresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`Fork failed: ${msg}`);
      }
    }),
  );

  // ── Status bar item ─────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(database) LX-OS';
  statusBar.tooltip = 'LX-OS Hub — click to refresh library';
  statusBar.command = 'lxosHub.refreshLibrary';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // ── Verify API connection on activation ─────────────────────
  api.health().then(h => {
    statusBar.text = `$(database) LX-OS [${h.provider}]`;
    statusBar.tooltip = `LX-OS Hub v${h.version} — provider: ${h.provider}`;
  }).catch(() => {
    statusBar.text = '$(database) LX-OS [offline]';
    statusBar.tooltip = 'LX-OS Hub — API unreachable. Check lxosHub.apiBase setting.';
  });

  console.log('LX-OS Hub extension activated');
}

export function deactivate(): void {}
