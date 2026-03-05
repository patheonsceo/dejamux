/**
 * DEJA AI Module
 * Exports AI summarization functionality for session compression
 */

// Main summarizer interface
export {
  summarizeSession,
  summarizeSessionWithFallback,
  isProviderAvailable,
  getProviderDisplayName,
  getDefaultModel,
  SummarizationError,
} from './summarizer.js';

// Provider-specific exports
export {
  summarizeWithOllama,
  isOllamaAvailable,
  listOllamaModels,
  generateWithOllama,
  OllamaConnectionError,
  OllamaResponseError,
} from './providers/ollama.js';

export {
  summarizeWithOpenAI,
  generateWithOpenAI,
  verifyOpenAIKey,
  OpenAIError,
} from './providers/openai.js';

export {
  summarizeWithAnthropic,
  generateWithAnthropic,
  verifyAnthropicKey,
  AnthropicError,
} from './providers/anthropic.js';

// Prompt utilities
export {
  SESSION_SUMMARY_PROMPT,
  KNOWLEDGE_EXTRACTION_PROMPT,
  formatSessionForPrompt,
  parseSessionSummary,
} from './prompts.js';
