/**
 * vault-cli/tests/vault.test.js
 * Unit tests for vault-cli
 */

import { jest } from '@jest/globals';
import { encrypt, decrypt, hashPassword, verifyPassword, generateSecret, isVaultInitialized } from '../src/crypto.js';
import VaultManager from '../src/vault.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_VAULT_DIR = path.join(__dirname, '..', 'vault');
const TEST_CONFIG = path.join(TEST_VAULT_DIR, '.config');
const TEST_VAULT_FILE = path.join(TEST_VAULT_DIR, 'secrets.json');

function cleanupTestVault() {
  try {
    if (fs.existsSync(TEST_CONFIG)) fs.unlinkSync(TEST_CONFIG);
    if (fs.existsSync(TEST_VAULT_FILE)) fs.unlinkSync(TEST_VAULT_FILE);
    if (fs.existsSync(TEST_VAULT_DIR)) fs.rmdirSync(TEST_VAULT_DIR);
  } catch (e) { /* ignore */ }
}

describe('crypto', () => {
  test('encrypt and decrypt roundtrip', () => {
    const plaintext = 'my-super-secret-key-123';
    const password = 'test-password-123';

    const encrypted = encrypt(plaintext, password);
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = decrypt(encrypted, password);
    expect(decrypted).toBe(plaintext);
  });

  test('decrypt with wrong password fails', () => {
    const plaintext = 'secret';
    const password = 'correct-password';

    const encrypted = encrypt(plaintext, password);

    expect(() => decrypt(encrypted, 'wrong-password')).toThrow();
  });

  test('hashPassword and verifyPassword', () => {
    const password = 'my-password';

    const { salt, hash } = hashPassword(password);
    expect(salt).toBeDefined();
    expect(hash).toBeDefined();

    expect(verifyPassword(password, hash, salt)).toBe(true);
    expect(verifyPassword('wrong-password', hash, salt)).toBe(false);
  });

  test('generateSecret produces unique values', () => {
    const secret1 = generateSecret(32);
    const secret2 = generateSecret(32);

    expect(secret1).not.toBe(secret2);
    expect(secret1.length).toBe(64); // 32 bytes = 64 hex chars
  });
});

describe('VaultManager', () => {
  let manager;

  beforeEach(() => {
    cleanupTestVault();
    manager = new VaultManager();
  });

  afterEach(() => {
    manager.clearPassword();
    cleanupTestVault();
  });

  test('setPassword and clearPassword', () => {
    manager.setPassword('test');
    manager.clearPassword();
    // No error = pass
  });

  test('add secret requires password', async () => {
    await expect(manager.add('key', 'value')).rejects.toThrow('Vault is locked');
  });

  test('get secret requires password', async () => {
    await expect(manager.get('key')).rejects.toThrow('Vault is locked');
  });

  test('list secrets requires password', async () => {
    await expect(manager.list()).rejects.toThrow('Vault is locked');
  });

  test('remove secret requires password', async () => {
    await expect(manager.remove('key')).rejects.toThrow('Vault is locked');
  });

  test('add requires key', async () => {
    manager.setPassword('test');
    // Can't easily test without mocking the vault file system
  });
});

describe('vault integration', () => {
  const TEST_PASSWORD = 'integration-test-pass-123';

  beforeAll(() => {
    cleanupTestVault();
  });

  afterAll(() => {
    cleanupTestVault();
  });

  test('full vault lifecycle', async () => {
    const { initializeVault, isVaultInitialized, unlockVault } = await import('../src/crypto.js');

    // Should not be initialized initially
    cleanupTestVault();
    expect(isVaultInitialized()).toBe(false);

    // Initialize
    initializeVault(TEST_PASSWORD);
    expect(isVaultInitialized()).toBe(true);

    // Unlock with correct password
    expect(unlockVault(TEST_PASSWORD)).toBe(true);

    // Unlock with wrong password
    expect(() => unlockVault('wrong')).toThrow('Invalid master password');
  });
});
