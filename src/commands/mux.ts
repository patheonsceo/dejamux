/**
 * DEJA Mux Command
 * Terminal multiplexer for AI agent workflows
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  isTmuxInstalled,
  sessionExists,
  startSession,
  attachSession,
  addPane,
  addClaudePane,
  listPanes,
  killPane,
  killSession,
  setLayout,
  focusPane,
} from '../mux/index.js';

const muxCommand = new Command('mux')
  .description('Terminal multiplexer for AI agent workflows');

// deja mux start
muxCommand
  .command('start')
  .description('Start a new DEJA mux session with dashboard')
  .action(() => {
    const projectPath = process.cwd();
    startSession(projectPath);
  });

// deja mux attach
muxCommand
  .command('attach')
  .alias('a')
  .description('Attach to existing DEJA mux session')
  .action(() => {
    attachSession();
  });

// deja mux add <command>
muxCommand
  .command('add [command]')
  .description('Add a new pane with optional command')
  .option('-v, --vertical', 'Split vertically instead of horizontally')
  .action((command: string | undefined, options: { vertical?: boolean }) => {
    const direction = options.vertical ? 'v' : 'h';
    addPane(command || '', direction);
  });

// deja mux claude [path]
muxCommand
  .command('claude [path]')
  .description('Add a new pane running Claude Code')
  .action((path?: string) => {
    addClaudePane(path);
  });

// deja mux list
muxCommand
  .command('list')
  .alias('ls')
  .description('List all panes in the session')
  .action(() => {
    const panes = listPanes();
    if (panes.length === 0) {
      console.log(chalk.yellow('No DEJA mux session found.'));
      console.log(chalk.gray('Start with: deja mux start'));
      return;
    }

    console.log(chalk.blue('\n  DEJA Mux Panes\n'));
    for (const pane of panes) {
      const activeMarker = pane.active ? chalk.green('●') : chalk.gray('○');
      const title = pane.index === 0 ? chalk.cyan(pane.title) : chalk.white(pane.title);
      console.log(`  ${activeMarker} [${pane.index}] ${title} ${chalk.gray(`(${pane.command})`)}`);
    }
    console.log('');
  });

// deja mux kill <index>
muxCommand
  .command('kill <index>')
  .description('Kill a specific pane by index')
  .action((index: string) => {
    killPane(parseInt(index));
  });

// deja mux stop
muxCommand
  .command('stop')
  .description('Stop the DEJA mux session')
  .action(() => {
    killSession();
  });

// deja mux layout <type>
muxCommand
  .command('layout <type>')
  .description('Change pane layout (tiled, even-horizontal, even-vertical, main-horizontal, main-vertical)')
  .action((type: string) => {
    const validLayouts = ['tiled', 'even-horizontal', 'even-vertical', 'main-horizontal', 'main-vertical'];
    if (!validLayouts.includes(type)) {
      console.log(chalk.red(`Invalid layout. Choose from: ${validLayouts.join(', ')}`));
      return;
    }
    setLayout(type as any);
  });

// deja mux focus <index>
muxCommand
  .command('focus <index>')
  .description('Focus a specific pane by index')
  .action((index: string) => {
    focusPane(parseInt(index));
  });

// deja mux status
muxCommand
  .command('status')
  .description('Show mux session status')
  .action(() => {
    if (!isTmuxInstalled()) {
      console.log(chalk.red('tmux is not installed.'));
      console.log(chalk.gray('Install with: brew install tmux (macOS) or apt install tmux (Linux)'));
      return;
    }

    if (!sessionExists()) {
      console.log(chalk.yellow('No DEJA mux session running.'));
      console.log(chalk.gray('Start with: deja mux start'));
      return;
    }

    const panes = listPanes();
    console.log(chalk.green('\n  DEJA Mux Session Active\n'));
    console.log(chalk.gray(`  Panes: ${panes.length}`));
    console.log(chalk.gray('  Attach with: deja mux attach'));
    console.log('');
  });

// Default action - show help or attach
muxCommand
  .action(() => {
    if (sessionExists()) {
      console.log(chalk.blue('\n  DEJA Mux Session Running\n'));
      console.log(chalk.gray('  Attach:'), chalk.white('deja mux attach'));
      console.log(chalk.gray('  Add pane:'), chalk.white('deja mux add "command"'));
      console.log(chalk.gray('  Add Claude:'), chalk.white('deja mux claude'));
      console.log(chalk.gray('  List panes:'), chalk.white('deja mux list'));
      console.log(chalk.gray('  Stop:'), chalk.white('deja mux stop'));
      console.log('');
    } else {
      console.log(chalk.blue('\n  DEJA Mux - Terminal Multiplexer for AI Agents\n'));
      console.log(chalk.gray('  Start a session:'), chalk.white('deja mux start'));
      console.log(chalk.gray('  Then add panes:'), chalk.white('deja mux add "npm run dev"'));
      console.log(chalk.gray('  Add Claude Code:'), chalk.white('deja mux claude'));
      console.log('');
    }
  });

export { muxCommand };
