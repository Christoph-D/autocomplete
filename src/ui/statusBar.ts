import * as vscode from "vscode";
import type { ProviderPreset } from "../config/providers";

export type StatusState =
  | { kind: "disabled" }
  | { kind: "misconfigured" }
  | { kind: "no-key"; provider: ProviderPreset }
  | { kind: "ready"; provider: ProviderPreset; model: string }
  | { kind: "error"; message: string };

export class StatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "aiAutocomplete.selectProvider";
    this.item.show();
  }

  update(state: StatusState): void {
    switch (state.kind) {
      case "disabled":
        this.item.text = "$(circle-slash) AI: off";
        this.item.tooltip = "AI Autocomplete is disabled";
        this.item.command = "aiAutocomplete.toggleEnabled";
        break;
      case "misconfigured":
        this.item.text = "$(warning) AI: setup";
        this.item.tooltip = "AI Autocomplete is not configured — pick a provider and set a model";
        this.item.command = "aiAutocomplete.selectProvider";
        break;
      case "no-key":
        this.item.text = "$(key) AI: set key";
        this.item.tooltip = `Click to set the API key for provider ${state.provider.label}`;
        this.item.command = "aiAutocomplete.selectProvider";
        break;
      case "ready":
        this.item.text = `$(sparkle) AI: ${state.model}`;
        this.item.tooltip = `AI Autocomplete using ${state.provider.label} (${state.model}). Click to switch provider.`;
        this.item.command = "aiAutocomplete.selectProvider";
        break;
      case "error":
        this.item.text = `$(error) AI: ${truncate(state.message, 18)}`;
        this.item.tooltip = `AI Autocomplete error: ${state.message}`;
        this.item.command = "aiAutocomplete.selectProvider";
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
