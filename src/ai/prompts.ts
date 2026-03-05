/**
 * DEJA AI Prompts
 * Prompt templates for AI summarization and knowledge extraction
 */

/**
 * Prompt for summarizing a coding session
 * Instructs the AI to analyze file changes and notes to produce a structured summary
 */
export const SESSION_SUMMARY_PROMPT = `You are a coding session analyzer. Your task is to analyze a developer's coding session and produce a concise, structured summary.

You will receive:
- A list of file changes (files added, modified, or deleted)
- Git diffs showing what changed in each file
- Any manual notes the developer added during the session
- The git branch name if available

Analyze this information and produce a JSON response with the following structure:
{
  "overview": "A brief 1-2 sentence summary of what was accomplished in this session",
  "decisions": ["Array of key technical decisions made (e.g., 'Chose Redis for caching', 'Switched from REST to GraphQL')"],
  "patterns": ["Array of coding patterns or conventions established or followed (e.g., 'All API routes use try-catch with consistent error format', 'Using factory functions for test data')"],
  "issues": ["Array of known issues, bugs, or problems discovered (e.g., 'Session cookies not persisting on Safari', 'Memory leak in WebSocket handler')"]
}

Guidelines:
- Be concise and specific. Focus on what's most important.
- The overview should capture the main theme or goal of the session.
- Decisions are architectural or technical choices that affect how the code works.
- Patterns are recurring code structures, conventions, or approaches.
- Issues are bugs, problems, or known limitations discovered but not necessarily fixed.
- If a category has no items, use an empty array [].
- Return ONLY valid JSON, no markdown formatting or extra text.

Session Data:
`;

/**
 * Prompt for extracting long-term knowledge from sessions
 * Used to identify learnings that should persist beyond individual sessions
 */
export const KNOWLEDGE_EXTRACTION_PROMPT = `You are a knowledge extraction system for a software project. Your task is to analyze session summaries and extract long-term learnings that should be remembered across future sessions.

You will receive:
- Recent session summaries with their decisions, patterns, and issues
- The current knowledge base (if any)

Extract and categorize knowledge that:
1. Represents important architectural decisions
2. Documents established coding patterns and conventions
3. Tracks unresolved issues that need attention
4. Captures learnings that will help future development

Produce a JSON response with the following structure:
{
  "decisions": [
    {
      "content": "Description of the decision",
      "reason": "Why this decision was made (if known)",
      "importance": "high" | "medium" | "low"
    }
  ],
  "patterns": [
    {
      "content": "Description of the pattern or convention",
      "example": "Brief code example if applicable",
      "importance": "high" | "medium" | "low"
    }
  ],
  "issues": [
    {
      "content": "Description of the issue",
      "status": "open" | "investigating" | "workaround",
      "importance": "high" | "medium" | "low"
    }
  ],
  "learnings": [
    {
      "content": "General learning or insight",
      "importance": "high" | "medium" | "low"
    }
  ]
}

Guidelines:
- Focus on information that will be valuable in future sessions.
- Avoid duplicating information already in the knowledge base.
- Mark importance based on impact on development workflow.
- High importance: Affects architecture, security, or major functionality.
- Medium importance: Affects code organization or developer experience.
- Low importance: Nice-to-know but not critical.
- Return ONLY valid JSON, no markdown formatting or extra text.

Data to analyze:
`;

/**
 * Formats session data for the summarization prompt
 * Accepts the Session type structure with manualNotes
 */
export function formatSessionForPrompt(session: {
  branch?: string | null;
  changes: Array<{ type: string; path: string; diff?: string }>;
  manualNotes?: Array<{ content: string; timestamp: number }>;
}): string {
  const parts: string[] = [];

  // Branch info
  if (session.branch) {
    parts.push(`Branch: ${session.branch}`);
  }

  // File changes
  if (session.changes.length > 0) {
    parts.push('\nFile Changes:');

    const changesByType = {
      added: session.changes.filter(c => c.type === 'added'),
      modified: session.changes.filter(c => c.type === 'modified'),
      deleted: session.changes.filter(c => c.type === 'deleted'),
    };

    if (changesByType.added.length > 0) {
      parts.push(`\nAdded (${changesByType.added.length} files):`);
      changesByType.added.forEach(c => parts.push(`  + ${c.path}`));
    }

    if (changesByType.modified.length > 0) {
      parts.push(`\nModified (${changesByType.modified.length} files):`);
      changesByType.modified.forEach(c => {
        parts.push(`  ~ ${c.path}`);
        if (c.diff) {
          // Truncate long diffs
          const truncatedDiff = c.diff.length > 1000
            ? c.diff.substring(0, 1000) + '\n... (truncated)'
            : c.diff;
          parts.push(`    ${truncatedDiff.split('\n').join('\n    ')}`);
        }
      });
    }

    if (changesByType.deleted.length > 0) {
      parts.push(`\nDeleted (${changesByType.deleted.length} files):`);
      changesByType.deleted.forEach(c => parts.push(`  - ${c.path}`));
    }
  } else {
    parts.push('\nNo file changes recorded.');
  }

  // Manual notes
  const notes = session.manualNotes || [];
  if (notes.length > 0) {
    parts.push('\nDeveloper Notes:');
    notes.forEach(note => {
      const time = new Date(note.timestamp).toLocaleTimeString();
      parts.push(`  [${time}] ${note.content}`);
    });
  }

  return parts.join('\n');
}

/**
 * Parses AI response into SessionSummary, handling potential JSON issues
 */
export function parseSessionSummary(response: string): {
  overview: string;
  decisions: string[];
  patterns: string[];
  issues: string[];
} | null {
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (typeof parsed.overview !== 'string') {
      return null;
    }

    return {
      overview: parsed.overview || '',
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return null;
  }
}
