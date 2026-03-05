/**
 * Configuration utilities for DEJA
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse, stringify } from 'yaml';
import type { DejaConfig } from '../types.js';
import { getConfigPath, getDejaPath } from './paths.js';

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Returns the default DEJA configuration.
 * @returns Default DejaConfig object
 */
export function getDefaultConfig(): DejaConfig {
  return {
    version: '1.0',
    aiProvider: 'ollama',
    autoSync: true,
    watchPaths: ['src', 'lib', 'app', 'pages', 'components'],
    ignorePaths: ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'],
    contextFiles: {
      cursor: '.cursorrules',
      claude: 'CLAUDE.md',
      copilot: '.github/copilot-instructions.md',
      windsurf: '.windsurfrules',
      aider: '.aider.conventions.md',
    },
    tools: [],
    ai: {
      provider: 'ollama',
      model: 'llama3.2',
    },
    session: {
      auto_start: true,
      auto_stop_after: '30m',
      max_sessions_in_context: 5,
    },
    capture: {
      file_changes: true,
      git_diffs: true,
      branch_info: true,
    },
    ignore: [],
  };
}

// =============================================================================
// Configuration I/O
// =============================================================================

/**
 * Load and parse the DEJA configuration from a project.
 * @param projectPath - The project root directory path
 * @returns Parsed DejaConfig object
 * @throws Error if config file cannot be read or parsed
 */
export async function loadConfig(projectPath: string): Promise<DejaConfig> {
  const configPath = getConfigPath(projectPath);

  try {
    const content = await readFile(configPath, 'utf-8');
    const config = parse(content) as DejaConfig;

    // Merge with defaults to ensure all fields are present
    return {
      ...getDefaultConfig(),
      ...config,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`DEJA not initialized. Run 'deja init' first.`);
    }
    throw new Error(`Failed to load config: ${(error as Error).message}`);
  }
}

/**
 * Save the DEJA configuration to a project.
 * @param projectPath - The project root directory path
 * @param config - The configuration to save
 * @throws Error if config file cannot be written
 */
export async function saveConfig(projectPath: string, config: DejaConfig): Promise<void> {
  const configPath = getConfigPath(projectPath);
  const dejaPath = getDejaPath(projectPath);

  try {
    // Ensure .deja directory exists
    await mkdir(dejaPath, { recursive: true });

    // Serialize and write config
    const content = stringify(config, {
      indent: 2,
      lineWidth: 0, // Disable line wrapping
    });

    await writeFile(configPath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save config: ${(error as Error).message}`);
  }
}
