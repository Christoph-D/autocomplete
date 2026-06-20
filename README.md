# AI Autocomplete

A tiny VS Code extension for inline code completion, nothing else.

Works with any OpenAI-compatible provider. You bring your own API key.

**Full privacy:** No tracking or telemetry. Only communicates with your chosen API provider.

## Quick start

1. Run **AI Autocomplete: Select Provider** from the command palette (Ctrl+Shift+P or Cmd+Shift+P) and pick a provider
   (Mistral, Z.ai, Deepseek, OpenRouter, or **Custom provider** for any other endpoint).
2. When prompted, enter your **API key** (stored securely in the OS keychain) and the **model** you want to use.
3. Start typing. Completions appear as ghost text; `Tab` to accept. Use `Ctrl+Alt+Space` (mac: `Cmd+Alt+Space`) to
   trigger manually.

## Providers

Each provider remembers its own API key and model. Switch between them any time via **Select Provider** — the key and
model for the provider you leave are restored when you come back.

| Provider        | Base URL                       | Suggested model                |
| --------------- | ------------------------------ | ------------------------------ |
| Mistral         | `https://api.mistral.ai/v1`    | `codestral-latest`             |
| Z.ai            | `https://api.z.ai/api/paas/v4` | `glm-5.2`                      |
| Deepseek        | `https://api.deepseek.com`     | `deepseek-v4-flash`            |
| OpenRouter      | `https://openrouter.ai/api/v1` | _any model you have access to_ |
| Custom provider | _your own URL_                 | _your model_                   |

For the **Custom provider**, you'll be asked for an OpenAI-compatible base URL (usually ending in `/v1`). This works
with OpenAI, Ollama, LM Studio, and any other compatible backend.

The status bar shows the active provider and model, e.g. `AI: Mistral · codestral-latest`. Click it to switch provider.

## Settings

Most settings are driven by provider selection and rarely need manual editing:

| Setting                           | Notes                                                                               |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `aiAutocomplete.provider`         | Active provider id (`mistral`, `zai`, `deepseek`, `openrouter`, `custom`)           |
| `aiAutocomplete.apiBaseUrl`       | Effective base URL; set automatically per provider                                  |
| `aiAutocomplete.model`            | Effective model; remembered per provider                                            |
| `aiAutocomplete.providerProfiles` | Remembered per-provider overrides (model/base URL) — managed by **Select Provider** |
| _API key_                         | Per-provider, stored in the OS keychain via **Set API Key**                         |

Additional settings (context size, temperature, delay, logging, etc.) are available but don't usually need to be
changed.

## License

[AGPL-3.0](LICENSE)
