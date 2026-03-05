import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import type { SessionLog } from '../types.js';

const DEJA_DIR = '.deja';
const CONTEXT_FILE = 'context.md';
const SESSIONS_DIR = 'sessions';

async function checkInitialized(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, DEJA_DIR));
    return true;
  } catch {
    return false;
  }
}

async function getContextFile(cwd: string): Promise<string | null> {
  try {
    const contextPath = path.join(cwd, DEJA_DIR, CONTEXT_FILE);
    const content = await fs.readFile(contextPath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

async function getRecentSessions(cwd: string, limit: number = 5): Promise<SessionLog[]> {
  const sessionsPath = path.join(cwd, DEJA_DIR, SESSIONS_DIR);

  try {
    const files = await fs.readdir(sessionsPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const sessions: SessionLog[] = [];
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(sessionsPath, file), 'utf-8');
        const session = JSON.parse(content) as SessionLog;
        sessions.push(session);
      } catch {
        // Skip invalid files
      }
    }

    // Sort by start time (newest first)
    sessions.sort((a, b) => {
      const timeA = typeof a.startTime === 'number' ? a.startTime : new Date(a.startTime).getTime();
      const timeB = typeof b.startTime === 'number' ? b.startTime : new Date(b.startTime).getTime();
      return timeB - timeA;
    });

    return sessions.slice(0, limit);
  } catch {
    return [];
  }
}

function compileContextFromSessions(sessions: SessionLog[]): string {
  if (sessions.length === 0) {
    return '# DEJA Context\n\nNo sessions recorded yet.';
  }

  const lines: string[] = ['# DEJA Context', ''];
  lines.push(`*Generated from ${sessions.length} recent session(s)*`, '');

  // Collect decisions, patterns, and issues from all sessions
  const decisions: string[] = [];
  const patterns: string[] = [];
  const issues: string[] = [];
  const recentFiles = new Set<string>();

  for (const session of sessions) {
    // Collect files
    const files = session.filesChanged || [];
    files.forEach(f => recentFiles.add(f));

    const changes = session.changes || [];
    changes.forEach(c => {
      if (c.path) recentFiles.add(c.path);
    });

    // Collect from summary
    if (session.summary && typeof session.summary === 'object') {
      decisions.push(...(session.summary.decisions || []));
      patterns.push(...(session.summary.patterns || []));
      issues.push(...(session.summary.issues || []));
    }
  }

  // Recent Sessions
  lines.push('## Recent Sessions', '');
  for (const session of sessions) {
    const sessionId = session.sessionId || session.id || 'unknown';
    const startDate = new Date(session.startTime).toLocaleString();
    const filesCount = (session.filesChanged?.length || 0) + (session.changes?.length || 0);

    lines.push(`### ${sessionId}`);
    lines.push(`- **Date**: ${startDate}`);
    lines.push(`- **Branch**: ${session.branch || 'unknown'}`);
    lines.push(`- **Files changed**: ${filesCount}`);

    if (session.summary) {
      if (typeof session.summary === 'string') {
        lines.push(`- **Summary**: ${session.summary}`);
      } else if (session.summary.overview) {
        lines.push(`- **Summary**: ${session.summary.overview}`);
      }
    }

    // Notes
    if (session.notes && session.notes.length > 0) {
      lines.push('- **Notes**:');
      for (const note of session.notes) {
        lines.push(`  - ${note.content}`);
      }
    }

    lines.push('');
  }

  // Decisions
  if (decisions.length > 0) {
    lines.push('## Key Decisions', '');
    const uniqueDecisions = [...new Set(decisions)];
    for (const decision of uniqueDecisions) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  // Patterns
  if (patterns.length > 0) {
    lines.push('## Code Patterns', '');
    const uniquePatterns = [...new Set(patterns)];
    for (const pattern of uniquePatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // Issues
  if (issues.length > 0) {
    lines.push('## Known Issues', '');
    const uniqueIssues = [...new Set(issues)];
    for (const issue of uniqueIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  // Recently modified files
  if (recentFiles.size > 0) {
    lines.push('## Recently Modified Files', '');
    const sortedFiles = [...recentFiles].sort();
    for (const file of sortedFiles.slice(0, 20)) {
      lines.push(`- ${file}`);
    }
    if (sortedFiles.length > 20) {
      lines.push(`- ... and ${sortedFiles.length - 20} more`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function contextAction(): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  // Try to read existing context file
  const existingContext = await getContextFile(cwd);

  if (existingContext) {
    console.log(chalk.blue('  DEJA Context (from .deja/context.md)\n'));
    console.log(chalk.gray('  ' + '-'.repeat(50)));
    console.log('');
    // Indent each line for display
    const lines = existingContext.split('\n');
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    console.log('');
    console.log(chalk.gray('  ' + '-'.repeat(50)));
    console.log('');
  } else {
    // Compile context from recent sessions
    console.log(chalk.blue('  DEJA Context (compiled from recent sessions)\n'));

    const sessions = await getRecentSessions(cwd);
    const compiledContext = compileContextFromSessions(sessions);

    console.log(chalk.gray('  ' + '-'.repeat(50)));
    console.log('');
    const lines = compiledContext.split('\n');
    for (const line of lines) {
      console.log(`  ${line}`);
    }
    console.log('');
    console.log(chalk.gray('  ' + '-'.repeat(50)));
    console.log('');

    if (sessions.length === 0) {
      console.log(chalk.gray('  No sessions recorded yet.'));
      console.log(chalk.gray('  Start a session with `deja start` and stop it with `deja stop`.\n'));
    }
  }

  console.log(chalk.gray('  This is what will be injected into your AI tool context files.\n'));
}

export const contextCommand = new Command('context')
  .description('Show what will be injected into AI tools')
  .action(contextAction);
