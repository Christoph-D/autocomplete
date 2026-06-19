import type * as vscode from "vscode";
import type { LogLevel } from "../config/configuration";

const RANK: Record<LogLevel, number> = {
  off: 0,
  error: 1,
  info: 2,
  trace: 3,
};

export interface LoggerDeps {
  channel: vscode.OutputChannel;
  getLevel: () => LogLevel;
}

/**
 * Thin wrapper around a VS Code OutputChannel that gates output by a
 * configurable level. The level is resolved lazily on each call via
 * `getLevel`, so changes to the `aiAutocomplete.logLevel` setting take effect
 * immediately without reactivation.
 */
export class Logger {
  constructor(private readonly deps: LoggerDeps) {}

  error(message: string): void {
    this.emit("error", message);
  }

  info(message: string): void {
    this.emit("info", message);
  }

  trace(message: string): void {
    this.emit("trace", message);
  }

  private emit(level: Exclude<LogLevel, "off">, message: string): void {
    if (RANK[this.deps.getLevel()] >= RANK[level]) {
      this.deps.channel.appendLine(`[${level}] ${message}`);
    }
  }
}
