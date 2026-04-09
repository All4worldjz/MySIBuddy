#!/usr/bin/env node

/**
 * vault-cli/src/index.js
 * Main CLI entry point for vault-cli
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import VaultManager from './vault.js';
import {
  initializeVault,
  unlockVault,
  isVaultInitialized,
  generateSecret,
} from './crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();
const vault = new VaultManager();

// Session state
let sessionPassword = null;

function promptPassword(message = 'Enter master password: ') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    rl.question(message, (password) => {
      rl.close();
      resolve(password);
    });
  });
}

function promptConfirm(message = 'Are you sure? ') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    rl.question(message + ' (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

// Commands

// vault init
program
  .command('init')
  .description('Initialize a new vault with master password')
  .action(async () => {
    try {
      if (isVaultInitialized()) {
        console.log(chalk.yellow('⚠ Vault already initialized. Use vault unlock to open it.'));
        return;
      }

      console.log(chalk.blue('🔐 Initializing new vault...\n'));
      const password = await promptPassword('Create master password: ');
      if (!password) {
        console.log(chalk.red('❌ Password cannot be empty'));
        return;
      }

      const confirm = await promptPassword('Confirm master password: ');
      if (password !== confirm) {
        console.log(chalk.red('❌ Passwords do not match'));
        return;
      }

      initializeVault(password);
      console.log(chalk.green('✅ Vault initialized successfully!'));
      console.log(chalk.gray('  Run vault unlock to start using secrets.'));
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault unlock
program
  .command('unlock')
  .description('Unlock the vault with master password')
  .action(async () => {
    try {
      if (!isVaultInitialized()) {
        console.log(chalk.yellow('⚠ Vault not initialized. Run vault init first.'));
        return;
      }

      const password = await promptPassword('Enter master password: ');
      unlockVault(password);
      sessionPassword = password;
      vault.setPassword(password);
      console.log(chalk.green('🔓 Vault unlocked successfully!'));
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault lock
program
  .command('lock')
  .description('Lock the vault')
  .action(() => {
    sessionPassword = null;
    vault.clearPassword();
    console.log(chalk.green('🔒 Vault locked.'));
  });

// vault add <key> <value>
program
  .command('add <key> <value>')
  .description('Add a new secret')
  .option('-c, --category <category>', 'Category for the secret', 'default')
  .option('-m, --metadata <json>', 'Metadata as JSON string')
  .action(async (key, value, options) => {
    try {
      if (!isVaultInitialized()) {
        console.log(chalk.yellow('⚠ Vault not initialized. Run vault init first.'));
        return;
      }
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      const metadata = options.metadata ? JSON.parse(options.metadata) : {};
      const result = await vault.add(key, value, options.category, metadata);
      console.log(chalk.green(`✅ Secret '${key}' added successfully`));
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault get <key>
program
  .command('get <key>')
  .description('Get a secret by key')
  .option('-s, --show', 'Show value in plain text')
  .action(async (key, options) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      const secret = await vault.get(key);
      if (!secret) {
        console.log(chalk.yellow(`⚠ Secret '${key}' not found`));
        return;
      }

      if (options.show) {
        console.log(secret.value);
      } else {
        console.log(chalk.blue(`🔑 ${key}`));
        console.log(`   Value: ${chalk.cyan('••••••••')}`);
        console.log(`   Category: ${secret.category}`);
        console.log(`   Created: ${secret.created}`);
        console.log(`   Modified: ${secret.modified}`);
      }
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault list
program
  .command('list')
  .description('List all secrets')
  .option('-c, --category <category>', 'Filter by category')
  .option('-v, --values', 'Show secret values (dangerous!)')
  .action(async (options) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      const secrets = await vault.list(options.category);
      if (secrets.length === 0) {
        console.log(chalk.gray('No secrets found.'));
        return;
      }

      console.log(chalk.blue(`\n🔐 Secrets (${secrets.length}):\n`));
      secrets.forEach((s) => {
        const val = options.values ? chalk.cyan(s.metadata?.value || '') : chalk.gray('••••••••');
        console.log(`  ${chalk.white(s.key)}  ${chalk.gray('[' + s.category + ']')}  ${val}`);
      });
      console.log();
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault remove <key>
program
  .command('remove <key>')
  .description('Remove a secret')
  .option('-f, --force', 'Skip confirmation')
  .action(async (key, options) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      if (!options.force) {
        const confirmed = await promptConfirm(`Delete secret '${key}'?`);
        if (!confirmed) {
          console.log('Cancelled.');
          return;
        }
      }

      await vault.remove(key);
      console.log(chalk.green(`✅ Secret '${key}' removed`));
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault update <key> <value>
program
  .command('update <key> <value>')
  .description('Update a secret value')
  .option('-c, --category <category>', 'Update category')
  .action(async (key, value, options) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      await vault.update(key, value, options.category || null);
      console.log(chalk.green(`✅ Secret '${key}' updated`));
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault generate <key>
program
  .command('generate <key>')
  .description('Generate a random secret')
  .option('-l, --length <length>', 'Secret length in bytes', '32')
  .option('-c, --category <category>', 'Category', 'generated')
  .action(async (key, options) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      const result = await vault.generate(key, parseInt(options.length), options.category);
      const secret = await vault.get(key);
      console.log(chalk.green(`✅ Generated secret for '${key}'`));
      console.log(`   Value: ${chalk.cyan(secret.value)}`);
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault export
program
  .command('export')
  .description('Export secrets')
  .option('-f, --format <format>', 'Export format: json, env', 'json')
  .option('-o, --output <file>', 'Output file (stdout if not specified)')
  .action(async (options) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      const data = await vault.export(options.format);

      if (options.output) {
        fs.writeFileSync(options.output, data);
        console.log(chalk.green(`✅ Exported to ${options.output}`));
      } else {
        console.log(data);
      }
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault import
program
  .command('import <file>')
  .description('Import secrets from JSON file')
  .action(async (file) => {
    try {
      if (!sessionPassword) {
        console.log(chalk.yellow('⚠ Vault locked. Run vault unlock first.'));
        return;
      }
      vault.setPassword(sessionPassword);

      if (!fs.existsSync(file)) {
        console.log(chalk.red(`❌ File not found: ${file}`));
        return;
      }

      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const result = await vault.import(data);
      console.log(chalk.green(`✅ Imported ${result.count} secrets`));
    } catch (err) {
      console.error(chalk.red(`❌ Error: ${err.message}`));
    }
  });

// vault status
program
  .command('status')
  .description('Show vault status')
  .action(() => {
    const initialized = isVaultInitialized();
    console.log(chalk.blue('🔐 Vault Status'));
    console.log(`   Initialized: ${initialized ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`   Locked: ${sessionPassword ? chalk.green('No') : chalk.yellow('Yes')}`);
  });

program.parse();
