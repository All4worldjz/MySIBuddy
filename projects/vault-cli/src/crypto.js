/**
 * vault-cli/src/crypto.js
 * Cryptographic utilities for secure secret storage
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = path.join(__dirname, '..', 'vault');
const VAULT_FILE = path.join(VAULT_DIR, 'secrets.json');
const SALT_FILE = path.join(VAULT_DIR, '.salt');
const CONFIG_FILE = path.join(VAULT_DIR, '.config');

// PBKDF2 iterations for key derivation (OWASP recommended)
const PBKDF2_ITERATIONS = 310000;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;   // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derives encryption key from master password using PBKDF2
 */
function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts plaintext using AES-256-GCM
 */
export function encrypt(plaintext, password) {
  const salt = crypto.randomBytes(32);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts ciphertext using AES-256-GCM
 */
export function decrypt(encryptedData, password) {
  const { salt, iv, ciphertext, authTag } = encryptedData;

  const key = deriveKey(password, Buffer.from(salt, 'hex'));
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Hashes password for verification (not for encryption)
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(32);
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512');
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

/**
 * Verifies password against stored hash
 */
export function verifyPassword(password, storedHash, storedSalt) {
  const hash = crypto.pbkdf2Sync(password, Buffer.from(storedSalt, 'hex'), PBKDF2_ITERATIONS, 64, 'sha512');
  return crypto.timingSafeEqual(hash, Buffer.from(storedHash, 'hex'));
}

/**
 * Generates a cryptographically secure random string
 */
export function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Ensures vault directory exists
 */
function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { mode: 0o700 }); // Restrictive permissions
  }
}

/**
 * Checks if vault is initialized
 */
export function isVaultInitialized() {
  ensureVaultDir();
  return fs.existsSync(CONFIG_FILE) && fs.existsSync(VAULT_FILE);
}

/**
 * Initializes a new vault with master password
 */
export function initializeVault(masterPassword) {
  ensureVaultDir();

  if (isVaultInitialized()) {
    throw new Error('Vault already initialized. Use vault unlock instead.');
  }

  // Store hashed master password for verification
  const { salt, hash } = hashPassword(masterPassword);
  const config = { salt, hash, version: '1.0.0', created: new Date().toISOString() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config), { mode: 0o600 });

  // Initialize empty secrets file
  const emptyVault = encrypt(JSON.stringify({ secrets: {} }), masterPassword);
  fs.writeFileSync(VAULT_FILE, JSON.stringify(emptyVault), { mode: 0o600 });

  return true;
}

/**
 * Unlocks vault and returns true if password is correct
 */
export function unlockVault(masterPassword) {
  if (!isVaultInitialized()) {
    throw new Error('Vault not initialized. Run: vault init');
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (!verifyPassword(masterPassword, config.hash, config.salt)) {
    throw new Error('Invalid master password');
  }

  return true;
}

/**
 * Reads and decrypts secrets from vault
 */
export function readVault(masterPassword) {
  const encrypted = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
  const decrypted = decrypt(encrypted, masterPassword);
  return JSON.parse(decrypted);
}

/**
 * Writes and encrypts secrets to vault
 */
export function writeVault(data, masterPassword) {
  const encrypted = encrypt(JSON.stringify(data), masterPassword);
  fs.writeFileSync(VAULT_FILE, JSON.stringify(encrypted), { mode: 0o600 });
}

export { VAULT_DIR, VAULT_FILE };
