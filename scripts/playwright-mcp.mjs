// Starts the Playwright MCP with a persistent browser profile in ~/.reel-reactor/playwright-profile,
// so the Instagram login survives between runs. Goes through a shell so `npx` resolves on Windows too.
//   --allow-unrestricted-file-access  lets browser_run_code_unsafe load scripts/collect.js and act.js from the
//                                     plugin folder, whatever folder the session runs in (MCP roots = cwd only)
//   --output-dir                      snapshots/console logs go to ~/.reel-reactor/output, not the session folder
//   --codegen none                    tool results don't echo the code that ran (a 10 KB script on every call)
// REEL_REACTOR_HOME overrides ~/.reel-reactor (used by tests, so they don't touch the real profile).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.REEL_REACTOR_HOME || join(homedir(), ".reel-reactor");
const profileDir = join(dataDir, "playwright-profile");
const outputDir = join(dataDir, "output");
mkdirSync(profileDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const args = ["-y", "@playwright/mcp@latest", "--user-data-dir", `"${profileDir}"`, "--output-dir", `"${outputDir}"`,
  "--allow-unrestricted-file-access", "--codegen", "none"];

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
