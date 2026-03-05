/**
 * DEJA - Developer Episodic Journal for Agents
 * Core TypeScript type definitions
 *
 * These types define the structure for DEJA's universal memory layer,
 * enabling persistent context across AI coding tools.
 */

// =============================================================================
// AI Provider Types
// =============================================================================

/**
 * Supported AI providers for session summarization.
 * - 'ollama': Local LLM (free, private, offline-capable)
 * - 'openai': OpenAI API (cloud)
 * - 'anthropic': Anthropic API (cloud)
 * - 'none': No AI summarization, raw structured logs only
 * Also supports tool names for primary tool selection.
 */
export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'none' | 'cursor' | 'claude' | 'copilot' | 'windsurf' | 'aider';

/**
 * Configuration for AI-powered session summarization.
 * Controls which provider is used to compress session logs into concise summaries.
 */
export interface AIConfig {
  /**
   * The AI provider to use for summarization.
   * @default 'ollama'
   */
  provider: AIProvider;

  /**
   * The model name to use with the chosen provider.
   * @example 'llama3.2' for Ollama, 'gpt-4' for OpenAI, 'claude-3-haiku' for Anthropic
   */
  model: string;

  /**
   * API key for cloud providers (OpenAI/Anthropic).
   * Not required for 'ollama' or 'none' providers.
   */
  api_key?: string;

  /**
   * Base URL for the AI provider API.
   * Useful for custom Ollama installations or API proxies.
   */
  base_url?: string;
}

// =============================================================================
// Session Configuration
// =============================================================================

/**
 * Configuration options for session behavior.
 * Controls automatic session management and context window size.
 */
export interface SessionConfig {
  /**
   * Automatically start a session when file changes are detected.
   * @default true
   */
  auto_start: boolean;

  /**
   * Duration of inactivity after which a session is automatically stopped.
   * Accepts time strings like '30m', '1h', or number of milliseconds.
   * @example '30m' for 30 minutes of inactivity
   */
  auto_stop_after: string;

  /**
   * Maximum number of recent sessions to include in the context.
   * Older sessions are summarized into knowledge.md instead.
   * @default 5
   */
  max_sessions_in_context: number;
}

// =============================================================================
// Capture Configuration
// =============================================================================

/**
 * Configuration for what data to capture during a session.
 * Controls the granularity of session logs.
 */
export interface CaptureConfig {
  /**
   * Track file creation, modification, and deletion events.
   * @default true
   */
  file_changes: boolean;

  /**
   * Include git diff output for modified files.
   * Provides detailed change context but increases log size.
   * @default true
   */
  git_diffs: boolean;

  /**
   * Track and include current git branch information.
   * Helps maintain context when switching branches.
   * @default true
   */
  branch_info: boolean;
}

// =============================================================================
// Main Configuration
// =============================================================================

/**
 * Supported AI coding tools that DEJA can generate context files for.
 */
export type SupportedTool = 'cursor' | 'claude-code' | 'copilot' | 'windsurf';

/**
 * Context file paths for each AI tool.
 */
export interface ContextFilesConfig {
  cursor: string;
  claude: string;
  copilot: string;
  windsurf: string;
  aider: string;
}

/**
 * Complete DEJA configuration structure.
 * Maps directly to .deja/config.yml file format.
 */
export interface DejaConfig {
  /**
   * Config version.
   */
  version?: string;

  /**
   * Primary AI provider for the tool.
   */
  aiProvider?: string;

  /**
   * Auto-sync context files.
   */
  autoSync?: boolean;

  /**
   * Paths to watch for changes.
   */
  watchPaths?: string[];

  /**
   * Paths to ignore.
   */
  ignorePaths?: string[];

  /**
   * Context file paths for each tool.
   */
  contextFiles?: ContextFilesConfig;

  /**
   * List of AI tools to generate context files for.
   * DEJA will create and update the appropriate context file for each tool.
   * @example ['cursor', 'claude-code', 'copilot']
   */
  tools?: SupportedTool[];

  /**
   * AI provider configuration for session summarization.
   */
  ai?: AIConfig;

  /**
   * Session behavior configuration.
   */
  session?: SessionConfig;

  /**
   * Data capture configuration.
   */
  capture?: CaptureConfig;

  /**
   * Additional file/directory patterns to ignore.
   * These are added to the default ignore list (node_modules, .git, etc.).
   * Supports glob patterns.
   * @example ['*.log', 'tmp/', '.env']
   */
  ignore?: string[];
}

