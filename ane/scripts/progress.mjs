#!/usr/bin/env node
// Monorepo progress analysis powered by Turborepo.
//
// Runs the requested tasks across the workspace with `--summarize`, then turns
// Turborepo's own run summary (`.turbo/runs/<id>.json`) into a per-package
// progress report. The summary is the source of truth: it records each task's
// cache status and execution result, so the report reflects exactly what Turbo
// did -- no output parsing required.
//
// Usage:
//   pnpm progress                    # build + lint + check-types
//   pnpm progress build check-types  # only the listed tasks
//   pnpm progress --out progress.md  # also write a Markdown report
//   pnpm progress --no-fail          # never exit non-zero

import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS_DIR = join(ROOT, ".turbo", "runs");
const DEFAULT_TASKS = ["build", "lint", "check-types"];

const LEGEND = {
  pass: "✅",
  cached: "♻️",
  fail: "❌",
  missing: "—",
};

function parseArgs(argv) {
  const tasks = [];
  const flags = new Set();
  let out = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      out = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--")) {
      flags.add(arg.slice(2));
    } else {
      tasks.push(arg);
    }
  }

  return { tasks: tasks.length ? tasks : DEFAULT_TASKS, flags, out };
}

function runTurbo(tasks) {
  const args = [
    "exec",
    "turbo",
    "run",
    ...tasks,
    "--continue",
    "--summarize",
    "--ui=stream",
    "--output-logs=errors-only",
  ];
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  console.error(`\n$ ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  return result.status ?? 1;
}

function listRuns() {
  return existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR) : [];
}

function newestRun(files) {
  return files
    .map((file) => ({ file, mtime: statSync(join(RUNS_DIR, file)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.file ?? null;
}

// Turborepo omits tasks a package does not define (they resolve to a
// `<NONEXISTENT>` command and are never scheduled), so a missing entry means
// "not defined for this package" rather than "skipped".
function taskStatus(entry) {
  if (!entry) return "missing";

  const exec = entry.execution;
  if (exec?.error) return "fail";
  if (typeof exec?.exitCode === "number" && exec.exitCode !== 0) return "fail";

  if (entry.cache?.status === "HIT") return "cached";
  if (exec?.exitCode === 0) return "pass";
  return "missing";
}

function renderReport(run, tasks) {
  const byId = new Map(run.tasks.map((task) => [task.taskId, task]));
  const { success, failed, cached, attempted } = run.execution;
  const seconds = ((run.execution.endTime - run.execution.startTime) / 1000).toFixed(1);

  const lines = [
    "# Monorepo 进度分析",
    "",
    `- Turborepo: \`${run.turboVersion}\``,
    `- 命令: \`${run.execution.command}\``,
    `- 时间: ${new Date(run.execution.startTime).toLocaleString()} (${seconds}s)`,
    `- 结果: 通过 ${success} · 缓存命中 ${cached} · 失败 ${failed} · 共 ${attempted}`,
    "",
    `图例: ${LEGEND.pass} 通过 · ${LEGEND.cached} 缓存命中 · ${LEGEND.fail} 失败 · ${LEGEND.missing} 未定义`,
    "",
  ];

  const header = ["Package", ...tasks];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${header.map(() => "---").join(" | ")} |`);
  for (const pkg of run.packages) {
    const cells = tasks.map((task) => LEGEND[taskStatus(byId.get(`${pkg}#${task}`))]);
    lines.push(`| ${[pkg, ...cells].join(" | ")} |`);
  }

  const failures = run.tasks.filter((task) => taskStatus(task) === "fail");
  if (failures.length > 0) {
    lines.push("", "## 失败任务", "");
    for (const task of failures) {
      const reason = task.execution?.error ?? `exit code ${task.execution?.exitCode}`;
      lines.push(`- **${task.taskId}** — ${reason}`);
    }
  }

  lines.push("", "## 任务覆盖", "");
  for (const task of tasks) {
    const defined = run.packages.filter((pkg) => byId.has(`${pkg}#${task}`));
    const missing = run.packages.filter((pkg) => !byId.has(`${pkg}#${task}`));
    const summary = missing.length
      ? `定义于 ${defined.join(", ") || "(无)"}; 未定义于 ${missing.join(", ")}`
      : `定义于全部 ${defined.length} 个包`;
    lines.push(`- \`${task}\`: ${summary}`);
  }

  return `${lines.join("\n")}\n`;
}

const { tasks, flags, out } = parseArgs(process.argv.slice(2));

const before = new Set(listRuns());
const turboExit = runTurbo(tasks);

const created = listRuns().filter((file) => !before.has(file));
const runFile = newestRun(created.length ? created : listRuns());
if (!runFile) {
  console.error("progress: no Turborepo run summary found in .turbo/runs");
  process.exit(turboExit || 1);
}

const run = JSON.parse(readFileSync(join(RUNS_DIR, runFile), "utf8"));
const report = renderReport(run, tasks);
process.stdout.write(`\n${report}`);

if (out) {
  const outPath = isAbsolute(out) ? out : join(ROOT, out);
  writeFileSync(outPath, report, "utf8");
  console.error(`progress: report written to ${outPath}`);
}

if (flags.has("no-fail")) {
  process.exit(0);
}
process.exit(run.execution.exitCode ?? turboExit);
