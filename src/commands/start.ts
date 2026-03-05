import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import type { SessionState } from '../types.js';

const DEJA_DIR = '.deja';
const STATE_FILE = 'state.json';

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
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

async function startAction(): Promise<void> {
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
  if (currentState?.active) {
    console.log(chalk.yellow('  A session is already active.'));
    console.log(chalk.gray(`  Session ID: ${currentState.sessionId}`));
    console.log(chalk.gray(`  Started: ${currentState.startTime}`));
    console.log(chalk.gray('\n  Run `deja stop` to end the current session.\n'));
    return;
  }

  const spinner = ora('Starting session...').start();

  try {
    const sessionId = generateSessionId();
    const startTime = new Date().toISOString();
    const branch = getCurrentBranch();

    const newState: SessionState = {
      active: true,
      startTime,
      sessionId,
      branch,
      filesChanged: [],
    };

    await saveSessionState(cwd, newState);

    spinner.succeed('Session started');

    console.log(chalk.green('\n  DEJA session is now active!\n'));
    console.log(chalk.gray(`  Session ID: ${sessionId}`));
    console.log(chalk.gray(`  Started: ${startTime}`));
    if (branch) {
      console.log(chalk.gray(`  Branch: ${branch}`));
    }
    console.log('');
    console.log(chalk.blue('  DEJA is now tracking your changes.'));
    console.log(chalk.white('  Run `deja stop` when you\'re done to save context.\n'));
  } catch (error) {
    spinner.fail('Failed to start session');
    console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export const startCommand = new Command('start')
  .description('Start a new DEJA coding session')
  .action(startAction);
