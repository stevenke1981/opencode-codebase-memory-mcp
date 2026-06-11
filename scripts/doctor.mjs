#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();
const GLOBAL_CONFIG = path.join(HOME, ".config");
const OPENCODE_DIR = path.join(GLOBAL_CONFIG, "opencode");
const USER_CONFIG = path.join(OPENCODE_DIR, "codebase-memory-mcp.json");
const DEFAULT_BIN = path.join(GLOBAL_CONFIG, "opencode-codebase-memory-mcp", "bin", process.platform === "win32" ? "codebase-memory-mcp.exe" : "codebase-memory-mcp");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonc(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

function checkMcpInit(binPath) {
  return new Promise((resolve) => {
    const child = spawn(binPath, [], { stdio: ["pipe", "pipe", "inherit"] });
    const init = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "doctor", version: "1.0.0" },
      },
    };
    child.stdin.write(JSON.stringify(init) + "\n");
    child.stdin.end();
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.on("close", () => resolve(out));
    setTimeout(() => {
      child.kill();
      resolve(out);
    }, 8000);
  });
}

const lines = ["# codebase-memory-mcp Doctor", ""];

let cfg = {};
if (await exists(USER_CONFIG)) {
  cfg = JSON.parse(await fs.readFile(USER_CONFIG, "utf8"));
  lines.push(`User config: ${USER_CONFIG}`);
} else {
  lines.push(`User config: (missing) ${USER_CONFIG}`);
}

const binPath = cfg.binaryPath && (await exists(cfg.binaryPath)) ? cfg.binaryPath : DEFAULT_BIN;
lines.push(`Binary: ${binPath}`);

if (!(await exists(binPath))) {
  lines.push("FAIL: binary not found");
  lines.push("Fix: node scripts/install-global.mjs");
  console.log(lines.join("\n"));
  process.exit(1);
}

const ver = spawnSync(binPath, ["--version"], { encoding: "utf8" });
lines.push(`Version: ${(ver.stdout || ver.stderr || "").trim()}`);

for (const name of ["opencode.jsonc", "opencode.json"]) {
  const filePath = path.join(OPENCODE_DIR, name);
  if (!(await exists(filePath))) continue;
  const config = await readJsonc(filePath);
  const mcp = config.mcp?.["codebase-memory-mcp"];
  if (!mcp) {
    lines.push(`WARN: ${name} has no codebase-memory-mcp entry`);
    continue;
  }
  const cmd = Array.isArray(mcp.command) ? mcp.command.join(" ") : `${mcp.command ?? ""} ${(mcp.args ?? []).join(" ")}`.trim();
  lines.push(`${name}: type=${mcp.type ?? "(legacy)"} command=${cmd}`);
  if (!mcp.type || mcp.type !== "local") {
    lines.push(`  FIX NEEDED: missing type:"local" — rerun installer`);
  }
  if (!Array.isArray(mcp.command)) {
    lines.push(`  FIX NEEDED: command must be an array for OpenCode`);
  }
  if (cmd.includes("Users\\eda\\") || cmd.includes("/eda/")) {
    lines.push(`  FIX NEEDED: stale path from another user (eda)`);
  }
  if (process.platform === "win32" && cmd.includes("~/.config/")) {
    lines.push(`  FIX NEEDED: OpenCode on Windows does not expand "~" — rerun installer for absolute path`);
  }
}

const initOut = await checkMcpInit(binPath);
if (initOut.includes("codebase-memory-mcp")) {
  lines.push("MCP initialize: OK");
} else {
  lines.push("MCP initialize: FAILED");
  lines.push(initOut.slice(0, 300));
}

lines.push("", "If OpenCode still cannot see tools: restart OpenCode, then run `opencode mcp list`.");
console.log(lines.join("\n"));