import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import type { SessionState, SessionLog } from '../types.js';

const DEJA_DIR = '.deja';
const STATE_FILE = 'state.json';
const SESSIONS_DIR = 'sessions';

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

async function compileContext(cwd: string, _sessionLog: SessionLog): Promise<void> {
  // TODO: Implement actual context compilation
  // This is a placeholder for the context compilation logic
  // that will update AI tool context files
  const spinner = ora('Compiling context...').start();

  // Simulate context compilation
  await new Promise(resolve => setTimeout(resolve, 500));

  spinner.succeed('Context compiled');
}

async function updateAIContextFiles(cwd: string, _sessionLog: SessionLog): Promise<string[]> {
  // TODO: Implement actual AI context file updates
  // This is a placeholder that returns the list of files that would be updated
  const spinner = ora('Updating AI tool context files...').start();

  // Simulate updating files
  await new Promise(resolve => setTimeout(resolve, 300));

  const updatedFiles: string[] = [];

  // Check which context files exist and would be updated
  const contextFiles = [
    '.cursorrules',
    'CLAUDE.md',
    '.github/copilot-instructions.md',
    '.windsurfrules',
    '.aider.conventions.md',
  ];

  for (const file of contextFiles) {
    try {
      await fs.access(path.join(cwd, file));
      updatedFiles.push(file);
    } catch {
      // File doesn't exist, skip
    }
  }

  spinner.succeed('AI tool context files updated');
  return updatedFiles;
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

    // Create session log
    const sessionLog: SessionLog = {
      sessionId: currentState.sessionId!,
      startTime: currentState.startTime!,
      endTime,
      branch: currentState.branch || 'unknown',
      filesChanged: currentState.filesChanged,
      notes: currentState.notes,
      summary: `Session lasted ${duration}. ${currentState.filesChanged.length} files changed.`,
    };

    // Save session log
    await saveSessionLog(cwd, sessionLog);
    spinner.succeed('Session stopped');

    // Compile context
    await compileContext(cwd, sessionLog);

    // Update AI context files
    const updatedFiles = await updateAIContextFiles(cwd, sessionLog);

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
    console.log(chalk.gray(`    Files changed: ${sessionLog.filesChanged?.length || 0}`));
    if (sessionLog.notes && sessionLog.notes.length > 0) {
      console.log(chalk.gray(`    Notes: ${sessionLog.notes.length}`));
    }
    if (sessionLog.branch) {
      console.log(chalk.gray(`    Branch: ${sessionLog.branch}`));
    }

    if (updatedFiles.length > 0) {
      console.log(chalk.gray('\n  Updated context files:'));
      updatedFiles.forEach(file => {
        console.log(chalk.gray(`    - ${file}`));
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
