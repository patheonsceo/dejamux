/**
 * DEJA Session Capture Engine
 *
 * Core engine that watches files and captures session data.
 * Uses chokidar for efficient file watching and simple-git for git integration.
 */

import * as chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { simpleGit, type SimpleGit } from 'simple-git';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type {
  FileChange,
  FileChangeType,
  Session,
  ManualNote,
  SessionStatus,
  SessionCaptureOptions,
} from '../types.js';

/**
 * Default patterns to ignore during file watching.
 * These are common directories/files that shouldn't be tracked.
 */
const DEFAULT_IGNORE_PATTERNS: string[] = [
  '**/node_modules/**',
  '**/.git/objects/**',
  '**/.git/hooks/**',
  '**/.git/logs/**',
  '**/.git/refs/**',
  '**/.git/index',
  '**/.deja/**',
  '**/dist/**',
  '**/build/**',
  '**/*.log',
  '**/coverage/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.cache/**',
  '**/tmp/**',
  '**/.tmp/**',
  '**/*.swp',
  '**/*.swo',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
];

/**
 * SessionCapture - Core engine for capturing coding session data
 *
 * Watches the project directory for file changes and tracks them efficiently.
 * Integrates with git to capture diffs and branch information.
 *
 * @example
 * ```typescript
 * const capture = new SessionCapture({
 *   projectRoot: '/path/to/project',
 *   ignorePatterns: ['*.tmp'],
 *   captureGitDiffs: true,
 * });
 *
 * await capture.start();
 * // ... developer codes ...
 * capture.addNote('Refactored the auth module');
 * const session = await capture.stop();
 * ```
 */
export class SessionCapture {
  private readonly projectRoot: string;
  private readonly ignorePatterns: string[];
  private readonly captureGitDiffs: boolean;

  private watcher: FSWatcher | null = null;
  private git: SimpleGit;
  private isGitRepo: boolean = false;

  private sessionId: string | null = null;
  private startTime: number | null = null;
  private changes: FileChange[] = [];
  private notes: ManualNote[] = [];
  private branch: string | null = null;

  // Track files we've seen to deduplicate rapid changes
  private pendingChanges: Map<string, { type: FileChangeType; timeout: NodeJS.Timeout }> = new Map();

  // Debounce delay for file changes (ms)
  private readonly DEBOUNCE_DELAY = 100;

  constructor(options: SessionCaptureOptions) {
    this.projectRoot = path.resolve(options.projectRoot);
    this.captureGitDiffs = options.captureGitDiffs ?? true;

    // Merge default ignore patterns with custom ones
    this.ignorePatterns = [
      ...DEFAULT_IGNORE_PATTERNS,
      ...(options.ignorePatterns || []).map(pattern => {
        // Ensure patterns are glob-compatible
        if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
          return `**/${pattern}`;
        }
        return pattern;
      }),
    ];