// =============================================================================
// File Change Tracking
// =============================================================================

/**
 * Type of file change detected during a session.
 */
export type FileChangeType = 'added' | 'modified' | 'deleted';

// Aliases for compatibility
export type FileChangeTypeShort = 'add' | 'modify' | 'delete';

/**
 * Map short change types to full types
 */
export function normalizeChangeType(type: FileChangeTypeShort | FileChangeType): FileChangeType {
  const map: Record<string, FileChangeType> = {
    'add': 'added',
    'modify': 'modified',
    'delete': 'deleted',
    'added': 'added',
    'modified': 'modified',
    'deleted': 'deleted'
  };
  return map[type] || 'modified';
}

/**
 * Represents a single file change captured during a session.
 */
export interface FileChange {
  /**
   * The type of change that occurred.
   */
  type: FileChangeType;

  /**
   * Relative path to the changed file from project root.
   * @example 'src/components/Header.tsx'
   */
  path: string;

  /**
   * Unix timestamp (milliseconds) when the change was detected.
   */
  timestamp: number;

  /**
   * Git diff output for the file (if capture.git_diffs is enabled).
   * Only populated for 'modified' changes when the file is tracked by git.
   */
  diff?: string;
}

// =============================================================================
// Manual Notes
// =============================================================================

/**
 * A user-added note captured during a session.
 * Created via `deja note "..."` command.
 */
export interface ManualNote {
  /**
   * The content of the note.
   * @example 'Decided to use Redis for session storage instead of JWT'
   */
  content: string;

  /**
   * Unix timestamp (milliseconds) when the note was added.
   */
  timestamp: number;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Compressed summary of a session, generated by AI or structured extraction.
 * Contains the key insights extracted from raw session data.
 */
export interface SessionSummary {
  /**
   * High-level overview of what was accomplished in this session.
   * @example 'Refactored auth middleware to support API keys alongside JWT'
   */
  overview: string;

  /**
   * Key decisions made during the session.
   * @example ['Using Redis for rate limiting instead of in-memory store']
   */
  decisions: string[];

  /**
   * Code patterns discovered or established.
   * @example ['All API routes follow: validate -> authorize -> execute -> respond']
   */
  patterns: string[];

  /**
   * Known issues or bugs identified during the session.
   * @example ['Webhook signature verification fails on localhost']
   */
  issues: string[];
}

/**
 * A complete coding session record.
 * Contains all captured data from session start to stop.
 */
export interface Session {
  /**
   * Unique identifier for the session.
   * @example '2026-03-04_14-30' (timestamp-based)
   */
  id: string;

  /**
   * Unix timestamp (milliseconds) when the session started.
   */
  startTime: number;

  /**
   * Unix timestamp (milliseconds) when the session ended.
   * Null/undefined if the session is still active.
   */
  endTime?: number | null;

  /**
   * Git branch name at session start.
   * @example 'feature/user-dashboard'
   */
  branch?: string | null;

  /**
   * All file changes captured during this session.
   */
  changes: FileChange[];

  /**
   * All manual notes added during this session (alias: manualNotes).
   */
  notes?: ManualNote[];

  /**
   * All manual notes added during this session.
   */
  manualNotes?: ManualNote[];

  /**
   * AI-generated or extracted summary of the session.
   * Null until the session is stopped and processed.
   */
  summary?: SessionSummary | null;
}

// =============================================================================
// Tool Adapters
// =============================================================================

/**
 * Adapter interface for generating context files for different AI coding tools.
 * Each supported tool has its own adapter that transforms DEJA context
 * into the format expected by that tool.
 */
export interface ToolAdapter {
  /**
   * Display name of the tool.
   * @example 'Cursor'
   */
  name: string;

  /**
   * Path to the context file, relative to project root.
   * @example '.cursorrules' for Cursor, 'CLAUDE.md' for Claude Code
   */
  file: string;

  /**
   * Transform DEJA context into the tool's expected format.
   * @param context - The compiled context markdown from .deja/context.md
   * @returns Formatted content for the tool's context file
   */
  format: (context: string) => string;
}

/**
 * Map of tool identifiers to their adapters.
 */
export type ToolAdapterMap = Record<SupportedTool, ToolAdapter>;

// =============================================================================
// Runtime State
// =============================================================================

/**
 * Current runtime state of DEJA.
 * Tracks the active session and watcher status.
 */
export interface DejaState {
  /**
   * The currently active session, if any.
   * Null when no session is in progress.
   */
  currentSession: Session | null;

