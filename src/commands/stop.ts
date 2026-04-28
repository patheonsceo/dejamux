import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse } from 'yaml';
import type { SessionState, SessionLog, Session, ManualNote, FileChange, AIConfig } from '../types.js';
import { compileContext, updateAllContextFiles, createEmptyKnowledge } from '../core/context.js';
import { summarizeSessionWithFallback } from '../ai/summarizer.js';

const DEJA_DIR = '.deja';
const STATE_FILE = 'state.json';
const SESSIONS_DIR = 'sessions';
const CONTEXT_FILE = 'context.md';

async function checkInitialized(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, DEJA_DIR));
    return true;
  } catch {
    return false;
  }
}

async function getSessionState(cwd: string): Promise<SessionState | null> {
  try {
    const statePath = path.join(cwd, DEJA_DIR, STATE_FILE);
    const content = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(content) as SessionState;
  } catch {
    return null;
  }
}

async function saveSessionState(cwd: string, state: SessionState): Promise<void> {
  const statePath = path.join(cwd, DEJA_DIR, STATE_FILE);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

async function saveSessionLog(cwd: string, log: SessionLog): Promise<void> {
  const logPath = path.join(cwd, DEJA_DIR, SESSIONS_DIR, `${log.sessionId}.json`);
  await fs.writeFile(logPath, JSON.stringify(log, null, 2), 'utf-8');
}

function formatDuration(startTime: string | number): string {
  const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = now - start;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Detect files changed since session start using git
 */
function detectChangedFiles(cwd: string, startTime: string | number): FileChange[] {
  const changes: FileChange[] = [];
  const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();

  try {
    // Check if it's a git repo
    execSync('git rev-parse --git-dir', { cwd, stdio: 'ignore' });

    // Get modified files (staged and unstaged)
    const statusOutput = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
    const lines = statusOutput.trim().split('\n').filter(l => l.trim());

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();

      // Skip .deja directory
      if (filePath.startsWith('.deja/')) continue;

      let type: 'added' | 'modified' | 'deleted' = 'modified';
      if (status.includes('A') || status.includes('?')) {
        type = 'added';
      } else if (status.includes('D')) {
        type = 'deleted';
      }

      changes.push({
        type,
        path: filePath,
        timestamp: Date.now(),
      });
    }

    // Also check recently modified files that might be committed
    try {
      const recentCommits = execSync(
        `git log --since="${new Date(start).toISOString()}" --name-status --pretty=format:""`,
        { cwd, encoding: 'utf-8' }
      );

      const commitLines = recentCommits.trim().split('\n').filter(l => l.trim());
      for (const line of commitLines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const status = parts[0];
          const filePath = parts[1];

          if (filePath.startsWith('.deja/')) continue;
          if (changes.some(c => c.path === filePath)) continue;

          let type: 'added' | 'modified' | 'deleted' = 'modified';
          if (status === 'A') type = 'added';
          else if (status === 'D') type = 'deleted';

          changes.push({
            type,
            path: filePath,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      // No recent commits, that's fine
    }
  } catch {
    // Not a git repo, scan file system for recent changes
    try {
      const files = readdirSync(cwd, { recursive: true, withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const fullPath = path.join(file.parentPath || file.path, file.name);
          const relativePath = path.relative(cwd, fullPath);

          if (relativePath.startsWith('.deja/') || relativePath.startsWith('node_modules/')) continue;

          try {
            const stats = require('fs').statSync(fullPath);
            if (stats.mtimeMs > start) {
              changes.push({
                type: 'modified',
                path: relativePath,
                timestamp: stats.mtimeMs,
              });
            }
          } catch {
            // File might have been deleted
          }
        }
      }
    } catch {
      // Can't scan, return empty
    }
  }

  return changes;
}

/**
 * Load all past sessions for context compilation
 */
function loadPastSessions(cwd: string): Session[] {
  const sessionsDir = path.join(cwd, DEJA_DIR, SESSIONS_DIR);
  const sessions: Session[] = [];

  try {
    const files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'));

    for (const file of files.slice(-10)) { // Last 10 sessions
      try {
        const content = readFileSync(path.join(sessionsDir, file), 'utf-8');
        const log = JSON.parse(content) as SessionLog;
        sessions.push({
          id: log.sessionId || log.id || file.replace('.json', ''),
          startTime: typeof log.startTime === 'string' ? new Date(log.startTime).getTime() : log.startTime,
          endTime: typeof log.endTime === 'string' ? new Date(log.endTime).getTime() : log.endTime,
          branch: log.branch,
          changes: log.changes || (log.filesChanged || []).map(f => ({ type: 'modified' as const, path: f, timestamp: Date.now() })),
          notes: log.notes,
          summary: typeof log.summary === 'string' ? { overview: log.summary, decisions: [], patterns: [], issues: [] } : log.summary,
        });
      } catch {
        // Skip invalid session files
      }
    }
  } catch {
    // Sessions directory doesn't exist or can't be read
  }

  return sessions.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Get AI config from config file
 */
function getAIConfig(cwd: string): AIConfig | null {
  const configPath = path.join(cwd, DEJA_DIR, 'config.yml');

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = parse(content);

    if (config.ai && config.ai.provider && config.ai.provider !== 'none') {
      return {
        provider: config.ai.provider,
        model: config.ai.model || (config.ai.provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini'),
        api_key: config.ai.api_key,
        base_url: config.ai.base_url,
      };
    }
  } catch {
    // No AI config
  }

  return null;
}

/**
 * Get configured tools from config
 */
function getConfiguredTools(cwd: string): string[] {
  const configPath = path.join(cwd, DEJA_DIR, 'config.yml');
  const defaultTools = ['cursor', 'claude-code', 'copilot', 'windsurf'];

  try {
    const content = readFileSync(configPath, 'utf-8');
    // Simple YAML parsing for tools
    const contextFilesMatch = content.match(/contextFiles:[\s\S]*?(?=\n[a-z]|\n$|$)/);
    if (contextFilesMatch) {
      const tools: string[] = [];
      if (content.includes('cursor:')) tools.push('cursor');
      if (content.includes('claude:')) tools.push('claude-code');
      if (content.includes('copilot:')) tools.push('copilot');
      if (content.includes('windsurf:')) tools.push('windsurf');
      return tools.length > 0 ? tools : defaultTools;
    }
  } catch {
    // Use defaults
  }

  return defaultTools;
}

async function stopAction(): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  // Check current state
  const currentState = await getSessionState(cwd);
  if (!currentState?.active) {
    console.log(chalk.yellow('  No active session to stop.'));
    console.log(chalk.gray('  Run `deja start` to begin a new session.\n'));
    return;
  }

  const spinner = ora('Stopping session...').start();

  try {
    const endTime = new Date().toISOString();
    const duration = formatDuration(currentState.startTime!);

    // Detect files changed during session
    spinner.text = 'Detecting file changes...';
    const fileChanges = detectChangedFiles(cwd, currentState.startTime!);

    // Create session object for AI summarization
    const sessionForSummary: Session = {
      id: currentState.sessionId!,
      startTime: typeof currentState.startTime === 'string'
        ? new Date(currentState.startTime).getTime()
        : currentState.startTime!,
      endTime: Date.now(),
      branch: currentState.branch,
      changes: fileChanges,
      notes: currentState.notes,
    };

    // Try AI summarization
    let summaryText = `Session lasted ${duration}. ${fileChanges.length} files changed.`;
    let sessionSummary = null;
    const aiConfig = getAIConfig(cwd);

    if (aiConfig && (fileChanges.length > 0 || (currentState.notes && currentState.notes.length > 0))) {
      spinner.text = 'Generating AI summary...';
      try {
        const result = await summarizeSessionWithFallback(sessionForSummary, aiConfig);
        if (result.success && result.summary) {
          sessionSummary = result.summary;
          summaryText = result.summary.overview || summaryText;
          spinner.text = 'Session stopped';
        }
      } catch {
        // AI summarization failed, use fallback
      }
    }

    // Create session log
    const sessionLog: SessionLog = {
      sessionId: currentState.sessionId!,
      startTime: currentState.startTime!,
      endTime,
      branch: currentState.branch || 'unknown',
      filesChanged: fileChanges.map(c => c.path),
      changes: fileChanges,
      notes: currentState.notes,
      summary: sessionSummary || summaryText,
    };

    // Save session log
    await saveSessionLog(cwd, sessionLog);
    spinner.succeed('Session stopped' + (sessionSummary ? ' (AI summary generated)' : ''));

    // Compile context
    const contextSpinner = ora('Compiling context...').start();
    const sessions = loadPastSessions(cwd);
    const knowledge = createEmptyKnowledge();

    // Extract knowledge from sessions
    for (const session of sessions) {
      if (session.summary) {
        if (session.summary.decisions) {
          for (const d of session.summary.decisions) {
            if (!knowledge.decisions.some(kd => kd.description === d)) {
              knowledge.decisions.push({ description: d });
            }
          }
        }
        if (session.summary.patterns) {
          for (const p of session.summary.patterns) {
            if (!knowledge.patterns.some(kp => kp.description === p)) {
              knowledge.patterns.push({ description: p });
            }
          }
        }
        if (session.summary.issues) {
          for (const i of session.summary.issues) {
            if (!knowledge.issues.some(ki => ki.description === i)) {
              knowledge.issues.push({ description: i, status: 'active' });
            }
          }
        }
      }
      // Also extract from notes
      if (session.notes) {
        for (const note of session.notes) {
          if (note.content.toLowerCase().includes('decided') || note.content.toLowerCase().includes('decision')) {
            if (!knowledge.decisions.some(kd => kd.description === note.content)) {
              knowledge.decisions.push({ description: note.content });
            }
          }
          if (note.content.toLowerCase().includes('bug') || note.content.toLowerCase().includes('issue')) {
            if (!knowledge.issues.some(ki => ki.description === note.content)) {
              knowledge.issues.push({ description: note.content, status: 'active' });
            }
          }
        }
      }
    }

    const contextContent = compileContext(sessions.slice(0, 5), knowledge);

    // Save context.md
    const contextPath = path.join(cwd, DEJA_DIR, CONTEXT_FILE);
    writeFileSync(contextPath, contextContent, 'utf-8');
    contextSpinner.succeed('Context compiled');

    // Update AI context files
    const updateSpinner = ora('Updating AI tool context files...').start();
    const tools = getConfiguredTools(cwd);
    updateAllContextFiles(cwd, contextContent, tools);

    // Get list of updated files
    const updatedFiles: string[] = [];
    const toolFiles: Record<string, string> = {
      'cursor': '.cursorrules',
      'claude-code': 'CLAUDE.md',
      'copilot': '.github/copilot-instructions.md',
      'windsurf': '.windsurfrules',
    };
    for (const tool of tools) {
      if (toolFiles[tool]) {
        updatedFiles.push(toolFiles[tool]);
      }
    }
    updateSpinner.succeed('AI tool context files updated');

    // Reset state
    const newState: SessionState = {
      active: false,
      startTime: null,
      sessionId: null,
      branch: null,
      filesChanged: [],
    };
    await saveSessionState(cwd, newState);

    // Show summary
    console.log(chalk.green('\n  Session completed!\n'));
    console.log(chalk.gray('  Summary:'));
    console.log(chalk.gray(`    Session ID: ${sessionLog.sessionId}`));
    console.log(chalk.gray(`    Duration: ${duration}`));
    console.log(chalk.cyan(`    Files changed: ${fileChanges.length}`));
    if (fileChanges.length > 0 && fileChanges.length <= 8) {
      for (const change of fileChanges) {
        const icon = change.type === 'added' ? '+' : change.type === 'deleted' ? '-' : '~';
        console.log(chalk.gray(`      ${icon} ${change.path}`));
      }
    }
    if (sessionLog.notes && sessionLog.notes.length > 0) {
      console.log(chalk.gray(`    Notes: ${sessionLog.notes.length}`));
    }
    if (sessionLog.branch && sessionLog.branch !== 'unknown') {
      console.log(chalk.gray(`    Branch: ${sessionLog.branch}`));
    }

    if (updatedFiles.length > 0) {
      console.log(chalk.gray('\n  Updated context files:'));
      updatedFiles.forEach(file => {
        console.log(chalk.green(`    ✓ ${file}`));
      });
    }

    console.log(chalk.gray(`\n  Session saved to: ${DEJA_DIR}/${SESSIONS_DIR}/${sessionLog.sessionId}.json\n`));
  } catch (error) {
    spinner.fail('Failed to stop session');
    console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export const stopCommand = new Command('stop')
  .description('Stop the current DEJA session and save context')
  .action(stopAction);
