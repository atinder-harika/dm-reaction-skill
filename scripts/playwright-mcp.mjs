// Starts the Playwright MCP with a persistent browser profile in ~/.reel-reactor/playwright-profile,
// so the Instagram login survives between runs. Goes through a shell so `npx` resolves on Windows too.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const dataDir = join(homedir(), ".reel-reactor");
const profileDir = join(dataDir, "playwright-profile");
mkdirSync(profileDir, { recursive: true });

const args = ["-y", "@playwright/mcp@latest", "--user-data-dir", `"${profileDir}"`];

// Optional "browser" in config.json (chrome, msedge, firefox, webkit). Playwright defaults to Chrome.
try {
  const configPath = join(dataDir, "config.json");
  if (existsSync(configPath)) {
    const { browser } = JSON.parse(readFileSync(configPath, "utf8"));
    if (browser) args.push("--browser", browser);
  }
} catch {}

const child = spawn("npx", args, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