  /**
   * Whether the file watcher is currently active.
   */
  isWatching: boolean;

  /**
   * Absolute path to the .deja/config.yml file.
   * Null if DEJA hasn't been initialized in the current directory.
   */
  configPath: string | null;

  /**
   * Absolute path to the project root directory.
   * The directory containing the .deja folder.
   */
  projectRoot: string | null;

  /**
   * Timestamp of the last detected file activity.
   * Used for auto-stop inactivity timeout calculation.
   */
  lastActivity: number | null;
}

// =============================================================================
// Context & Knowledge Types
// =============================================================================

/**
 * Compiled context ready for injection into AI tools.
 * Generated from recent sessions and long-term knowledge.
 */
export interface CompiledContext {
  /**
   * Project name (derived from package.json or directory name).
   */
  projectName: string;

  /**
   * Detected tech stack.
   * @example 'Next.js 15, Supabase, Tailwind, TypeScript'
   */
  stack: string | null;

  /**
   * Current git branch.
   */
  currentBranch: string | null;

  /**
   * Recent sessions included in context (newest first).
   */
  recentSessions: Session[];

  /**
   * Active architectural decisions extracted from sessions.
   */
  activeDecisions: string[];

  /**
   * Known issues tracked across sessions.
   */
  knownIssues: string[];

  /**
   * Established code patterns.
   */
  keyPatterns: string[];

  /**
   * Timestamp when this context was generated.
   */
  lastUpdated: number;
}

/**
 * Long-term knowledge extracted and accumulated across many sessions.
 * Stored in .deja/knowledge.md
 */
export interface KnowledgeBase {
  /**
   * Architectural decisions that should persist long-term.
   */
  decisions: string[];

  /**
   * Established patterns and conventions for this project.
   */
  patterns: string[];

  /**
   * Historical issues and their resolutions.
   */
  resolvedIssues: Array<{
    issue: string;
    resolution: string;
    timestamp: number;
  }>;

  /**
   * Timestamp of last knowledge base update.
   */
  lastUpdated: number;
}

// =============================================================================
// Command Result Types
// =============================================================================

/**
 * Result of a DEJA CLI command execution.
 */
export interface CommandResult {
  /**
   * Whether the command succeeded.
   */
  success: boolean;

  /**
   * Human-readable message describing the result.
   */
  message: string;

  /**
   * Optional additional data returned by the command.
   */
  data?: unknown;
}

/**
 * Status information returned by `deja status` command.
 */
export interface StatusInfo {
  /**
   * Whether DEJA is initialized in the current directory.
   */
  initialized: boolean;

  /**
   * Whether a session is currently active.
   */
  sessionActive: boolean;

  /**
   * Current session info (if active).
   */
  currentSession: {
    id: string;
    startTime: number;
    duration: number;
    filesChanged: number;
    notesCount: number;
  } | null;

  /**
   * Number of total sessions recorded.
   */
  totalSessions: number;

  /**
   * Configured AI tools.
   */
  configuredTools: SupportedTool[];
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * A single search result from `deja search` command.
 */
export interface SearchResult {
  /**
   * Session ID where the match was found.
   */
  sessionId: string;

  /**
   * Session date/time.
   */
  sessionTime: number;

  /**
   * The matched content snippet.
   */
  match: string;

  /**
   * Type of content where match was found.
   */
  matchType: 'file_change' | 'note' | 'summary' | 'decision' | 'pattern' | 'issue';
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events emitted by the DEJA core engine.
 */
export type DejaEvent =
  | { type: 'session:start'; session: Session }
  | { type: 'session:stop'; session: Session }
  | { type: 'file:change'; change: FileChange }
  | { type: 'note:add'; note: ManualNote }
  | { type: 'context:update'; tools: SupportedTool[] }
  | { type: 'error'; error: Error; context?: string };

/**
 * Event handler function type.
 */
export type DejaEventHandler = (event: DejaEvent) => void;

// =============================================================================
// Session Capture Options
// =============================================================================

/**
 * Options for initializing the SessionCapture class.
 */
export interface SessionCaptureOptions {
  /**
   * Absolute path to the project root directory.
   */
  projectRoot: string;

  /**
   * Additional ignore patterns from config.
   */
  ignorePatterns?: string[];

  /**
   * Whether to capture git diffs.
   * @default true
   */
  captureGitDiffs?: boolean;
}

// =============================================================================
// Detected AI Files
// =============================================================================

/**
 * Result of detecting existing AI tool configuration files.
 * Used during `deja init` to auto-detect which tools are in use.
 */
export interface DetectedAIFiles {
  /**
   * Whether .cursorrules file exists.
   */
  cursorrules: boolean;

