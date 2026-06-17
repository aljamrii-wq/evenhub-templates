# Security Policy

## Reporting a Vulnerability

Aura is a private project. Do not disclose security issues publicly.

**Report to:** repository owner via GitHub Security Advisories or direct contact.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x (pre-release) | ✅ Active development |

## Security Practices

- No secrets in source code — all credentials via environment variables
- WebSocket connections require authentication before production use
- Arabic text input is sanitized before bitmap rendering
- Dependencies are monitored weekly via Dependabot
- CodeQL static analysis runs on every push to main
- All PRs require CI pass before merge

## Scope

- `engine/` — Python backend, WebSocket server, bitmap renderer
- `aura-sdk/` — TypeScript SDK, Even Hub bridge
- Template apps — G2 glasses demo scaffolds
