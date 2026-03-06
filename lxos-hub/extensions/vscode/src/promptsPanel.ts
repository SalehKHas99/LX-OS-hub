/**
 * Prompt Library sidebar tree view.
 * Displays prompts grouped by category with search and fork support.
 */
import * as vscode from 'vscode';
import { api, Prompt } from './api';

// ── Tree node types ──────────────────────────────────────────

export type NodeKind = 'category' | 'prompt';

export class PromptNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: NodeKind,
    public readonly prompt?: Prompt,
    public readonly collapsible = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsible);

    if (kind === 'prompt' && prompt) {
      this.tooltip    = prompt.description || prompt.title;
      this.description = prompt.aggregate_score > 0
        ? `score ${prompt.aggregate_score.toFixed(2)}`
        : prompt.visibility;
      this.contextValue = 'prompt';
      this.iconPath = new vscode.ThemeIcon('symbol-function');
      this.command = {
        command: 'lxosHub.previewPrompt',
        title: 'Preview',
        arguments: [prompt.id],
      };
    } else {
      this.iconPath = new vscode.ThemeIcon('folder');
      this.contextValue = 'category';
    }
  }
}

// ── Data provider ────────────────────────────────────────────

export class PromptLibraryProvider implements vscode.TreeDataProvider<PromptNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PromptNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private prompts: Prompt[] = [];
  private searchQuery = '';

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  setSearch(q: string): void {
    this.searchQuery = q;
    this.refresh();
  }

  getTreeItem(el: PromptNode): vscode.TreeItem {
    return el;
  }

  async getChildren(element?: PromptNode): Promise<PromptNode[]> {
    // Root level — categories
    if (!element) {
      try {
        const data = this.searchQuery
          ? await api.searchPrompts(this.searchQuery)
          : await api.listPrompts('', 100);

        this.prompts = this.searchQuery
          ? (data as { results: Prompt[] }).results
          : (data as { prompts: Prompt[] }).prompts ?? [];

        // Group by category
        const cats = new Map<string, Prompt[]>();
        for (const p of this.prompts) {
          const cat = p.category || 'uncategorized';
          if (!cats.has(cat)) cats.set(cat, []);
          cats.get(cat)!.push(p);
        }

        if (cats.size === 0) {
          return [new PromptNode('No prompts found', 'category')];
        }

        return [...cats.entries()].map(([cat, ps]) =>
          new PromptNode(
            `${cat}  (${ps.length})`,
            'category',
            undefined,
            vscode.TreeItemCollapsibleState.Collapsed,
          ),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`LX-OS Hub: ${msg}`);
        return [new PromptNode('Connection failed — check API URL in settings', 'category')];
      }
    }

    // Category children — prompt nodes
    if (element.kind === 'category') {
      const rawCat = element.label.replace(/\s+\(\d+\)$/, '');
      return this.prompts
        .filter(p => (p.category || 'uncategorized') === rawCat)
        .map(p => new PromptNode(p.title, 'prompt', p));
    }

    return [];
  }
}
