/**
 * DEJA OpenAI Provider
 * Integrates with OpenAI API for AI summarization
 */

import type { Session, SessionSummary, AIConfig } from '../../types.js';
import { SESSION_SUMMARY_PROMPT, formatSessionForPrompt, parseSessionSummary } from '../prompts.js';

/** Default OpenAI configuration */
const OPENAI_DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

/**
 * OpenAI API chat completion response structure
 */
interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI API error response structure
 */
interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * Error thrown when OpenAI API call fails
 */
export class OpenAIError extends Error {
  public readonly code?: string;
  public readonly type?: string;

  constructor(message: string, code?: string, type?: string) {
    super(message);
    this.name = 'OpenAIError';
    this.code = code;
    this.type = type;
  }
}

/**
 * Validates that an API key is configured
 */
function validateApiKey(config: AIConfig): string {
  if (!config.api_key) {
    throw new OpenAIError(
      'OpenAI API key is required. Set it in .deja/config.yml or OPENAI_API_KEY environment variable.',
      'missing_api_key'
    );
  }
  return config.api_key;
}

/**
 * Summarize a session using OpenAI
 */
export async function summarizeWithOpenAI(
  session: Session,
  config: AIConfig
): Promise<SessionSummary> {
  const apiKey = validateApiKey(config);
  const baseUrl = config.base_url || OPENAI_DEFAULTS.baseUrl;
  const model = config.model || OPENAI_DEFAULTS.model;

  // Format the session data for the prompt
  const sessionData = formatSessionForPrompt({
    branch: session.branch,
    changes: session.changes,
    manualNotes: session.manualNotes || session.notes || [],
  });

  const systemPrompt = SESSION_SUMMARY_PROMPT.trim();
  const userMessage = sessionData;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3, // Lower temperature for consistent JSON output
        max_tokens: 1000,
        response_format: { type: 'json_object' }, // Request JSON mode
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as OpenAIErrorResponse | null;

      if (response.status === 401) {
        throw new OpenAIError(
          'Invalid OpenAI API key. Please check your configuration.',
          'invalid_api_key',
          'authentication_error'
        );
      }

      if (response.status === 429) {
        throw new OpenAIError(
          'OpenAI rate limit exceeded. Please try again later.',
          'rate_limit_exceeded'
        );
      }

      if (response.status === 404 && errorData?.error?.code === 'model_not_found') {
        throw new OpenAIError(
          `Model '${model}' not found. Check if the model name is correct.`,
          'model_not_found'
        );
      }

      throw new OpenAIError(
        errorData?.error?.message || `OpenAI API returned status ${response.status}`,
        errorData?.error?.code,
        errorData?.error?.type
      );
    }

    const data = await response.json() as OpenAIChatResponse;

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new OpenAIError('OpenAI returned empty response');
    }

    // Parse the JSON response
    const summary = parseSessionSummary(content);

    if (!summary) {
      throw new OpenAIError('Failed to parse session summary from OpenAI response');
    }

    return summary;
  } catch (error) {
    if (error instanceof OpenAIError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new OpenAIError(
        `Cannot connect to OpenAI API at ${baseUrl}. Check your internet connection.`
      );
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new OpenAIError(
        'OpenAI request timed out. Please try again.'
      );
    }

    throw new OpenAIError(
      `OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate text with OpenAI (lower-level API for custom prompts)
 */
export async function generateWithOpenAI(
  prompt: string,
  config: AIConfig,
  options?: {
    systemPrompt?: string;
    jsonMode?: boolean;
    maxTokens?: number;
  }
): Promise<string> {
  const apiKey = validateApiKey(config);
  const baseUrl = config.base_url || OPENAI_DEFAULTS.baseUrl;
  const model = config.model || OPENAI_DEFAULTS.model;

  const messages: Array<{ role: string; content: string }> = [];

  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: options?.maxTokens || 2000,
    };

    if (options?.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as OpenAIErrorResponse | null;
      throw new OpenAIError(
        errorData?.error?.message || `OpenAI API returned status ${response.status}`,
        errorData?.error?.code
      );
    }

    const data = await response.json() as OpenAIChatResponse;
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    if (error instanceof OpenAIError) {
      throw error;
    }

    throw new OpenAIError(
      `OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Verify that the OpenAI API key is valid
 */
export async function verifyOpenAIKey(config: AIConfig): Promise<boolean> {
  try {
    const apiKey = validateApiKey(config);
    const baseUrl = config.base_url || OPENAI_DEFAULTS.baseUrl;

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    return response.ok;
  } catch {
    return false;
  }
}
