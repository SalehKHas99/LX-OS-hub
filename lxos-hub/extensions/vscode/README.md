# LX-OS Hub — VS Code Extension

Browse, run, lint, and create LX-DSL prompts directly from VS Code.

## Features

- **Prompt Library sidebar** — browse all Hub prompts grouped by category
- **Run panel** — execute any prompt version, view output + token usage in a webview
- **DSL lint diagnostics** — real-time lint errors/warnings from the Hub suggestions engine shown in the Problems panel
- **Create from selection** — select DSL YAML in the editor, push to Hub in one command
- **Fork prompts** — fork any library prompt directly from the sidebar
- **Open in Hub** — jump to any prompt's full page in the browser

## Setup

### 1. Install

```bash
cd extensions/vscode
npm install
npm run package        # produces lxos-hub-0.1.0.vsix
code --install-extension lxos-hub-0.1.0.vsix
```

Or install from the VS Code marketplace (when published).

### 2. Configure

Open VS Code Settings (`Ctrl+,`) and search for `lxosHub`:

| Setting | Default | Description |
|---|---|---|
| `lxosHub.apiBase` | `http://localhost:8000` | LX-OS Hub API URL |
| `lxosHub.apiKey` | `` | Session token (`lxos_sess_...`) or API key |
| `lxosHub.autoLint` | `true` | Auto-lint `.yaml`/`.lxdsl` files on save |

Or run the command **LX-OS Hub: Set API Key / Session Token** to save your token.

### 3. Get a session token

Log into your Hub instance, open browser DevTools → Application → Local Storage, copy `lxos_api_key`.

## Commands

| Command | Description |
|---|---|
| `LX-OS Hub: Run Prompt` | Execute a prompt version, view results in panel |
| `LX-OS Hub: Lint DSL` | Manually lint the active file |
| `LX-OS Hub: Refresh Library` | Reload the sidebar |
| `LX-OS Hub: Set API Key` | Save your auth token |
| `LX-OS Hub: Create New Prompt from Selection` | Push selected DSL to Hub |
| `LX-OS Hub: Fork this Prompt` | Fork a library prompt |
| `LX-OS Hub: Open in Browser` | Open current prompt in the Hub web UI |

## Publishing to VS Code Marketplace

```bash
cd extensions/vscode
# Set publisher in package.json to your VS Code publisher ID
npm run package
npx @vscode/vsce publish
```
