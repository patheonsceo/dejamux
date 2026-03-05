import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import type { SessionState } from '../types.js';

const DEJA_DIR = '.deja';
const STATE_FILE = 'state.json';

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

function getCurrentBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch;
  } catch {
    return null;
  }
}

function formatDuration(startTime: string | number): string {
  const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
  const now = Date.now();
  const diffMs = now - start;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function statusAction(): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  // Get current state
  const state = await getSessionState(cwd);

  if (!state) {
    console.log(chalk.red('  Unable to read DEJA state.'));
    console.log(chalk.gray('  Try running `deja init` to reinitialize.\n'));
    process.exit(1);
  }

  const currentBranch = getCurrentBranch();

  console.log(chalk.blue('  DEJA Status\n'));

  // Session status
  if (state.active) {
    console.log(chalk.green('  Session: ') + chalk.green.bold('ACTIVE'));
    console.log(chalk.gray(`  Session ID: ${state.sessionId}`));
    console.log(chalk.gray(`  Started: ${state.startTime}`));
    console.log(chalk.gray(`  Duration: ${formatDuration(state.startTime!)}`));
  } else {
    console.log(chalk.yellow('  Session: ') + chalk.yellow.bold('INACTIVE'));
    console.log(chalk.gray('  No active session. Run `deja start` to begin.'));
  }

  console.log('');

  // Files changed
  const filesChangedCount = state.filesChanged?.length || 0;
  if (state.active) {
    console.log(chalk.gray(`  Files changed: ${filesChangedCount}`));
    if (filesChangedCount > 0 && filesChangedCount <= 10) {
      state.filesChanged.forEach(file => {
        console.log(chalk.gray(`    - ${file}`));
      });
    } else if (filesChangedCount > 10) {
      state.filesChanged.slice(0, 10).forEach(file => {
        console.log(chalk.gray(`    - ${file}`));
      });
      console.log(chalk.gray(`    ... and ${filesChangedCount - 10} more`));
    }
  }

  // Branch info
  if (currentBranch) {
    console.log(chalk.gray(`  Current branch: ${currentBranch}`));
    if (state.active && state.branch && state.branch !== currentBranch) {
      console.log(chalk.yellow(`  Warning: Branch changed from ${state.branch} to ${currentBranch}`));
    }
  }

  console.log('');
}

export const statusCommand = new Command('status')
  .description('Show the current DEJA session status')
  .action(statusAction);
