import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import yaml from 'yaml';
import type { DejaConfig } from '../types.js';

const DEJA_DIR = '.deja';
const CONFIG_FILE = 'config.yml';

async function checkInitialized(cwd: string): Promise<boolean> {
  try {
    await fs.access(path.join(cwd, DEJA_DIR));
    return true;
  } catch {
    return false;
  }
}

async function getConfig(cwd: string): Promise<DejaConfig | null> {
  try {
    const configPath = path.join(cwd, DEJA_DIR, CONFIG_FILE);
    const content = await fs.readFile(configPath, 'utf-8');
    return yaml.parse(content) as DejaConfig;
  } catch {
    return null;
  }
}

function formatConfigValue(value: unknown, indent: number = 0): string {
  const spaces = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return chalk.gray('null');
  }

  if (typeof value === 'string') {
    return chalk.green(`"${value}"`);
  }

  if (typeof value === 'number') {
    return chalk.yellow(String(value));
  }

  if (typeof value === 'boolean') {
    return chalk.cyan(String(value));
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return chalk.gray('[]');
    }
    const items = value.map(v => `${spaces}  - ${formatConfigValue(v)}`).join('\n');
    return `\n${items}`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return chalk.gray('{}');
    }
    const items = entries.map(([k, v]) => {
      const formattedValue = formatConfigValue(v, indent + 1);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return `${spaces}  ${chalk.white(k)}:\n${formattedValue}`;
      }
      return `${spaces}  ${chalk.white(k)}: ${formattedValue}`;
    }).join('\n');
    return `\n${items}`;
  }

  return String(value);
}

function displayConfig(config: DejaConfig): void {
  console.log(chalk.blue('  Current Configuration\n'));
  console.log(chalk.gray('  ' + '-'.repeat(50)));
  console.log('');

  const entries = Object.entries(config);

  for (const [key, value] of entries) {
    const formattedValue = formatConfigValue(value);
    if (typeof value === 'object' && value !== null) {
      console.log(`  ${chalk.white.bold(key)}:${formattedValue}`);
    } else {
      console.log(`  ${chalk.white.bold(key)}: ${formattedValue}`);
    }
  }

  console.log('');
  console.log(chalk.gray('  ' + '-'.repeat(50)));
  console.log('');
}

async function openInEditor(cwd: string): Promise<void> {
  const configPath = path.join(cwd, DEJA_DIR, CONFIG_FILE);
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';

  console.log(chalk.gray(`  Opening ${CONFIG_FILE} in ${editor}...\n`));

  try {
    execSync(`${editor} "${configPath}"`, {
      stdio: 'inherit',
    });
    console.log(chalk.green('\n  Configuration file closed.'));
    console.log(chalk.gray('  Changes will take effect on the next session.\n'));
  } catch (error) {
    console.error(chalk.red(`  Failed to open editor: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.log(chalk.gray(`  You can manually edit: ${configPath}\n`));
    process.exit(1);
  }
}

async function configAction(options: { edit: boolean }): Promise<void> {
  const cwd = process.cwd();

  console.log('');

  // Check if DEJA is initialized
  if (!await checkInitialized(cwd)) {
    console.log(chalk.red('  DEJA is not initialized in this directory.'));
    console.log(chalk.gray('  Run `deja init` first to set up DEJA.\n'));
    process.exit(1);
  }

  if (options.edit) {
    await openInEditor(cwd);
    return;
  }

  // Read and display configuration
  const config = await getConfig(cwd);

  if (!config) {
    console.log(chalk.red('  Unable to read configuration file.'));
    console.log(chalk.gray(`  Expected: ${path.join(DEJA_DIR, CONFIG_FILE)}`));
    console.log(chalk.gray('  Try running `deja init` to reinitialize.\n'));
    process.exit(1);
  }

  displayConfig(config);

  console.log(chalk.gray('  Config file: ' + path.join(cwd, DEJA_DIR, CONFIG_FILE)));
  console.log(chalk.gray('  Use `deja config --edit` to modify settings.\n'));
}

export const configCommand = new Command('config')
  .description('Show or edit DEJA configuration')
  .option('-e, --edit', 'Open configuration in $EDITOR')
  .action((options) => configAction({ edit: options.edit || false }));
