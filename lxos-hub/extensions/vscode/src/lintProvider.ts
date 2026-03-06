/**
 * DSL Lint Diagnostics Provider.
 * Calls /suggest on the Hub API when a .yaml or .lxdsl file is saved.
 * Surfaces errors/warnings directly in the Problems panel and inline.
 */
import * as vscode from 'vscode';
import { api } from './api';

// Debounce timer — don't hammer the API on every keystroke
const DEBOUNCE_MS = 800;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Map Hub severity to VS Code DiagnosticSeverity
function severity(s: string): vscode.DiagnosticSeverity {
  if (s === 'error')   return vscode.DiagnosticSeverity.Error;
  if (s === 'warning') return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
}

// Find line number for a YAML key path like "prompt_system.pipeline[0].type"
function findLine(doc: vscode.TextDocument, path: string | undefined): number {
  if (!path) return 0;
  const key = path.split('.').pop()?.replace(/\[\d+\]/, '') || '';
  for (let i = 0; i < doc.lineCount; i++) {
    if (doc.lineAt(i).text.includes(key + ':')) return i;
  }
  return 0;
}

export function createLintProvider(
  diagnostics: vscode.DiagnosticCollection,
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];

  async function lintDoc(doc: vscode.TextDocument) {
    const ext = doc.fileName.split('.').pop()?.toLowerCase();
    if (!['yaml', 'yml', 'lxdsl'].includes(ext ?? '')) return;

    const autoLint = vscode.workspace
      .getConfiguration('lxosHub')
      .get<boolean>('autoLint', true);
    if (!autoLint) return;

    const dsl_yaml = doc.getText();
    // Only lint files that look like LX-DSL (contain lxos_version)
    if (!dsl_yaml.includes('lxos_version') && !dsl_yaml.includes('prompt_system')) return;

    try {
      const result = await api.suggest(dsl_yaml, 'lint_only');
      const diags: vscode.Diagnostic[] = (result.suggestions || []).map(s => {
        const line = findLine(doc, s.path);
        const range = new vscode.Range(line, 0, line, doc.lineAt(line).text.length);
        const d = new vscode.Diagnostic(range, `[LX-OS] ${s.message}`, severity(s.severity));
        d.source = 'LX-OS Hub';
        d.code   = s.rule;
        return d;
      });
      diagnostics.set(doc.uri, diags);
    } catch {
      // API unreachable — clear diagnostics, don't spam errors
      diagnostics.delete(doc.uri);
    }
  }

  // Debounced lint on change
  disposables.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      const key = e.document.uri.toString();
      if (timers.has(key)) clearTimeout(timers.get(key)!);
      timers.set(key, setTimeout(() => lintDoc(e.document), DEBOUNCE_MS));
    }),
  );

  // Immediate lint on save
  disposables.push(
    vscode.workspace.onDidSaveTextDocument(doc => lintDoc(doc)),
  );

  // Lint on open
  disposables.push(
    vscode.workspace.onDidOpenTextDocument(doc => lintDoc(doc)),
  );

  // Clean up diagnostics on close
  disposables.push(
    vscode.workspace.onDidCloseTextDocument(doc => diagnostics.delete(doc.uri)),
  );

  return disposables;
}
