/**
 * DEJA Utilities - Barrel export file
 */

// Path constants and helpers
export {
  DEJA_DIR,
  CONFIG_FILE,
  STATE_FILE,
  SESSIONS_DIR,
  CONTEXT_FILE,
  KNOWLEDGE_FILE,
  getDejaPath,
  getConfigPath,
  getStatePath,
  getSessionsPath,
  getContextPath,
  getKnowledgePath,
  isDejaInitialized,
} from './paths.js';

// Configuration utilities
export {
  loadConfig,
  saveConfig,
  getDefaultConfig,
} from './config.js';

// Session state utilities
export {
  loadState,
  saveState,
  isSessionActive,
  getDefaultState,
  clearState,
} from './state.js';

// Session file utilities
export {
  listSessions,
  loadSession,
  saveSession,
  deleteSession,
  getSessionCount,
} from './sessions.js';
