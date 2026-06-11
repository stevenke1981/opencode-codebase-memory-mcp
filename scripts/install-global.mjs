#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { buildPortableMcpCommand, defaultHomeRelative } from "./mcp-command.mjs";

const PROJECT_NAME = "opencode-codebase-memory-mcp";
const MCP_NAME = "codebase-memory-mcp";
const BIN_NAME = process.platform === "win32" ? "codebase-memory-mcp.exe" : "codebase-memory-mcp";
const UPSTREAM_REPO = "DeusData/codebase-memory-mcp";
const ROOT = path.resolve(import.meta.dirname, "..");
const HOME = os.homedir();
const GLOBAL_CONFIG = path.join(HOME, ".config");
const INSTALL_DIR = process.env.INSTALL_DIR
  ? path.resolve(process.env.INSTALL_DIR.replace(/^~/, HOME))
  : path.join(GLOBAL_CONFIG, PROJECT_NAME);
const BIN_DIR = path.join(INSTALL_DIR, "bin");
const TARGET_BIN = path.join(BIN_DIR, BIN_NAME);
const OPENCODE_DIR = process.env.OPENCODE_CONFIG_DIR
  ? path.resolve(process.env.OPENCODE_CONFIG_DIR.replace(/^~/, HOME))
  : path.join(GLOBAL_CONFIG, "opencode");
const USER_CONFIG = path.join(OPENCODE_DIR, "codebase-memory-mcp.json");

const skipDownload = process.argv.includes("--skip-download");
const useExisting = process.argv.includes("--use-existing");

const LEGACY_CANDIDATES = [
  process.env.CBM_BINARY,
  process.env.CODEBASE_MEMORY_MCP_BIN,
  TARGET_BIN,
  path.join(HOME, "AppData", "Local", "Programs", "codebase-memory-mcp", BIN_NAME),
  path.join(HOME, ".local", "bin", BIN_NAME),
  path.join(GLOBAL_CONFIG, "llama-cpp", BIN_NAME),
].filter(Boolean);

const MCP_REL_PATH = defaultHomeRelative(PROJECT_NAME, "bin", BIN_NAME);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadUserConfig() {
  if (!(await exists(USER_CONFIG))) {
    const example = path.join(ROOT, "config.example.json");
    if (await exists(example)) {
      await fs.mkdir(OPENCODE_DIR, { recursive: true });
      await fs.copyFile(example, USER_CONFIG);
    }
    return { timeout: 60000, mcpName: MCP_NAME, autoDownload: true, variant: "standard" };
  }
  return JSON.parse(await fs.readFile(USER_CONFIG, "utf8"));
}

async function findExistingBinary() {
  for (const candidate of LEGACY_CANDIDATES) {
    if (candidate && (await exists(candidate))) return candidate;
  }
  const which = spawnSync(process.platform === "win32" ? "where.exe" : "which", [BIN_NAME], {
    encoding: "utf8",
    shell: false,
  });
  if (which.status === 0) {
    const found = which.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (found && (await exists(found))) return found;
  }
  return null;
}

