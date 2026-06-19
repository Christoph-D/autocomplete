import * as vscode from "vscode";

export type StatusState =
  | { kind: "disabled" }
  | { kind: "misconfigured" }
  | { kind: "no-key" }
  | { kind: "ready"; model: string }
  | { kind: "working" }
  | { kind: "error"; message: string };

export class StatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "aiAutocomplete.setApiKey";
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
        this.item.tooltip = "AI Autocomplete is not configured — set a model and API base URL";
        this.item.command = {
          title: "Open Settings",
          command: "workbench.action.openSettings",
          arguments: ["aiAutocomplete"],
        };
        break;
      case "no-key":
        this.item.text = "$(key) AI: set key";
        this.item.tooltip = "Click to set your API key";
        this.item.command = "aiAutocomplete.setApiKey";
        break;
      case "ready":
        this.item.text = `$(sparkle) AI: ${state.model}`;
        this.item.tooltip = `AI Autocomplete using ${state.model}`;
        this.item.command = "aiAutocomplete.toggleEnabled";
        break;
      case "working":
        this.item.text = "$(loading~spin) AI: thinking…";
        this.item.tooltip = "Awaiting completion";
        this.item.command = undefined;
        break;
      case "error":
        this.item.text = `$(error) AI: ${truncate(state.message, 18)}`;
        this.item.tooltip = `AI Autocomplete error: ${state.message}`;
        this.item.command = "aiAutocomplete.setApiKey";
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
