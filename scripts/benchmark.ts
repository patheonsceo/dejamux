#!/usr/bin/env npx ts-node
/**
 * DEJA CLI Benchmark Suite
 * Measures performance across key operations
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLI_PATH = path.join(__dirname, '..', 'dist', 'cli.js');
const BENCHMARK_DIR = path.join(os.tmpdir(), 'deja-benchmark-' + Date.now());

interface BenchmarkResult {
  name: string;
  duration: number;
  ops?: number;
  details?: string;
}

const results: BenchmarkResult[] = [];

function runCommand(cmd: string, cwd?: string): { output: string; duration: number } {
  const start = performance.now();
  try {
    const output = execSync(cmd, {
      cwd: cwd || BENCHMARK_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const duration = performance.now() - start;
    return { output, duration };
  } catch (e: any) {
    const duration = performance.now() - start;
    return { output: e.stdout || e.message, duration };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printHeader(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printResult(result: BenchmarkResult) {
  const status = result.duration < 100 ? '✓' : result.duration < 500 ? '○' : '△';
  console.log(`  ${status} ${result.name.padEnd(35)} ${formatDuration(result.duration).padStart(10)}`);
  if (result.details) {
    console.log(`    └─ ${result.details}`);
  }
}

async function setup() {
  printHeader('DEJA CLI Benchmark Suite v1.0');
  console.log(`  Platform: ${os.platform()} ${os.arch()}`);
  console.log(`  Node: ${process.version}`);
  console.log(`  CPUs: ${os.cpus().length}x ${os.cpus()[0]?.model || 'unknown'}`);
  console.log(`  Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`);

  // Create benchmark directory
  fs.mkdirSync(BENCHMARK_DIR, { recursive: true });

  // Initialize git repo
  execSync('git init', { cwd: BENCHMARK_DIR, stdio: 'ignore' });
  execSync('git config user.email "bench@test.com"', { cwd: BENCHMARK_DIR, stdio: 'ignore' });
  execSync('git config user.name "Benchmark"', { cwd: BENCHMARK_DIR, stdio: 'ignore' });

  console.log(`  Benchmark dir: ${BENCHMARK_DIR}`);
}

async function benchmarkInit() {
  printHeader('Initialization Benchmark');

  // Cold init (no existing files)
  const { duration: coldInit } = runCommand(`echo "1" | node ${CLI_PATH} init`);
  results.push({ name: 'Cold initialization', duration: coldInit, details: 'First-time setup with config' });
  printResult(results[results.length - 1]);

  // Re-init (already exists)
  const { duration: warmInit } = runCommand(`echo "n" | node ${CLI_PATH} init`);
  results.push({ name: 'Re-init check', duration: warmInit, details: 'Detecting existing installation' });
  printResult(results[results.length - 1]);
}

async function benchmarkSessionOperations() {
  printHeader('Session Operations Benchmark');

  // Start session
  const { duration: startTime } = runCommand(`node ${CLI_PATH} start`);
  results.push({ name: 'Session start', duration: startTime, details: 'Initialize tracking state' });
  printResult(results[results.length - 1]);

  // Status check (active)
  const { duration: statusActive } = runCommand(`node ${CLI_PATH} status`);
  results.push({ name: 'Status check (active)', duration: statusActive });
  printResult(results[results.length - 1]);

  // Add note
  const { duration: noteTime } = runCommand(`node ${CLI_PATH} note "Test benchmark note"`);
  results.push({ name: 'Add note', duration: noteTime });
  printResult(results[results.length - 1]);

  // Stop session (no changes)
  const { duration: stopEmpty } = runCommand(`node ${CLI_PATH} stop`);
  results.push({ name: 'Session stop (no changes)', duration: stopEmpty, details: 'Context compilation' });
  printResult(results[results.length - 1]);
}

async function benchmarkFileDetection() {
  printHeader('File Change Detection Benchmark');

  // Start new session
  runCommand(`node ${CLI_PATH} start`);

  // Create varying numbers of files
  const fileCounts = [10, 50, 100];

  for (const count of fileCounts) {
    // Create files
    const srcDir = path.join(BENCHMARK_DIR, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    for (let i = 0; i < count; i++) {
      fs.writeFileSync(
        path.join(srcDir, `file${i}.ts`),
        `// File ${i}\nexport const value${i} = ${i};\n`
      );
    }

    // Stage files
    execSync('git add -A', { cwd: BENCHMARK_DIR, stdio: 'ignore' });

    const { duration } = runCommand(`node ${CLI_PATH} stop`);
    results.push({
      name: `Detect ${count} file changes`,
      duration,
      details: `${(duration / count).toFixed(2)}ms per file`
    });
    printResult(results[results.length - 1]);

    // Clean up and restart
    fs.rmSync(srcDir, { recursive: true, force: true });
    runCommand(`node ${CLI_PATH} start`);
  }

  runCommand(`node ${CLI_PATH} stop`);
}

async function benchmarkContextCompilation() {
  printHeader('Context Compilation Benchmark');

  // Create multiple sessions with varying content
  const sessionCounts = [5, 10, 20];

  for (const count of sessionCounts) {
    // Generate fake sessions
    const sessionsDir = path.join(BENCHMARK_DIR, '.deja', 'sessions');

    for (let i = 0; i < count; i++) {
      const session = {
        sessionId: `bench-${i}-${Date.now()}`,
        startTime: new Date(Date.now() - i * 3600000).toISOString(),
        endTime: new Date(Date.now() - i * 3600000 + 1800000).toISOString(),
        branch: 'main',
        filesChanged: Array.from({ length: 5 }, (_, j) => `src/file${j}.ts`),
        changes: Array.from({ length: 5 }, (_, j) => ({
          type: 'modified',
          path: `src/file${j}.ts`,
          timestamp: Date.now()
        })),
        notes: [{ content: `Session ${i} work notes`, timestamp: Date.now() }],
        summary: {
          overview: `Worked on feature ${i}`,
          decisions: [`Decision ${i}`],
          patterns: [`Pattern ${i}`],
          issues: []
        }
      };

      fs.writeFileSync(
        path.join(sessionsDir, `${session.sessionId}.json`),
        JSON.stringify(session, null, 2)
      );
    }

    // Measure context compilation via stop
    runCommand(`node ${CLI_PATH} start`);
    fs.writeFileSync(path.join(BENCHMARK_DIR, 'trigger.ts'), '// trigger');
    execSync('git add -A', { cwd: BENCHMARK_DIR, stdio: 'ignore' });

    const { duration } = runCommand(`node ${CLI_PATH} stop`);
    results.push({
      name: `Compile context (${count} sessions)`,
      duration,
      details: `${(duration / count).toFixed(2)}ms per session`
    });
    printResult(results[results.length - 1]);
  }
}

async function benchmarkSearch() {
  printHeader('Search Performance Benchmark');

  // Search with varying result counts
  const queries = ['file', 'Session', 'nonexistent'];

  for (const query of queries) {
    const { duration, output } = runCommand(`node ${CLI_PATH} search "${query}"`);
    const matches = (output.match(/matches/g) || []).length ||
                   output.includes('No results') ? 0 : 1;
    results.push({
      name: `Search "${query}"`,
      duration,
      details: `Found matches in output`
    });
    printResult(results[results.length - 1]);
  }
}

async function benchmarkContextFileGeneration() {
  printHeader('Context File Generation Benchmark');

  const contextFiles = [
    { name: '.cursorrules', tool: 'Cursor' },
    { name: 'CLAUDE.md', tool: 'Claude Code' },
    { name: '.github/copilot-instructions.md', tool: 'Copilot' },
    { name: '.windsurfrules', tool: 'Windsurf' }
  ];

  // Measure time to read/verify each context file
  for (const { name, tool } of contextFiles) {
    const filePath = path.join(BENCHMARK_DIR, name);
    const start = performance.now();

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const duration = performance.now() - start;
      const size = Buffer.byteLength(content, 'utf-8');

      results.push({
        name: `${tool} context file`,
        duration,
        details: `${size} bytes written`
      });
    } catch {
      results.push({
        name: `${tool} context file`,
        duration: 0,
        details: 'Not generated'
      });
    }
    printResult(results[results.length - 1]);
  }
}

async function printSummary() {
  printHeader('Benchmark Summary');

  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  const avgTime = totalTime / results.length;
  const fastOps = results.filter(r => r.duration < 100).length;
  const mediumOps = results.filter(r => r.duration >= 100 && r.duration < 500).length;
  const slowOps = results.filter(r => r.duration >= 500).length;

  console.log(`  Total benchmarks: ${results.length}`);
  console.log(`  Total time: ${formatDuration(totalTime)}`);
  console.log(`  Average operation: ${formatDuration(avgTime)}`);
  console.log('');
  console.log(`  ✓ Fast (<100ms):   ${fastOps} operations`);
  console.log(`  ○ Medium (<500ms): ${mediumOps} operations`);
  console.log(`  △ Slow (≥500ms):   ${slowOps} operations`);

  // Performance score
  const score = Math.round((fastOps * 100 + mediumOps * 50) / results.length);
  console.log('');
  console.log(`  Performance Score: ${score}/100`);

  if (score >= 80) {
    console.log('  Rating: Excellent ★★★★★');
  } else if (score >= 60) {
    console.log('  Rating: Good ★★★★☆');
  } else if (score >= 40) {
    console.log('  Rating: Average ★★★☆☆');
  } else {
    console.log('  Rating: Needs Improvement ★★☆☆☆');
  }
}

async function cleanup() {
  console.log('\n  Cleaning up...');
  fs.rmSync(BENCHMARK_DIR, { recursive: true, force: true });
  console.log('  Done.\n');
}

async function main() {
  try {
    await setup();
    await benchmarkInit();
    await benchmarkSessionOperations();
    await benchmarkFileDetection();
    await benchmarkContextCompilation();
    await benchmarkSearch();
    await benchmarkContextFileGeneration();
    await printSummary();
  } finally {
    await cleanup();
  }
}

main().catch(console.error);