    // Initialize git with the project root
    this.git = simpleGit(this.projectRoot);
  }

  /**
   * Start watching the project directory for file changes.
   * Initializes the file watcher and captures the current git branch.
   *
   * @throws Error if a session is already active
   */
  async start(): Promise<void> {
    if (this.watcher) {
      throw new Error('Session already active. Call stop() first.');
    }

    // Generate new session ID and start time
    this.sessionId = randomUUID();
    this.startTime = Date.now();
    this.changes = [];
    this.notes = [];
    this.pendingChanges.clear();

    // Check if this is a git repository and get branch info
    await this.initGitInfo();

    // Initialize the file watcher
    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: this.ignorePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
      // Use polling on network drives or when native watching fails
      usePolling: false,
      // Don't follow symlinks to avoid loops
      followSymlinks: false,
      // Depth limit for performance
      depth: 20,
    });

    // Set up event handlers
    this.watcher.on('add', (filePath) => this.handleChange(filePath, 'added'));
    this.watcher.on('change', (filePath) => this.handleChange(filePath, 'modified'));
    this.watcher.on('unlink', (filePath) => this.handleChange(filePath, 'deleted'));

    // Handle watcher errors gracefully
    this.watcher.on('error', (error) => {
      console.error('File watcher error:', error);
    });
  }

  /**
   * Stop watching and return the captured session data.
   * Closes the file watcher and compiles all captured changes.
   *
   * @returns The complete session data
   * @throws Error if no session is active
   */
  async stop(): Promise<Session> {
    if (!this.watcher || !this.sessionId || !this.startTime) {
      throw new Error('No active session. Call start() first.');
    }

    // Process any remaining pending changes
    await this.flushPendingChanges();

    // Close the watcher
    await this.watcher.close();
    this.watcher = null;

    // Build the session object
    const session: Session = {
      id: this.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      branch: this.branch || undefined,
      changes: [...this.changes],
      notes: [...this.notes],
    };

    // Reset state
    this.sessionId = null;
    this.startTime = null;
    this.changes = [];
    this.notes = [];
    this.branch = null;
    this.pendingChanges.clear();

    return session;
  }

  /**
   * Add a manual note to the current session.
   *
   * @param content - The note content
   * @throws Error if no session is active
   */
  addNote(content: string): void {
    if (!this.sessionId) {
      throw new Error('No active session. Call start() first.');
    }

    this.notes.push({
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Get the current status of the active session.
   *
   * @returns Current session status including file counts and duration
   */
  getStatus(): SessionStatus {
    if (!this.sessionId || !this.startTime) {
      return {
        isActive: false,
        filesChanged: 0,
        filesAdded: 0,
        filesModified: 0,
        filesDeleted: 0,
        notesCount: 0,
      };
    }

    const filesAdded = this.changes.filter(c => c.type === 'added').length;
    const filesModified = this.changes.filter(c => c.type === 'modified').length;
    const filesDeleted = this.changes.filter(c => c.type === 'deleted').length;

    return {
      isActive: true,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      filesChanged: this.changes.length,
      filesAdded,
      filesModified,
      filesDeleted,
      notesCount: this.notes.length,
      branch: this.branch || undefined,
    };
  }

  /**
   * Check if a session is currently active.
   */
  isActive(): boolean {
    return this.watcher !== null && this.sessionId !== null;
  }

  /**
   * Initialize git information for the session.
   * Checks if the project is a git repository and captures the current branch.
   */
  private async initGitInfo(): Promise<void> {
    try {
      const isRepo = await this.git.checkIsRepo();
      this.isGitRepo = isRepo;

      if (isRepo) {
        const branchSummary = await this.git.branch();
        this.branch = branchSummary.current;
      }
    } catch {
      // Not a git repo or git not available - that's fine
      this.isGitRepo = false;
      this.branch = null;
    }
  }

  /**
   * Handle a file change event with debouncing.
   * Rapid changes to the same file are debounced to capture only the final state.
   */
  private handleChange(filePath: string, type: FileChangeType): void {
    // Get relative path from project root
    const relativePath = path.relative(this.projectRoot, filePath);

    // Skip if somehow an ignored file got through
    if (this.shouldIgnore(relativePath)) {
      return;
    }

    // Cancel any pending change for this file
    const pending = this.pendingChanges.get(relativePath);
    if (pending) {
      clearTimeout(pending.timeout);
    }

    // Set up debounced processing
    const timeout = setTimeout(async () => {
      await this.processChange(relativePath, type);
      this.pendingChanges.delete(relativePath);
    }, this.DEBOUNCE_DELAY);

    this.pendingChanges.set(relativePath, { type, timeout });
  }

  /**
   * Process a file change after debouncing.
   * Captures the change and optionally gets the git diff.
   */
  private async processChange(relativePath: string, type: FileChangeType): Promise<void> {
    const change: FileChange = {
      type,
      path: relativePath,
      timestamp: Date.now(),
    };

    // Get git diff for modified files
    if (this.captureGitDiffs && this.isGitRepo && type === 'modified') {
      try {
        const diff = await this.git.diff([relativePath]);
        if (diff) {
          change.diff = diff;
        }
      } catch {
        // Failed to get diff - continue without it
      }
    }

    this.changes.push(change);
  }

  /**
   * Check if a file path should be ignored.
   */
  private shouldIgnore(relativePath: string): boolean {
    // Skip hidden files in the root (but not in subdirectories)
    if (relativePath.startsWith('.') && !relativePath.includes('/')) {
      const allowedRootDotFiles = ['.env.example', '.gitignore', '.eslintrc', '.prettierrc'];
      if (!allowedRootDotFiles.some(f => relativePath.startsWith(f))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Flush all pending changes immediately.
   * Called before stopping the session to ensure all changes are captured.
   */
  private async flushPendingChanges(): Promise<void> {
    const pendingEntries = Array.from(this.pendingChanges.entries());

    for (const [relativePath, { type, timeout }] of pendingEntries) {
      clearTimeout(timeout);
      await this.processChange(relativePath, type);
    }

    this.pendingChanges.clear();
  }
}

/**
 * Create a new SessionCapture instance with default configuration.
 * Convenience factory function.
 *
 * @param projectRoot - Path to the project root
 * @param options - Optional configuration overrides
 */
export function createSessionCapture(
  projectRoot: string,
  options: Partial<Omit<SessionCaptureOptions, 'projectRoot'>> = {}
): SessionCapture {
  return new SessionCapture({
    projectRoot,
    ...options,
  });
}

export default SessionCapture;