  /**
   * Whether CLAUDE.md file exists.
   */
  claudeMd: boolean;

  /**
   * Whether .github/copilot-instructions.md exists.
   */
  copilotInstructions: boolean;

  /**
   * Whether .windsurfrules file exists.
   */
  windsurfRules: boolean;

  /**
   * Whether .aider.conventions.md exists.
   */
  aiderConvention: boolean;
}

// =============================================================================
// AI Summarization Result
// =============================================================================

/**
 * Result of an AI summarization attempt.
 */
export interface SummarizationResult {
  /**
   * Whether summarization succeeded.
   */
  success: boolean;

  /**
   * The session summary if successful.
   */
  summary?: SessionSummary;

  /**
   * Error message if summarization failed.
   */
  error?: string;
}

// =============================================================================
// Session Status (for active session display)
// =============================================================================

/**
 * Current status of an active session for display purposes.
 */
export interface SessionStatus {
  /**
   * Whether a session is currently active.
   */
  isActive: boolean;

  /**
   * Session start time (undefined if no active session).
   */
  startTime?: number;

  /**
   * Duration in milliseconds since session start.
   */
  duration?: number;

  /**
   * Total number of files changed so far.
   */
  filesChanged: number;

  /**
   * Number of files added.
   */
  filesAdded: number;

  /**
   * Number of files modified.
   */
  filesModified: number;

  /**
   * Number of files deleted.
   */
  filesDeleted: number;

  /**
   * Number of notes added.
   */
  notesCount: number;

  /**
   * Current git branch.
   */
  branch?: string;
}

// =============================================================================
// Project Info
// =============================================================================

/**
 * Project metadata for context generation.
 */
export interface ProjectInfo {
  /**
   * Project name (from package.json or directory name).
   */
  name: string;

  /**
   * Detected tech stack.
   */
  stack?: string[];

  /**
   * Current git branch.
   */
  branch?: string;
}

// =============================================================================
// Additional Type Aliases and State
// =============================================================================

/**
 * Alias for ManualNote for compatibility.
 */
export type SessionNote = ManualNote;

/**
 * Persisted session state (stored in .deja/state.json).
 */
export interface SessionState {
  /**
   * Whether a session is currently active.
   */
  active: boolean;

  /**
   * Current session ID if active.
   */
  sessionId: string | null;

  /**
   * Session start time if active (ISO string or timestamp).
   */
  startTime: string | number | null;

  /**
   * Current git branch when session started.
   */
  branch: string | null;

  /**
   * Files changed in current session (paths).
   */
  filesChanged: string[];

  /**
   * Notes added during current session.
   */
  notes?: ManualNote[];
}

/**
 * Session log saved to disk (stored in .deja/sessions/*.json).
 */
export interface SessionLog {
  /**
   * Session identifier.
   */
  id?: string;

  /**
   * Session identifier (alias).
   */
  sessionId?: string;

  /**
   * Session start timestamp (ISO string or number).
   */
  startTime: string | number;

  /**
   * Session end timestamp (ISO string or number).
   */
  endTime: string | number;

  /**
   * Git branch during session.
   */
  branch: string | null;

  /**
   * All file changes during session (paths or FileChange objects).
   */
  changes?: FileChange[];

  /**
   * Files changed (paths only).
   */
  filesChanged?: string[];

  /**
   * Manual notes added during session.
   */
  notes?: ManualNote[];

  /**
   * AI-generated summary (may be null/string if summarization disabled/failed).
   */
  summary?: SessionSummary | string | null;
}

/**
 * A decision entry in the knowledge base.
 */
export interface DecisionEntry {
  description: string;
  date?: string;
}

/**
 * A pattern entry in the knowledge base.
 */
export interface PatternEntry {
  description: string;
}

/**
 * An issue entry in the knowledge base.
 */
export interface IssueEntry {
  description: string;
  status: 'active' | 'resolved';
}

/**
 * Long-term knowledge (alias for KnowledgeBase for compatibility).
 */
export interface Knowledge {
  /**
   * Accumulated decisions across sessions.
   */
  decisions: DecisionEntry[];

  /**
   * Accumulated patterns across sessions.
   */
  patterns: PatternEntry[];

  /**
   * Accumulated resolved issues.
   */
  issues: IssueEntry[];

  /**
   * Last updated timestamp.
   */
  lastUpdated: number;
}
