import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import type { AIProvider, DejaConfig, DetectedAIFiles } from '../types.js';

const DEJA_DIR = '.deja';
const CONFIG_FILE = 'config.yml';
const STATE_FILE = 'state.json';
const SESSIONS_DIR = 'sessions';

const AI_TOOL_FILES: Record<string, { path: string; key: keyof DetectedAIFiles }> = {
  '.cursorrules': { path: '.cursorrules', key: 'cursorrules' },
  'CLAUDE.md': { path: 'CLAUDE.md', key: 'claudeMd' },
  '.github/copilot-instructions.md': { path: '.github/copilot-instructions.md', key: 'copilotInstructions' },
  '.windsurfrules': { path: '.windsurfrules', key: 'windsurfRules' },
  '.aider.conventions.md': { path: '.aider.conventions.md', key: 'aiderConvention' },
};

async function detectAIFiles(cwd: string): Promise<DetectedAIFiles> {
  const detected: DetectedAIFiles = {
    cursorrules: false,
    claudeMd: false,
    copilotInstructions: false,
    windsurfRules: false,
    aiderConvention: false,
  };

  for (const [, config] of Object.entries(AI_TOOL_FILES)) {
    try {
      await fs.access(path.join(cwd, config.path));
      detected[config.key] = true;
    } catch {
      // File doesn't exist
    }
  }

  return detected;
}

function getDefaultConfig(provider: AIProvider): DejaConfig {
  return {
    version: '1.0.0',
    aiProvider: provider,
    autoSync: true,
    watchPaths: ['src/', 'lib/', 'app/'],
    ignorePaths: ['node_modules/', 'dist/', '.git/'],
    contextFiles: {
      cursor: '.cursorrules',
      claude: 'CLAUDE.md',
      copilot: '.github/copilot-instructions.md',
      windsurf: '.windsurfrules',
      aider: '.aider.conventions.md',
    },
  };
}

function configToYaml(config: DejaConfig): string {
  const watchPaths = config.watchPaths || [];
  const ignorePaths = config.ignorePaths || [];
  const contextFiles = config.contextFiles || {
    cursor: '.cursorrules',
    claude: 'CLAUDE.md',
    copilot: '.github/copilot-instructions.md',
    windsurf: '.windsurfrules',
    aider: '.aider.conventions.md',
  };

  return `# DEJA Configuration
version: "${config.version || '1.0.0'}"
aiProvider: "${config.aiProvider || 'ollama'}"
autoSync: ${config.autoSync ?? true}

watchPaths:
${watchPaths.map(p => `  - "${p}"`).join('\n')}

ignorePaths:
${ignorePaths.map(p => `  - "${p}"`).join('\n')}

contextFiles:
  cursor: "${contextFiles.cursor}"
  claude: "${contextFiles.claude}"
  copilot: "${contextFiles.copilot}"
  windsurf: "${contextFiles.windsurf}"
  aider: "${contextFiles.aider}"
`;
}

async function initAction(): Promise<void> {
  const cwd = process.cwd();
  const dejaPath = path.join(cwd, DEJA_DIR);

  console.log(chalk.blue('\n  DEJA - Multi-agent terminal with supercharged context management\n'));

  // Check if already initialized
  try {
    await fs.access(dejaPath);
    console.log(chalk.yellow('  DEJA is already initialized in this directory.'));
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Do you want to reinitialize?',
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.gray('\n  Initialization cancelled.\n'));
      return;
    }
  } catch {
    // Directory doesn't exist, proceed
  }

  // Detect existing AI tool files
  const spinner = ora('Detecting existing AI tool configurations...').start();
  const detectedFiles = await detectAIFiles(cwd);
  spinner.stop();

  const detectedList = Object.entries(AI_TOOL_FILES)
    .filter(([, config]) => detectedFiles[config.key])
    .map(([file]) => file);

  if (detectedList.length > 0) {
    console.log(chalk.green('  Detected existing AI tool files:'));
    detectedList.forEach(file => {
      console.log(chalk.gray(`    - ${file}`));
    });
    console.log('');
  } else {
    console.log(chalk.gray('  No existing AI tool files detected.\n'));
  }

  // Prompt for AI provider preference
  const { provider } = await inquirer.prompt<{ provider: AIProvider }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your primary AI coding tool:',
      choices: [
        { name: 'Cursor', value: 'cursor' },
        { name: 'Claude Code', value: 'claude' },
        { name: 'GitHub Copilot', value: 'copilot' },
        { name: 'Windsurf', value: 'windsurf' },
        { name: 'Aider', value: 'aider' },
      ],
    },
  ]);

  // Create directory structure
  const createSpinner = ora('Creating DEJA directory structure...').start();

  try {
    // Create .deja directory
    await fs.mkdir(dejaPath, { recursive: true });

    // Create sessions directory
    await fs.mkdir(path.join(dejaPath, SESSIONS_DIR), { recursive: true });

    // Create config.yml
    const config = getDefaultConfig(provider);
    await fs.writeFile(
      path.join(dejaPath, CONFIG_FILE),
      configToYaml(config),
      'utf-8'
    );

    // Create initial state.json
    const initialState = {
      active: false,
      startTime: null,
      sessionId: null,
      branch: null,
      filesChanged: [],
    };
    await fs.writeFile(
      path.join(dejaPath, STATE_FILE),
      JSON.stringify(initialState, null, 2),
      'utf-8'
    );

    createSpinner.succeed('DEJA directory structure created');

    console.log(chalk.green('\n  DEJA initialized successfully!\n'));
    console.log(chalk.gray('  Created:'));
    console.log(chalk.gray(`    - ${DEJA_DIR}/`));
    console.log(chalk.gray(`    - ${DEJA_DIR}/${CONFIG_FILE}`));
    console.log(chalk.gray(`    - ${DEJA_DIR}/${STATE_FILE}`));
    console.log(chalk.gray(`    - ${DEJA_DIR}/${SESSIONS_DIR}/`));
    console.log('');
    console.log(chalk.blue('  Next steps:'));
    console.log(chalk.white('    1. Run `deja start` to begin a coding session'));
    console.log(chalk.white('    2. Make changes to your code'));
    console.log(chalk.white('    3. Run `deja stop` to save context\n'));
  } catch (error) {
    createSpinner.fail('Failed to create DEJA directory structure');
    console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export const initCommand = new Command('init')
  .description('Initialize DEJA in the current directory')
  .action(initAction);
