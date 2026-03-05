import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import type { SessionLog, SearchResult } from '../types.js';

const DEJA_DIR = '.deja';
const SESSIONS_DIR = 'sessions';

async function checkInitialized(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, DEJA_DIR));
    return true;
  } catch {
    return false;
  }
}

function highlightMatch(text: string, query: string): string {
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, chalk.yellow.bold('$1'));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getAllSessions(cwd: string): Promise<SessionLog[]> {
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

    return sessions;
  } catch {
    return [];
  }
}

function searchInSession(session: SessionLog, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  const sessionId = session.sessionId || session.id || 'unknown';
  const sessionTime = typeof session.startTime === 'number'
    ? session.startTime
    : new Date(session.startTime).getTime();

  // Search in file paths
  const files = session.filesChanged || [];
  for (const file of files) {
    if (file.toLowerCase().includes(queryLower)) {
      results.push({
        sessionId,
        sessionTime,
        match: file,
        matchType: 'file_change',
      });
    }
  }

  // Search in changes (if they have paths)
  const changes = session.changes || [];
  for (const change of changes) {
    if (change.path && change.path.toLowerCase().includes(queryLower)) {
      // Avoid duplicates with filesChanged
      if (!files.includes(change.path)) {
        results.push({
          sessionId,
          sessionTime,
          match: change.path,
          matchType: 'file_change',
        });
      }
    }
  }

  // Search in notes
  const notes = session.notes || [];
  for (const note of notes) {
    if (note.content.toLowerCase().includes(queryLower)) {
      results.push({
        sessionId,
        sessionTime,
        match: note.content,
        matchType: 'note',
      });
    }
  }

  // Search in summary
  if (session.summary) {
    if (typeof session.summary === 'string') {
      if (session.summary.toLowerCase().includes(queryLower)) {
        results.push({
          sessionId,
          sessionTime,
          match: session.summary,
          matchType: 'summary',
        });
      }
    } else if (typeof session.summary === 'object') {
      // Search in overview
      if (session.summary.overview?.toLowerCase().includes(queryLower)) {
        results.push({
          sessionId,
          sessionTime,
          match: session.summary.overview,
          matchType: 'summary',
        });
      }
      // Search in decisions
      for (const decision of session.summary.decisions || []) {
        if (decision.toLowerCase().includes(queryLower)) {
          results.push({
            sessionId,
            sessionTime,
            match: decision,
            matchType: 'decision',
          });
        }
      }
      // Search in patterns
      for (const pattern of session.summary.patterns || []) {
        if (pattern.toLowerCase().includes(queryLower)) {
          results.push({
            sessionId,
            sessionTime,
            match: pattern,
            matchType: 'pattern',
          });
        }
      }
      // Search in issues
      for (const issue of session.summary.issues || []) {
        if (issue.toLowerCase().includes(queryLower)) {
          results.push({
            sessionId,
            sessionTime,
            match: issue,
            matchType: 'issue',
          });
        }
      }
    }
  }

  return results;
}

async function searchAction(query: string): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  if (!query || query.trim() === '') {
    console.log(chalk.red('  Search query cannot be empty.\n'));
    process.exit(1);
  }

  const sessions = await getAllSessions(cwd);

  if (sessions.length === 0) {
    console.log(chalk.yellow('  No sessions found to search.'));
    console.log(chalk.gray('  Start a session with `deja start` and stop it with `deja stop`.\n'));
    return;
  }

  // Search across all sessions
  const allResults: SearchResult[] = [];
  for (const session of sessions) {
    const results = searchInSession(session, query.trim());
    allResults.push(...results);
  }

  if (allResults.length === 0) {
    console.log(chalk.yellow(`  No results found for "${query}".`));
    console.log(chalk.gray('  Try a different search term.\n'));
    return;
  }

  // Sort by session time (newest first)
  allResults.sort((a, b) => b.sessionTime - a.sessionTime);

  console.log(chalk.blue(`  Search Results for "${query}" (${allResults.length} matches)\n`));

  // Group results by session
  const groupedResults = new Map<string, SearchResult[]>();
  for (const result of allResults) {
    const existing = groupedResults.get(result.sessionId) || [];
    existing.push(result);
    groupedResults.set(result.sessionId, existing);
  }

  for (const [sessionId, results] of groupedResults) {
    const sessionDate = new Date(results[0].sessionTime).toLocaleString();
    console.log(chalk.white(`  ${chalk.bold(sessionId)} ${chalk.gray(`(${sessionDate})`)}`));

    for (const result of results) {
      const typeLabel = getTypeLabel(result.matchType);
      const highlightedMatch = highlightMatch(truncateMatch(result.match), query);
      console.log(chalk.gray(`    ${typeLabel}: ${highlightedMatch}`));
    }
    console.log('');
  }
}

function getTypeLabel(matchType: SearchResult['matchType']): string {
  const labels: Record<SearchResult['matchType'], string> = {
    file_change: chalk.cyan('[file]'),
    note: chalk.green('[note]'),
    summary: chalk.blue('[summary]'),
    decision: chalk.magenta('[decision]'),
    pattern: chalk.yellow('[pattern]'),
    issue: chalk.red('[issue]'),
  };
  return labels[matchType] || '[unknown]';
}

function truncateMatch(match: string, maxLength: number = 100): string {
  if (match.length <= maxLength) return match;
  return match.substring(0, maxLength) + '...';
}

export const searchCommand = new Command('search')
  .description('Search across all session logs')
  .argument('<query>', 'The search query')
  .action(searchAction);
