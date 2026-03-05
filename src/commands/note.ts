import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import type { SessionState, ManualNote } from '../types.js';

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

async function saveSessionState(cwd: string, state: SessionState): Promise<void> {
  const statePath = path.join(cwd, DEJA_DIR, STATE_FILE);
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

async function noteAction(content: string): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  // Check if a session is active
  const state = await getSessionState(cwd);
  if (!state?.active) {
    console.log(chalk.yellow('  No active session.'));
    console.log(chalk.gray('  Start a session with `deja start` before adding notes.\n'));
    process.exit(1);
  }

  if (!content || content.trim() === '') {
    console.log(chalk.red('  Note content cannot be empty.\n'));
    process.exit(1);
  }

  // Create the note
  const note: ManualNote = {
    content: content.trim(),
    timestamp: Date.now(),
  };

  // Add note to state (initialize notes array if needed)
  const notes = state.notes || [];
  notes.push(note);
  state.notes = notes;

  await saveSessionState(cwd, state);

  console.log(chalk.green('  Note added to current session.\n'));
  console.log(chalk.gray(`  "${content.trim()}"`));
  console.log(chalk.gray(`  Added at: ${new Date(note.timestamp).toLocaleString()}\n`));
}

export const noteCommand = new Command('note')
  .description('Add a note to the current session')
  .argument('<content>', 'The note content')
  .action(noteAction);
