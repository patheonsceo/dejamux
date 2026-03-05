#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { logCommand } from './commands/log.js';
import { noteCommand } from './commands/note.js';
import { searchCommand } from './commands/search.js';
import { contextCommand } from './commands/context.js';
import { forgetCommand } from './commands/forget.js';
import { configCommand } from './commands/config.js';
import { muxCommand } from './commands/mux.js';

const program = new Command();

program
  .name('deja')
  .version('1.0.0')
  .description('Multi-agent terminal with supercharged context management');

// Register commands
program.addCommand(initCommand);
program.addCommand(startCommand);
program.addCommand(stopCommand);
program.addCommand(statusCommand);
program.addCommand(logCommand);
program.addCommand(noteCommand);
program.addCommand(searchCommand);
program.addCommand(contextCommand);
program.addCommand(forgetCommand);
program.addCommand(configCommand);
program.addCommand(muxCommand);

// Internal command for mux dashboard (not shown in help)
program
  .command('mux-dashboard', { hidden: true })
  .description('Internal: Run the mux dashboard')
  .action(async () => {
    // Dynamic import to avoid loading dashboard code unless needed
    const { Dashboard } = await import('./mux/dashboard.js');
    const dashboard = new Dashboard(process.cwd());
    dashboard.start();
  });

program.parse(process.argv);
