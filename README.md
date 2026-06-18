# AI Autocomplete

A tiny VS Code extension for inline code completion, nothing else.

Works with any OpenAI-compatible provider. You bring your own API key.

**Full privacy:** No tracking or telemetry. Only communicates with your chosen API provider.

## Quick start

1. Set your backend in the VS Code settings:
   - `aiAutocomplete.apiBaseUrl` — e.g. `https://api.mistral.ai/v1`
   - `aiAutocomplete.model` — e.g. `codestral-latest`
2. Run **AI Autocomplete: Set API Key** from the command palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Start typing. Completions appear as ghost text; `Tab` to accept. Use `Alt+\` to trigger manually.

## Essential settings

| Setting                     | Example                     | Notes                                                                           |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `aiAutocomplete.apiBaseUrl` | `https://api.mistral.ai/v1` | OpenAI-compatible base URL, usually ending in `/v1`                             |
| `aiAutocomplete.model`      | `codestral-latest`          | The model name                                                                  |
| _API key_                   | `…`                         | Set via the **AI Autocomplete: Set API Key** command; stored in the OS keychain |

Additional settings are available but don't usually need to be changed.

## License

[AGPL-3.0](LICENSE)
