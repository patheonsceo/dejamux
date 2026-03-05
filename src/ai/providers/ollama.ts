/**
 * DEJA Ollama Provider
 * Integrates with local Ollama instance for AI summarization
 */

import type { Session, SessionSummary, AIConfig } from '../../types.js';
import { SESSION_SUMMARY_PROMPT, formatSessionForPrompt, parseSessionSummary } from '../prompts.js';

/** Default Ollama configuration */
const OLLAMA_DEFAULTS = {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2',
};

/**
 * Ollama API response structure
 */
interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Error thrown when Ollama connection fails
 */
export class OllamaConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaConnectionError';
  }
}

/**
 * Error thrown when Ollama returns invalid response
 */
export class OllamaResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OllamaResponseError';
  }
}

/**
 * Check if Ollama is available at the configured endpoint
 */
export async function isOllamaAvailable(config: AIConfig): Promise<boolean> {
  const baseUrl = config.base_url || OLLAMA_DEFAULTS.baseUrl;

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get list of available models from Ollama
 */
export async function listOllamaModels(config: AIConfig): Promise<string[]> {
  const baseUrl = config.base_url || OLLAMA_DEFAULTS.baseUrl;

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    return data.models?.map(m => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Summarize a session using Ollama
 */
export async function summarizeWithOllama(
  session: Session,
  config: AIConfig
): Promise<SessionSummary> {
  const baseUrl = config.base_url || OLLAMA_DEFAULTS.baseUrl;
  const model = config.model || OLLAMA_DEFAULTS.model;

  // Format the session data for the prompt
  const sessionData = formatSessionForPrompt({
    branch: session.branch,
    changes: session.changes,
    manualNotes: session.manualNotes || session.notes || [],
  });

  const prompt = SESSION_SUMMARY_PROMPT + sessionData;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent JSON output
          num_predict: 1000, // Limit response length
        },
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout for generation
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 404) {
        throw new OllamaConnectionError(
          `Model '${model}' not found. Run 'ollama pull ${model}' to download it.`
        );
      }

      throw new OllamaConnectionError(
        `Ollama returned status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json() as OllamaResponse;

    if (!data.response) {
      throw new OllamaResponseError('Ollama returned empty response');
    }

    // Parse the JSON response
    const summary = parseSessionSummary(data.response);

    if (!summary) {
      throw new OllamaResponseError(
        'Failed to parse session summary from Ollama response'
      );
    }

    return summary;
  } catch (error) {
    if (error instanceof OllamaConnectionError || error instanceof OllamaResponseError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new OllamaConnectionError(
        `Cannot connect to Ollama at ${baseUrl}. Is Ollama running?`
      );
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new OllamaConnectionError(
        'Ollama request timed out. The model may be loading or the prompt too long.'
      );
    }

    throw new OllamaConnectionError(
      `Ollama request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate text with Ollama (lower-level API for custom prompts)
 */
export async function generateWithOllama(
  prompt: string,
  config: AIConfig
): Promise<string> {
  const baseUrl = config.base_url || OLLAMA_DEFAULTS.baseUrl;
  const model = config.model || OLLAMA_DEFAULTS.model;

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 2000,
        },
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new OllamaConnectionError(
        `Ollama returned status ${response.status}`
      );
    }

    const data = await response.json() as OllamaResponse;
    return data.response || '';
  } catch (error) {
    if (error instanceof OllamaConnectionError) {
      throw error;
    }

    throw new OllamaConnectionError(
      `Ollama request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
