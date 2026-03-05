/**
 * DEJA Mux Dashboard
 * Live dashboard showing session status, file changes, and context
 * Runs in the top pane of the tmux session
 */

import { watch } from 'chokidar';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import { DEJA_DIR, STATE_FILE, SESSIONS_DIR, CONTEXT_FILE } from '../utils/paths.js';

interface FileChange {
  type: 'add' | 'change' | 'unlink';
  path: string;
  time: Date;
}

interface DashboardState {
  sessionActive: boolean;
  sessionId: string | null;
  startTime: Date | null;
  branch: string | null;
  filesChanged: number;
  recentChanges: FileChange[];
  contextSynced: { [tool: string]: boolean };
}

const MAX_RECENT_CHANGES = 10;
const REFRESH_INTERVAL = 1000;

class Dashboard {
  private state: DashboardState;
  private projectPath: string;
  private watcher: ReturnType<typeof watch> | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.state = {
      sessionActive: false,
      sessionId: null,
      startTime: null,
      branch: null,
      filesChanged: 0,
      recentChanges: [],
      contextSynced: {},
    };
  }

  start(): void {
    // Clear screen and hide cursor
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');

    // Load initial state
    this.loadState();

    // Watch for file changes
    this.startWatcher();

    // Periodic refresh
    this.intervalId = setInterval(() => {
      this.loadState();
      this.render();
    }, REFRESH_INTERVAL);

    // Initial render
    this.render();

    // Handle exit
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop(): void {
    // Show cursor and clear
    process.stdout.write('\x1b[?25h');

    if (this.watcher) {
      this.watcher.close();
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    process.exit(0);
  }

  private loadState(): void {
    const statePath = join(this.projectPath, DEJA_DIR, STATE_FILE);

    if (existsSync(statePath)) {
      try {
        const data = JSON.parse(readFileSync(statePath, 'utf-8'));
        this.state.sessionActive = data.active || false;
        this.state.sessionId = data.sessionId;
        this.state.startTime = data.startTime ? new Date(data.startTime) : null;
        this.state.branch = data.branch;
        this.state.filesChanged = data.filesChanged?.length || 0;
      } catch {
        // Ignore parse errors
      }
    }

    // Check context file sync status
    this.checkContextSync();
  }

  private checkContextSync(): void {
    const tools = {
      '.cursorrules': 'Cursor',
      'CLAUDE.md': 'Claude',
      '.github/copilot-instructions.md': 'Copilot',
      '.windsurfrules': 'Windsurf',
    };

    for (const [file, name] of Object.entries(tools)) {
      const filePath = join(this.projectPath, file);
      this.state.contextSynced[name] = existsSync(filePath);
    }
  }

  private startWatcher(): void {
    this.watcher = watch(this.projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.deja/**',
        '**/dist/**',
        '**/build/**',
      ],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('add', (path) => this.addChange('add', path));
    this.watcher.on('change', (path) => this.addChange('change', path));
    this.watcher.on('unlink', (path) => this.addChange('unlink', path));
  }

  private addChange(type: 'add' | 'change' | 'unlink', fullPath: string): void {
    const relativePath = relative(this.projectPath, fullPath);

    this.state.recentChanges.unshift({
      type,
      path: relativePath,
      time: new Date(),
    });

    // Keep only recent changes
    if (this.state.recentChanges.length > MAX_RECENT_CHANGES) {
      this.state.recentChanges = this.state.recentChanges.slice(0, MAX_RECENT_CHANGES);
    }

    this.render();
  }

  private formatDuration(start: Date): string {
    const diff = Date.now() - start.getTime();
    const seconds = Math.floor(diff / 1000);
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

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private render(): void {
    const width = process.stdout.columns || 120;
    const height = 6; // Fixed dashboard height

    // Move cursor to top
    process.stdout.write('\x1b[H');

    // Header bar
    const title = ' DEJA Dashboard ';
    const sessionInfo = this.state.sessionActive
      ? chalk.green('● ACTIVE')
      : chalk.yellow('○ IDLE');
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    const headerLeft = chalk.bgHex('#6366f1').white.bold(title);
    const headerRight = `${sessionInfo}  ${chalk.gray(time)} `;
    const headerPadding = width - title.length - sessionInfo.length - time.length - 10;

    console.log(headerLeft + chalk.bgHex('#1a1a2e')(' '.repeat(Math.max(0, headerPadding))) + headerRight);

    // Session info line
    let sessionLine = '';
    if (this.state.sessionActive && this.state.startTime) {
      sessionLine = [
        chalk.gray('Session:'),
        chalk.white(this.state.sessionId?.slice(0, 8) || 'unknown'),
        chalk.gray('│'),
        chalk.gray('Duration:'),
        chalk.cyan(this.formatDuration(this.state.startTime)),
        chalk.gray('│'),
        chalk.gray('Files:'),
        chalk.yellow(this.state.filesChanged.toString()),
        this.state.branch ? `${chalk.gray('│ Branch:')} ${chalk.magenta(this.state.branch)}` : '',
      ].join(' ');
    } else {
      sessionLine = chalk.gray('No active session. Run: deja start');
    }
    console.log(' ' + sessionLine);

    // Context sync status
    const syncStatus = Object.entries(this.state.contextSynced)
      .map(([tool, synced]) =>
        synced ? chalk.green(`[${tool} ✓]`) : chalk.gray(`[${tool} -]`)
      )
      .join(' ');
    console.log(' ' + syncStatus);

    // Recent changes
    const changesTitle = chalk.gray('─ Recent Changes ');
    const changesPadding = '─'.repeat(Math.max(0, width - changesTitle.length - 2));
    console.log(changesTitle + chalk.gray(changesPadding));

    if (this.state.recentChanges.length === 0) {
      console.log(chalk.gray(' Watching for file changes...'));
    } else {
      const displayChanges = this.state.recentChanges.slice(0, 2);
      for (const change of displayChanges) {
        const icon = change.type === 'add' ? chalk.green('+')
          : change.type === 'unlink' ? chalk.red('-')
          : chalk.yellow('~');
        const path = change.path.length > width - 20
          ? '...' + change.path.slice(-(width - 23))
          : change.path;
        const time = this.formatTime(change.time);
        console.log(` ${icon} ${chalk.white(path)} ${chalk.gray(time)}`);
      }
    }

    // Bottom border
    console.log(chalk.gray('─'.repeat(width)));
  }
}

// Run dashboard if executed directly
const projectPath = process.cwd();
const dashboard = new Dashboard(projectPath);
dashboard.start();

export { Dashboard };
