/**
 * DEJA Session Summarizer
 * Main interface for AI-powered session summarization
 * Routes to appropriate provider based on configuration
 */

import type { Session, SessionSummary, AIConfig, SummarizationResult } from '../types.js';
import { summarizeWithOllama, isOllamaAvailable, OllamaConnectionError, OllamaResponseError } from './providers/ollama.js';
import { summarizeWithOpenAI, OpenAIError } from './providers/openai.js';
import { summarizeWithAnthropic, AnthropicError } from './providers/anthropic.js';

/**
 * Error thrown when summarization fails
 */
export class SummarizationError extends Error {
  public readonly provider: string;
  public readonly cause?: Error;

  constructor(message: string, provider: string, cause?: Error) {
    super(message);
    this.name = 'SummarizationError';
    this.provider = provider;
    this.cause = cause;
  }
}

/**
 * Default fallback summary when AI is unavailable
 */
function createFallbackSummary(session: Session): SessionSummary {
  const fileCount = session.changes.length;
  const addedCount = session.changes.filter(c => c.type === 'added').length;
  const modifiedCount = session.changes.filter(c => c.type === 'modified').length;
  const deletedCount = session.changes.filter(c => c.type === 'deleted').length;

  const parts: string[] = [];
  if (addedCount > 0) parts.push(`${addedCount} added`);
  if (modifiedCount > 0) parts.push(`${modifiedCount} modified`);
  if (deletedCount > 0) parts.push(`${deletedCount} deleted`);

  const overview = fileCount > 0
    ? `Session with ${fileCount} file changes (${parts.join(', ')}).`
    : 'Session with no file changes recorded.';

  // Get notes from either manualNotes or notes field
  const notes = session.manualNotes || session.notes || [];

  // Extract decisions from manual notes that look like decisions
  const decisions = notes
    .filter(note =>
      note.content.toLowerCase().includes('decided') ||
      note.content.toLowerCase().includes('decision') ||
      note.content.toLowerCase().includes('chose') ||
      note.content.toLowerCase().includes('using')
    )
    .map(note => note.content);

  // Extract issues from manual notes that look like issues/bugs
  const issues = notes
    .filter(note =>
      note.content.toLowerCase().includes('bug') ||
      note.content.toLowerCase().includes('issue') ||
      note.content.toLowerCase().includes('error') ||
      note.content.toLowerCase().includes('fail')
    )
    .map(note => note.content);

  return {
    overview,
    decisions,
    patterns: [],
    issues,
  };
}

/**
 * Summarize a session using the configured AI provider
 *
 * @param session - The session to summarize
 * @param config - AI provider configuration
 * @returns Promise resolving to SessionSummary
 * @throws SummarizationError if summarization fails and no fallback is available
 */
export async function summarizeSession(
  session: Session,
  config: AIConfig
): Promise<SessionSummary> {
  // If provider is 'none', return fallback summary
  if (config.provider === 'none') {
    return createFallbackSummary(session);
  }

  try {
    switch (config.provider) {
      case 'ollama':
        return await summarizeWithOllama(session, config);

      case 'openai':
        return await summarizeWithOpenAI(session, config);

      case 'anthropic':
        return await summarizeWithAnthropic(session, config);

      default:
        // Unknown provider, use fallback
        return createFallbackSummary(session);
    }
  } catch (error) {
    // Re-throw with provider context
    if (error instanceof OllamaConnectionError || error instanceof OllamaResponseError) {
      throw new SummarizationError(error.message, 'ollama', error);
    }
    if (error instanceof OpenAIError) {
      throw new SummarizationError(error.message, 'openai', error);
    }
    if (error instanceof AnthropicError) {
      throw new SummarizationError(error.message, 'anthropic', error);
    }

    throw new SummarizationError(
      `Summarization failed: ${error instanceof Error ? error.message : String(error)}`,
      config.provider,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Summarize a session with graceful fallback
 *
 * Unlike summarizeSession, this function never throws.
 * If AI summarization fails, it returns a basic summary extracted from the session data.
 *
 * @param session - The session to summarize
 * @param config - AI provider configuration
 * @returns Promise resolving to SummarizationResult
 */
export async function summarizeSessionWithFallback(
  session: Session,
  config: AIConfig
): Promise<SummarizationResult> {
  // If provider is 'none', return fallback summary immediately
  if (config.provider === 'none') {
    return {
      success: true,
      summary: createFallbackSummary(session),
    };
  }

  try {
    const summary = await summarizeSession(session, config);
    return {
      success: true,
      summary,
    };
  } catch (error) {
    // Log the error but return fallback
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      summary: createFallbackSummary(session),
      error: errorMessage,
    };
  }
}

/**
 * Check if the configured AI provider is available
 *
 * @param config - AI provider configuration
 * @returns Promise resolving to availability status
 */
export async function isProviderAvailable(config: AIConfig): Promise<boolean> {
  switch (config.provider) {
    case 'none':
      return true; // Fallback is always available

    case 'ollama':
      return await isOllamaAvailable(config);

    case 'openai':
      // OpenAI is available if API key is configured
      return !!config.api_key;

    case 'anthropic':
      // Anthropic is available if API key is configured
      return !!config.api_key;

    default:
      return false;
  }
}

/**
 * Get human-readable provider name
 */
export function getProviderDisplayName(provider: AIConfig['provider']): string {
  switch (provider) {
    case 'ollama':
      return 'Ollama (local)';
    case 'openai':
      return 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'none':
      return 'None (basic summary only)';
    default:
      return 'Unknown';
  }
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIConfig['provider']): string {
  switch (provider) {
    case 'ollama':
      return 'llama3.2';
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-haiku-20240307';
    default:
      return '';
  }
}

// Re-export provider errors for consumers
export { OllamaConnectionError, OllamaResponseError } from './providers/ollama.js';
export { OpenAIError } from './providers/openai.js';
export { AnthropicError } from './providers/anthropic.js';
