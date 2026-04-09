# vault-cli

> Secure secret management CLI for OpenClaw

A command-line tool for securely storing and managing API keys, tokens, passwords, and other sensitive configuration data. Built with security best practices including AES-256-GCM encryption.

## Features

- 🔐 **AES-256-GCM encryption** - Authenticated encryption for all stored secrets
- 🔑 **Master password protection** - PBKDF2 key derivation (310,000 iterations)
- 📁 **Local file storage** - Secrets stored encrypted on disk
- 🛠️ **CLI commands** - add, get, list, remove, update, generate, import, export
- 🔄 **Categories** - Organize secrets by type (api-keys, tokens, passwords, etc.)
- 📤 **Import/Export** - JSON and .env format support

## Quick Start

```bash
# Initialize vault
vault init

# Unlock vault
vault unlock

# Add a secret
vault add github_token "ghp_xxxxx" --category api-keys

# Get a secret
vault get github_token --show

# List all secrets
vault list

# Generate a random secret
vault generate database_password --length 64

# Remove a secret
vault remove old_token
```

## Installation

```bash
# Clone or copy the vault-cli directory
cd vault-cli

# Install dependencies
npm install

# Link globally (optional)
npm link
```

## Commands

| Command | Description |
|---------|-------------|
| `vault init` | Initialize a new vault with master password |
| `vault unlock` | Unlock the vault |
| `vault lock` | Lock the vault |
| `vault status` | Show vault status |
| `vault add <key> <value>` | Add a new secret |
| `vault get <key>` | Get a secret by key |
| `vault list` | List all secrets |
| `vault remove <key>` | Remove a secret |
| `vault update <key> <value>` | Update a secret |
| `vault generate <key>` | Generate a random secret |
| `vault export [-f json\|env]` | Export secrets |
| `vault import <file>` | Import secrets from JSON |

## Options

```
vault add:
  -c, --category <category>   Category for the secret (default: default)
  -m, --metadata <json>       Metadata as JSON string

vault get:
  -s, --show                  Show value in plain text

vault list:
  -c, --category <category>   Filter by category
  -v, --values                Show secret values (dangerous!)

vault remove:
  -f, --force                 Skip confirmation

vault generate:
  -l, --length <length>       Secret length in bytes (default: 32)
  -c, --category <category>    Category (default: generated)

vault export:
  -f, --format <format>       Export format: json, env (default: json)
  -o, --output <file>         Output file
```

## Security

### Encryption
- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2-SHA256 with 310,000 iterations (OWASP recommended)
- **Salt**: 256-bit random salt per encryption operation
- **IV**: 96-bit random IV per encryption operation

### File Permissions
- Vault directory: `700` (rwx------)
- Config and data files: `600` (rw-------)

### Best Practices
1. Use a strong master password (16+ characters recommended)
2. Never commit vault files to version control
3. Add `vault/` to `.gitignore`
4. Lock vault when not in use (`vault lock`)
5. Use `--force` only in scripts, not interactively

## OpenClaw Integration

vault-cli is designed to integrate with OpenClaw's tool calling system. Example integration:

```javascript
// In your OpenClaw tool definition
{
  name: 'vault_get',
  description: 'Get a secret from the vault',
  parameters: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Secret key' }
    },
    required: ['key']
  },
  async execute({ key }) {
    // Use vault CLI to get secret
    // Requires vault to be unlocked first
  }
}
```

## File Structure

```
vault-cli/
├── package.json
├── README.md
├── src/
│   ├── index.js      # CLI entry point
│   ├── crypto.js     # Encryption/decryption utilities
│   └── vault.js      # VaultManager class
├── tests/
│   └── vault.test.js # Unit tests
└── vault/            # Vault data directory (created on init)
    ├── .config       # Master password hash
    └── secrets.json  # Encrypted secrets
```

## License

MIT
