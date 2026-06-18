import * as path from "path";
import { spawn, type ChildProcess } from "child_process";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const xvfb = await ensureDisplay();

  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-workspace-trust",
        "--skip-welcome",
        "--skip-release-notes",
        "--disable-updates",
      ],
    });
  } finally {
    if (xvfb) {
      xvfb.kill("SIGTERM");
    }
  }
}

async function ensureDisplay(): Promise<ChildProcess | null> {
  if (process.platform !== "linux") {
    return null;
  }
  if (process.env.DISPLAY) {
    return null;
  }
  try {
    const display = ":77";
    const child = spawn("Xvfb", [display, "-screen", "0", "1920x1080x24"], {
      stdio: "ignore",
      detached: false,
    });
    process.env.DISPLAY = display;
    await new Promise((r) => setTimeout(r, 200));
    if (child.exitCode !== null) {
      throw new Error(`Xvfb exited with code ${child.exitCode}`);
    }
    return child;
  } catch (err) {
    console.warn(
      `Could not start Xvfb (${err instanceof Error ? err.message : err}). ` +
        `Install it or set DISPLAY, or run under \`xvfb-run -a pnpm test\`.`,
    );
    return null;
  }
}

void main().catch((err) => {
  console.error("Failed to run tests:", err);
  process.exit(1);
});
