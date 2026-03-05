/**
 * DEJA Mux - Terminal multiplexer for AI agent workflows
 * Wraps tmux to provide a dashboard + multiple agent panes
 */

import { spawn, execSync, exec } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_NAME = 'deja';
const SOCKET_NAME = 'deja-mux';

export interface MuxPane {
  id: string;
  index: number;
  title: string;
  command: string;
  active: boolean;
}

export interface MuxLayout {
  dashboard: boolean;
  panes: MuxPane[];
}

/**
 * Check if tmux is installed
 */
export function isTmuxInstalled(): boolean {
  try {
    execSync('which tmux', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if DEJA mux session exists
 */
export function sessionExists(): boolean {
  try {
    execSync(`tmux -L ${SOCKET_NAME} has-session -t ${SESSION_NAME} 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run a tmux command
 */
function tmux(args: string): string {
  try {
    return execSync(`tmux -L ${SOCKET_NAME} ${args}`, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`tmux command failed: ${args}`);
  }
}

/**
 * Run tmux command, ignore errors
 */
function tmuxSafe(args: string): string | null {
  try {
    return execSync(`tmux -L ${SOCKET_NAME} ${args}`, { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Start a new DEJA mux session with dashboard
 */
export function startSession(projectPath: string): void {
  if (!isTmuxInstalled()) {
    console.log(chalk.red('Error: tmux is not installed.'));
    console.log(chalk.gray('Install with: brew install tmux (macOS) or apt install tmux (Linux)'));
    process.exit(1);
  }

  if (sessionExists()) {
    console.log(chalk.yellow('DEJA mux session already exists.'));
    console.log(chalk.gray('Attach with: deja mux attach'));
    console.log(chalk.gray('Or kill with: deja mux kill'));
    return;
  }

  const dashboardCmd = `cd "${projectPath}" && node "${join(__dirname, '..', '..', 'dist', 'cli.js')}" mux-dashboard`;

  // Create new session with dashboard pane at top
  tmux(`new-session -d -s ${SESSION_NAME} -n main -x 200 -y 50`);

  // Set up the dashboard pane (top, small height)
  tmux(`send-keys -t ${SESSION_NAME}:main "${dashboardCmd}" Enter`);

  // Split horizontally for main workspace below dashboard
  tmux(`split-window -t ${SESSION_NAME}:main -v -l 85%`);

  // Set the bottom pane as the default working pane
  tmux(`send-keys -t ${SESSION_NAME}:main.1 "cd '${projectPath}' && clear" Enter`);

  // Select the working pane
  tmux(`select-pane -t ${SESSION_NAME}:main.1`);

  // Set pane titles
  tmux(`select-pane -t ${SESSION_NAME}:main.0 -T "DEJA Dashboard"`);
  tmux(`select-pane -t ${SESSION_NAME}:main.1 -T "Workspace"`);

  // Enable mouse support
  tmuxSafe(`set-option -t ${SESSION_NAME} mouse on`);

  // Set status bar with compatible colors
  tmuxSafe(`set-option -t ${SESSION_NAME} status-style "bg=black,fg=white"`);
  tmuxSafe(`set-option -t ${SESSION_NAME} status-left "#[bg=blue,fg=white,bold] DEJA MUX #[bg=black] "`);
  tmuxSafe(`set-option -t ${SESSION_NAME} status-right "#[fg=white] %H:%M #[bg=blue,fg=white] #S "`);
  tmuxSafe(`set-option -t ${SESSION_NAME} pane-border-style "fg=colour240"`);
  tmuxSafe(`set-option -t ${SESSION_NAME} pane-active-border-style "fg=blue"`);

  console.log(chalk.green('✓ DEJA mux session started'));
  console.log('');
  console.log(chalk.gray('  Attach with:'), chalk.white('deja mux attach'));
  console.log(chalk.gray('  Add pane:'), chalk.white('deja mux add "claude"'));
  console.log(chalk.gray('  Add pane:'), chalk.white('deja mux add "npm run dev"'));
  console.log('');
}

/**
 * Attach to existing session
 */
export function attachSession(): void {
  if (!sessionExists()) {
    console.log(chalk.red('No DEJA mux session found.'));
    console.log(chalk.gray('Start with: deja mux start'));
    return;
  }

  // Attach in foreground
  const tmuxPath = execSync('which tmux', { encoding: 'utf-8' }).trim();
  spawn(tmuxPath, ['-L', SOCKET_NAME, 'attach-session', '-t', SESSION_NAME], {
    stdio: 'inherit',
  });
}

/**
 * Add a new pane with a command
 */
export function addPane(command: string, direction: 'h' | 'v' = 'h'): void {
  if (!sessionExists()) {
    console.log(chalk.red('No DEJA mux session found.'));
    console.log(chalk.gray('Start with: deja mux start'));
    return;
  }

  const splitFlag = direction === 'h' ? '-h' : '-v';

  // Split from the current pane (not dashboard)
  tmux(`split-window -t ${SESSION_NAME}:main ${splitFlag}`);

  // Send the command
  if (command) {
    tmux(`send-keys -t ${SESSION_NAME}:main "${command}" Enter`);
  }

  // Set pane title
  const title = command.split(' ')[0] || 'Shell';
  tmuxSafe(`select-pane -T "${title}"`);

  console.log(chalk.green(`✓ Added pane: ${command || 'shell'}`));
}

/**
 * Add a Claude Code pane
 */
export function addClaudePane(path?: string): void {
  const workdir = path || process.cwd();
  addPane(`cd "${workdir}" && claude`, 'h');
}

/**
 * List all panes
 */
export function listPanes(): MuxPane[] {
  if (!sessionExists()) {
    return [];
  }

  const output = tmuxSafe(`list-panes -t ${SESSION_NAME}:main -F "#{pane_index}|#{pane_title}|#{pane_current_command}|#{pane_active}"`);
  if (!output) return [];

  return output.split('\n').map((line, i) => {
    const [index, title, command, active] = line.split('|');
    return {
      id: `${SESSION_NAME}:main.${index}`,
      index: parseInt(index),
      title: title || `Pane ${index}`,
      command: command || '',
      active: active === '1',
    };
  });
}

/**
 * Kill a specific pane
 */
export function killPane(index: number): void {
  if (!sessionExists()) {
    console.log(chalk.red('No DEJA mux session found.'));
    return;
  }

  if (index === 0) {
    console.log(chalk.red('Cannot kill dashboard pane.'));
    return;
  }

  tmuxSafe(`kill-pane -t ${SESSION_NAME}:main.${index}`);
  console.log(chalk.green(`✓ Killed pane ${index}`));
}

/**
 * Kill the entire session
 */
export function killSession(): void {
  if (!sessionExists()) {
    console.log(chalk.yellow('No DEJA mux session to kill.'));
    return;
  }

  tmux(`kill-session -t ${SESSION_NAME}`);
  console.log(chalk.green('✓ DEJA mux session killed'));
}

/**
 * Change layout
 */
export function setLayout(layout: 'tiled' | 'even-horizontal' | 'even-vertical' | 'main-horizontal' | 'main-vertical'): void {
  if (!sessionExists()) {
    console.log(chalk.red('No DEJA mux session found.'));
    return;
  }

  tmux(`select-layout -t ${SESSION_NAME}:main ${layout}`);
  console.log(chalk.green(`✓ Layout changed to ${layout}`));
}

/**
 * Send keys to a specific pane
 */
export function sendKeys(paneIndex: number, keys: string): void {
  if (!sessionExists()) {
    console.log(chalk.red('No DEJA mux session found.'));
    return;
  }

  tmux(`send-keys -t ${SESSION_NAME}:main.${paneIndex} "${keys}"`);
}

/**
 * Focus a specific pane
 */
export function focusPane(index: number): void {
  if (!sessionExists()) {
    console.log(chalk.red('No DEJA mux session found.'));
    return;
  }

  tmux(`select-pane -t ${SESSION_NAME}:main.${index}`);
}
