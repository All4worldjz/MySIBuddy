# Openclaw Setup Notes

## Required Inputs

- API keys in `.env`
- Openclaw runtime config based on `config/openclaw/openclaw.example.json`

## Recommended Flow

1. Fill `.env` with provider credentials.
2. Copy `config/openclaw/openclaw.example.json` to your local runtime config.
3. Update host, port, and model routing as needed.
4. Run the bootstrap script to validate the local project layout.

## Next Implementation Targets

- add the real Openclaw launcher or integration script
- connect MySiBuddy-specific logic under `src/`
- introduce tests after runtime behavior is defined

