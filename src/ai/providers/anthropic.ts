/**
 * DEJA Anthropic Provider
 * Integrates with Anthropic API for AI summarization
 */

import type { Session, SessionSummary, AIConfig } from '../../types.js';
import { SESSION_SUMMARY_PROMPT, formatSessionForPrompt, parseSessionSummary } from '../prompts.js';

/** Default Anthropic configuration */
const ANTHROPIC_DEFAULTS = {
  baseUrl: 'https://api.anthropic.com/v1',
  model: 'claude-3-haiku-20240307',
  apiVersion: '2023-06-01',
};

/**
 * Anthropic API message response structure
 */
interface AnthropicMessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence?: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic API error response structure
 */
interface AnthropicErrorResponse {
  type: string;
  error: {
    type: string;
    message: string;
  };
}

/**
 * Error thrown when Anthropic API call fails
 */
export class AnthropicError extends Error {
  public readonly type?: string;

  constructor(message: string, type?: string) {
    super(message);
    this.name = 'AnthropicError';
    this.type = type;
  }
}

/**
 * Validates that an API key is configured
 */
function validateApiKey(config: AIConfig): string {
  if (!config.api_key) {
    throw new AnthropicError(
      'Anthropic API key is required. Set it in .deja/config.yml or ANTHROPIC_API_KEY environment variable.',
      'missing_api_key'
    );
  }
  return config.api_key;
}

/**
 * Summarize a session using Anthropic
 */
export async function summarizeWithAnthropic(
  session: Session,
  config: AIConfig
): Promise<SessionSummary> {
  const apiKey = validateApiKey(config);
  const baseUrl = config.base_url || ANTHROPIC_DEFAULTS.baseUrl;
  const model = config.model || ANTHROPIC_DEFAULTS.model;

  // Format the session data for the prompt
  const sessionData = formatSessionForPrompt({
    branch: session.branch,
    changes: session.changes,
    manualNotes: session.manualNotes || session.notes || [],
  });

  const systemPrompt = SESSION_SUMMARY_PROMPT.trim();
  const userMessage = sessionData;

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_DEFAULTS.apiVersion,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
        ],
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as AnthropicErrorResponse | null;

      if (response.status === 401) {
        throw new AnthropicError(
          'Invalid Anthropic API key. Please check your configuration.',
          'authentication_error'
        );
      }

      if (response.status === 429) {
        throw new AnthropicError(
          'Anthropic rate limit exceeded. Please try again later.',
          'rate_limit_error'
        );
      }

      if (response.status === 404) {
        throw new AnthropicError(
          `Model '${model}' not found. Check if the model name is correct.`,
          'not_found_error'
        );
      }

      throw new AnthropicError(
        errorData?.error?.message || `Anthropic API returned status ${response.status}`,
        errorData?.error?.type
      );
    }

    const data = await response.json() as AnthropicMessageResponse;

    // Extract text content from the response
    const textContent = data.content.find(block => block.type === 'text');
    const content = textContent?.text;

    if (!content) {
      throw new AnthropicError('Anthropic returned empty response');
    }

    // Parse the JSON response
    const summary = parseSessionSummary(content);

    if (!summary) {
      throw new AnthropicError('Failed to parse session summary from Anthropic response');
    }

    return summary;
  } catch (error) {
    if (error instanceof AnthropicError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AnthropicError(
        `Cannot connect to Anthropic API at ${baseUrl}. Check your internet connection.`
      );
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new AnthropicError(
        'Anthropic request timed out. Please try again.'
      );
    }

    throw new AnthropicError(
      `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate text with Anthropic (lower-level API for custom prompts)
 */
export async function generateWithAnthropic(
  prompt: string,
  config: AIConfig,
  options?: {
    systemPrompt?: string;
    maxTokens?: number;
  }
): Promise<string> {
  const apiKey = validateApiKey(config);
  const baseUrl = config.base_url || ANTHROPIC_DEFAULTS.baseUrl;
  const model = config.model || ANTHROPIC_DEFAULTS.model;

  try {
    const requestBody: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens || 2048,
      messages: [
        { role: 'user', content: prompt },
      ],
    };

    if (options?.systemPrompt) {
      requestBody.system = options.systemPrompt;
    }

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_DEFAULTS.apiVersion,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as AnthropicErrorResponse | null;
      throw new AnthropicError(
        errorData?.error?.message || `Anthropic API returned status ${response.status}`,
        errorData?.error?.type
      );
    }

    const data = await response.json() as AnthropicMessageResponse;
    const textContent = data.content.find(block => block.type === 'text');
    return textContent?.text || '';
  } catch (error) {
    if (error instanceof AnthropicError) {
      throw error;
    }

    throw new AnthropicError(
      `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify that the Anthropic API key is valid
 */
export async function verifyAnthropicKey(config: AIConfig): Promise<boolean> {
  try {
    const apiKey = validateApiKey(config);
    const baseUrl = config.base_url || ANTHROPIC_DEFAULTS.baseUrl;

    // Anthropic doesn't have a simple endpoint to verify keys,
    // so we make a minimal request
    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_DEFAULTS.apiVersion,
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    // 200 means key is valid, 401 means invalid
    return response.ok;
  } catch {
    return false;
  }
}
