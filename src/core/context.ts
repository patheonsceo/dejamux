/**
 * DEJA Context Compiler
 * Generates markdown context from sessions and knowledge for AI tool consumption
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { Session, Knowledge, ProjectInfo } from '../types.js';
import { getAdapter, getAllAdapters } from '../adapters/index.js';

/**
 * Format a timestamp as a readable date string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format a timestamp as ISO date string
 */
function formatISODate(timestamp: number): string {
  return new Date(timestamp).toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Generate the project overview section
 */
function generateProjectOverview(projectInfo?: ProjectInfo, branch?: string): string {
  const lines: string[] = ['## Project Overview'];

  if (projectInfo?.name) {
    lines.push(`- **Name:** ${projectInfo.name}`);
  }

  if (projectInfo?.stack && projectInfo.stack.length > 0) {
    lines.push(`- **Stack:** ${projectInfo.stack.join(', ')}`);
  }

  if (branch || projectInfo?.branch) {
    lines.push(`- **Branch:** ${branch || projectInfo?.branch}`);
  }

  return lines.join('\n');
}

/**
 * Generate a single session summary section
 */
function generateSessionSection(session: Session, isCurrent: boolean = false): string {
  const lines: string[] = [];
  const dateStr = formatDate(session.startTime);
  const currentTag = isCurrent ? ' (current)' : '';

  lines.push(`### Session: ${dateStr}${currentTag}`);

  // Add summary if available
  if (session.summary) {
    // Add overview
    if (session.summary.overview) {
      lines.push(`- ${session.summary.overview}`);
    }
    // Add decisions
    if (session.summary.decisions?.length) {
      for (const decision of session.summary.decisions) {
        lines.push(`- Decision: ${decision}`);
      }
    }
    // Add key issues
    if (session.summary.issues?.length) {
      for (const issue of session.summary.issues) {
        lines.push(`- Issue: ${issue}`);
      }
    }
  } else {
    // Fallback to change statistics
    const added = session.changes.filter((c) => c.type === 'added').length;
    const modified = session.changes.filter((c) => c.type === 'modified').length;
    const deleted = session.changes.filter((c) => c.type === 'deleted').length;

    if (added > 0) lines.push(`- Added ${added} file${added > 1 ? 's' : ''}`);
    if (modified > 0) lines.push(`- Modified ${modified} file${modified > 1 ? 's' : ''}`);
    if (deleted > 0) lines.push(`- Deleted ${deleted} file${deleted > 1 ? 's' : ''}`);

    // Add notes if present
    if (session.notes && session.notes.length > 0) {
      for (const note of session.notes) {
        lines.push(`- Note: ${note.content}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate the recent sessions section
 */
function generateRecentSessions(sessions: Session[]): string {
  if (sessions.length === 0) {
    return '## Recent Sessions\n\nNo sessions recorded yet.';
  }

  const lines: string[] = ['## Recent Sessions'];

  // Sort sessions by start time (most recent first)
  const sortedSessions = [...sessions].sort((a, b) => b.startTime - a.startTime);

  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i];
    const isCurrent = i === 0 && !session.endTime;
    lines.push('');
    lines.push(generateSessionSection(session, isCurrent));
  }

  return lines.join('\n');
}

/**
 * Generate the active decisions section
 */
function generateDecisions(knowledge: Knowledge): string {
  if (!knowledge.decisions || knowledge.decisions.length === 0) {
    return '';
  }

  const lines: string[] = ['## Active Decisions'];

  for (const decision of knowledge.decisions) {
    if (typeof decision === 'string') {
      lines.push(`- ${decision}`);
    } else {
      const dateInfo = decision.date ? ` (decided ${decision.date})` : '';
      lines.push(`- ${decision.description}${dateInfo}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate the known issues section
 */
function generateKnownIssues(knowledge: Knowledge): string {
  const issues = knowledge.issues || [];
  const activeIssues = issues.filter((issue) => {
    if (typeof issue === 'string') return true;
    return issue.status === 'active';
  });

  if (activeIssues.length === 0) {
    return '';
  }

  const lines: string[] = ['## Known Issues'];

  for (const issue of activeIssues) {
    if (typeof issue === 'string') {
      lines.push(`- ${issue}`);
    } else {
      lines.push(`- ${issue.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate the key patterns section
 */
function generateKeyPatterns(knowledge: Knowledge): string {
  if (!knowledge.patterns || knowledge.patterns.length === 0) {
    return '';
  }

  const lines: string[] = ['## Key Patterns'];

  for (const pattern of knowledge.patterns) {
    if (typeof pattern === 'string') {
      lines.push(`- ${pattern}`);
    } else {
      lines.push(`- ${pattern.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Compile context from sessions and knowledge into a markdown string
 * This is the core context that will be formatted by each tool adapter
 *
 * @param sessions - Array of recent sessions to include
 * @param knowledge - Long-term knowledge base
 * @param projectInfo - Optional project metadata
 * @returns Compiled markdown context string
 */
export function compileContext(
  sessions: Session[],
  knowledge: Knowledge,
  projectInfo?: ProjectInfo
): string {
  const now = new Date();
  const lastUpdated = formatISODate(now.getTime());

  // Get current branch from most recent session
  const currentBranch = sessions.length > 0 ? (sessions[0].branch ?? undefined) : undefined;

  const sections: string[] = [
    `# Project Context (Auto-generated by DEJA)`,
    `# Last updated: ${lastUpdated}`,
    '',
    generateProjectOverview(projectInfo, currentBranch),
    '',
    generateRecentSessions(sessions),
  ];

  // Add knowledge sections if they have content
  const decisionsSection = generateDecisions(knowledge);
  if (decisionsSection) {
    sections.push('', decisionsSection);
  }

  const issuesSection = generateKnownIssues(knowledge);
  if (issuesSection) {
    sections.push('', issuesSection);
  }

  const patternsSection = generateKeyPatterns(knowledge);
  if (patternsSection) {
    sections.push('', patternsSection);
  }

  return sections.join('\n');
}

/**
 * Update context files for all specified tools
 *
 * @param projectPath - Absolute path to the project root
 * @param context - Compiled context string
 * @param tools - Array of tool names to update (e.g., ['cursor', 'claude-code'])
 */
export function updateAllContextFiles(
  projectPath: string,
  context: string,
  tools: string[]
): void {
  for (const toolName of tools) {
    const adapter = getAdapter(toolName);
    if (!adapter) {
      console.warn(`Unknown tool adapter: ${toolName}`);
      continue;
    }

    const outputPath = join(projectPath, adapter.file);
    const outputDir = dirname(outputPath);

    // Create directory if needed (e.g., .github for copilot)
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Format context with tool-specific additions and write
    const formattedContext = adapter.format(context);
    writeFileSync(outputPath, formattedContext, 'utf-8');
  }
}

/**
 * Update context files for all detected tools
 *
 * @param projectPath - Absolute path to the project root
 * @param context - Compiled context string
 */
export function updateAllDetectedContextFiles(projectPath: string, context: string): void {
  const allAdapters = getAllAdapters();

  for (const adapter of allAdapters) {
    const outputPath = join(projectPath, adapter.file);
    const outputDir = dirname(outputPath);

    // Only update if the tool's context file or directory exists
    // This respects user's choice of which tools to use
    if (existsSync(outputPath) || existsSync(outputDir)) {
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const formattedContext = adapter.format(context);
      writeFileSync(outputPath, formattedContext, 'utf-8');
    }
  }
}

/**
 * Create empty knowledge base
 */
export function createEmptyKnowledge(): Knowledge {
  return {
    decisions: [],
    patterns: [],
    issues: [],
    lastUpdated: Date.now(),
  };
}