async function downloadBinary(variant = "standard") {
  const archive =
    process.platform === "win32"
      ? variant === "ui"
        ? "codebase-memory-mcp-ui-windows-amd64.zip"
        : "codebase-memory-mcp-windows-amd64.zip"
      : process.arch === "arm64"
        ? "codebase-memory-mcp-linux-arm64.tar.gz"
        : "codebase-memory-mcp-linux-amd64.tar.gz";

  const url = `https://github.com/${UPSTREAM_REPO}/releases/latest/download/${archive}`;
  const tmpDir = path.join(os.tmpdir(), `cbm-install-${Date.now()}`);
  const archivePath = path.join(tmpDir, archive);
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(BIN_DIR, { recursive: true });

  console.log(`Downloading ${url} ...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));

  if (archive.endsWith(".zip")) {
    if (process.platform !== "win32") {
      throw new Error("ZIP extraction requires Windows PowerShell or pre-extracted binary");
    }
    const extractDir = path.join(tmpDir, "extract");
    await fs.mkdir(extractDir, { recursive: true });
    const ps = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit" },
    );
    if (ps.status !== 0) throw new Error("Expand-Archive failed");
    const extracted = path.join(extractDir, BIN_NAME);
    if (!(await exists(extracted))) {
      throw new Error(`Binary not found after extract: ${extracted}`);
    }
    await fs.copyFile(extracted, TARGET_BIN);
  } else {
    const ps = spawnSync("tar", ["xzf", archivePath, "-C", tmpDir], { stdio: "inherit" });
    if (ps.status !== 0) throw new Error("tar extract failed");
    const extracted = path.join(tmpDir, BIN_NAME);
    if (!(await exists(extracted))) throw new Error(`Binary not found after extract: ${extracted}`);
    await fs.copyFile(extracted, TARGET_BIN);
    if (process.platform !== "win32") {
      await fs.chmod(TARGET_BIN, 0o755);
    }
  }

  await fs.rm(tmpDir, { recursive: true, force: true });
  console.log(`Binary installed -> ${TARGET_BIN}`);
  return TARGET_BIN;
}

async function ensureBinary(cfg) {
  if (cfg.binaryPath && (await exists(cfg.binaryPath))) {
    console.log(`Using configured binary: ${cfg.binaryPath}`);
    return cfg.binaryPath;
  }
  if (await exists(TARGET_BIN)) {
    console.log(`Using global binary: ${TARGET_BIN}`);
    return TARGET_BIN;
  }
  const existing = await findExistingBinary();
  if (useExisting && existing) {
    await fs.mkdir(BIN_DIR, { recursive: true });
    await fs.copyFile(existing, TARGET_BIN);
    console.log(`Copied existing binary -> ${TARGET_BIN}`);
    return TARGET_BIN;
  }
  if (existing && !skipDownload && cfg.autoDownload !== false) {
    await fs.mkdir(BIN_DIR, { recursive: true });
    await fs.copyFile(existing, TARGET_BIN);
    console.log(`Seeded from existing install -> ${TARGET_BIN}`);
    return TARGET_BIN;
  }
  if (skipDownload) {
    throw new Error(`Binary missing at ${TARGET_BIN}. Run without --skip-download or set binaryPath in ${USER_CONFIG}`);
  }
  return downloadBinary(cfg.variant ?? "standard");
}

function verifyBinary(binPath) {
  const result = spawnSync(binPath, ["--version"], { encoding: "utf8", timeout: 15000 });
  if (result.status !== 0) {
    throw new Error(`Binary failed --version: ${result.stderr || result.stdout || result.status}`);
  }
  console.log(`Verified: ${(result.stdout || result.stderr || "").trim()}`);
}

async function readJsoncConfig(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const stripped = raw.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

async function writeJsonConfig(filePath, config) {
  await fs.writeFile(filePath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

async function registerMcp(binPath, cfg) {
  const mcpName = cfg.mcpName || MCP_NAME;
  const entry = {
    type: "local",
    command: buildPortableMcpCommand(MCP_REL_PATH),
    enabled: true,
    timeout: cfg.timeout ?? 60000,
  };

  const candidates = ["opencode.jsonc", "opencode.json"];
  let updated = 0;
  for (const name of candidates) {
    const filePath = path.join(OPENCODE_DIR, name);
    if (!(await exists(filePath))) continue;
    const config = await readJsoncConfig(filePath);
    config.mcp = config.mcp ?? {};
    config.mcp[mcpName] = entry;
    await writeJsonConfig(filePath, config);
    console.log(`Registered MCP '${mcpName}' in ${filePath}`);
    updated++;
  }

  if (updated === 0) {
    const filePath = path.join(OPENCODE_DIR, "opencode.jsonc");
    await fs.mkdir(OPENCODE_DIR, { recursive: true });
    await writeJsonConfig(filePath, {
      $schema: "https://opencode.ai/config.json",
      mcp: { [mcpName]: entry },
    });
    console.log(`Created ${filePath} with MCP registration`);
  }

  cfg.binaryPath = binPath;
  cfg.mcpRelativePath = MCP_REL_PATH;
  cfg.mcpCommand = entry.command;
  await fs.writeFile(USER_CONFIG, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

async function syncInstallerMeta() {
  if (path.resolve(ROOT) === path.resolve(INSTALL_DIR)) return;
  await fs.mkdir(INSTALL_DIR, { recursive: true });
  for (const item of ["scripts", "mcps", "package.json", "config.example.json", "install.ps1", "install.sh", "README.md", "LICENSE", "opencode.json.example"]) {
    const src = path.join(ROOT, item);
    if (!existsSync(src)) continue;
    const dest = path.join(INSTALL_DIR, item);
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      await fs.cp(src, dest, { recursive: true, force: true });
    } else {
      await fs.copyFile(src, dest);
    }
  }
  console.log(`Installer synced -> ${INSTALL_DIR}`);
}

async function main() {
  console.log(`Installing ${MCP_NAME} for OpenCode...`);
  await syncInstallerMeta();
  const cfg = await loadUserConfig();
  const binPath = await ensureBinary(cfg);
  verifyBinary(binPath);
  await registerMcp(binPath, cfg);

  console.log("\nDone! Restart OpenCode.");
  console.log(`Binary: ${binPath}`);
  console.log(`Config: ${USER_CONFIG}`);
  console.log("Verify: node scripts/doctor.mjs");
  if (process.platform === "win32") {
    console.log("Windows: use git-bash-opencode-plugin bashExec for npm — not PowerShell");
  }
  console.log("Tools: index_repository, search_graph, trace_path, get_code_snippet, get_architecture, ...");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});