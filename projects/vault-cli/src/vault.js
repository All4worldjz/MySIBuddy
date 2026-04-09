/**
 * vault-cli/src/vault.js
 * Core vault management logic
 */

import chalk from 'chalk';
import { generateSecret } from './crypto.js';

export class VaultManager {
  constructor() {
    this._masterPassword = null;
    this._cache = null;
  }

  /**
   * Set master password after unlock
   */
  setPassword(password) {
    this._masterPassword = password;
  }

  /**
   * Clear password from memory
   */
  clearPassword() {
    this._masterPassword = null;
    this._cache = null;
  }

  /**
   * Add a new secret to the vault
   */
  async add(key, value, category = 'default', metadata = {}) {
    if (!this._masterPassword) throw new Error('Vault is locked');
    if (!key) throw new Error('Key is required');

    const data = await this._loadData();

    data.secrets[key] = {
      value,
      category,
      metadata,
      created: data.secrets[key]?.created || new Date().toISOString(),
      modified: new Date().toISOString(),
    };

    await this._saveData(data);
    return { success: true, key };
  }

  /**
   * Get a secret from the vault
   */
  async get(key) {
    if (!this._masterPassword) throw new Error('Vault is locked');

    const data = await this._loadData();
    const secret = data.secrets[key];

    if (!secret) return null;

    return {
      key,
      value: secret.value,
      category: secret.category,
      metadata: secret.metadata,
      created: secret.created,
      modified: secret.modified,
    };
  }

  /**
   * List all secrets (keys only, no values)
   */
  async list(category = null) {
    if (!this._masterPassword) throw new Error('Vault is locked');

    const data = await this._loadData();
    let secrets = Object.entries(data.secrets).map(([key, s]) => ({
      key,
      category: s.category,
      created: s.created,
      modified: s.modified,
    }));

    if (category) {
      secrets = secrets.filter(s => s.category === category);
    }

    return secrets;
  }

  /**
   * Remove a secret from the vault
   */
  async remove(key) {
    if (!this._masterPassword) throw new Error('Vault is locked');

    const data = await this._loadData();
    if (!data.secrets[key]) {
      throw new Error(`Secret '${key}' not found`);
    }

    delete data.secrets[key];
    await this._saveData(data);
    return { success: true, key };
  }

  /**
   * Update a secret
   */
  async update(key, value, category = null, metadata = null) {
    if (!this._masterPassword) throw new Error('Vault is locked');

    const data = await this._loadData();
    if (!data.secrets[key]) {
      throw new Error(`Secret '${key}' not found`);
    }

    data.secrets[key].value = value;
    if (category) data.secrets[key].category = category;
    if (metadata) data.secrets[key].metadata = { ...data.secrets[key].metadata, ...metadata };
    data.secrets[key].modified = new Date().toISOString();

    await this._saveData(data);
    return { success: true, key };
  }

  /**
   * Generate a random secret
   */
  async generate(key, length = 32, category = 'generated') {
    const value = generateSecret(length);
    return this.add(key, value, category, { generated: true, length });
  }

  /**
   * Export secrets (encrypted JSON or plain)
   */
  async export(format = 'json') {
    if (!this._masterPassword) throw new Error('Vault is locked');

    const data = await this._loadData();

    if (format === 'json') {
      return JSON.stringify(data.secrets, null, 2);
    } else if (format === 'env') {
      return Object.entries(data.secrets)
        .map(([k, s]) => `${k.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}=${s.value}`)
        .join('\n');
    }
    throw new Error(`Unknown format: ${format}`);
  }

  /**
   * Import secrets from JSON
   */
  async import(jsonData) {
    if (!this._masterPassword) throw new Error('Vault is locked');

    const imported = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const data = await this._loadData();

    let count = 0;
    for (const [key, secret] of Object.entries(imported)) {
      if (typeof secret === 'object' && secret.value) {
        data.secrets[key] = {
          value: secret.value,
          category: secret.category || 'imported',
          metadata: secret.metadata || {},
          created: secret.created || new Date().toISOString(),
          modified: new Date().toISOString(),
        };
      } else {
        data.secrets[key] = {
          value: String(secret),
          category: 'imported',
          metadata: {},
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        };
      }
      count++;
    }

    await this._saveData(data);
    return { success: true, count };
  }

  // Private methods
  async _loadData() {
    if (this._cache) return this._cache;

    const { readVault } = await import('./crypto.js');
    const data = readVault(this._masterPassword);
    this._cache = data;
    return data;
  }

  async _saveData(data) {
    const { writeVault } = await import('./crypto.js');
    writeVault(data, this._masterPassword);
    this._cache = data;
  }
}

export default VaultManager;
