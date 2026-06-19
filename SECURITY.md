# Security Policy

## Reporting a Vulnerability

Aura is a private project. Do not disclose security issues publicly.

**Preferred channel:** [GitHub Security Advisory](https://github.com/aljamrigroup/aura/security/advisories/new) — encrypts the report and tracks it privately.

**Backup contact:** [security@aljamrigroup.com](mailto:security@aljamrigroup.com)

Please include:
- A clear description of the vulnerability
- Steps to reproduce (proof-of-concept preferred)
- Affected components and versions
- Any suggested remediation

## Supported Versions

| Version | Supported |
|---------|-----------|
| main branch (0.x pre-release) | ✅ Active development |

Only the `main` branch receives security patches. Pre-1.0, all releases are pre-release — breaking changes may occur without notice.

## Response SLAs

| Severity | Acknowledge | Patch |
|----------|-------------|-------|
| Critical | 48 hours | 7 days |
| High | 5 business days | 14 days |
| Medium | 14 days | 30 days |
| Low | 30 days | Best effort |

Severity is assessed by the maintainer based on impact, exploitability, and affected component. Reporters will receive an initial acknowledgment within the SLA for the assessed severity tier.

## Coordinated Disclosure

We follow a 90-day coordinated disclosure window:
- Reporter provides details privately via GitHub Security Advisory or email
- Maintainer acknowledges within the SLA for the assessed severity
- Fix is developed and merged to main
- Public disclosure may occur after 90 days from the initial report, or earlier by mutual agreement

## Scope

| Component | Path | Description |
|-----------|------|-------------|
| Aura SDK | `aura-sdk/` | TypeScript SDK — G2 bridge, Arabic renderer, gesture engine, mode detector |
| Aura Engine | `engine/` | Python FastAPI backend — WebSocket server, bitmap renderer, mode detection |
| Flutter companion app | `lib/`, `ios/` | Native phone companion — BLE, audio, display pipeline |
| Templates | `asr/`, `hud/`, `image/`, `minimal/`, `text-heavy/` | G2 glasses demo scaffolds |

Out of scope:
- Third-party dependencies (report upstream)
- Even Hub companion app (Even Realities product)
- `docs/` (informational content only)

## Security Practices

- Secrets are never committed — all credentials live in environment variables
- GitHub Actions CI runs on every PR to `main` and `dev` with pinned action SHAs
- Dependabot monitors npm and GitHub Actions dependencies weekly
- Dependencies are pinned to exact SHAs (GitHub Actions) and lockfiles (npm)
- CI enforces concurrency groups to prevent stale runs from interfering

## Hall of Fame

We appreciate the security community's help in keeping Aura secure. Researchers who report valid vulnerabilities will be acknowledged here (with permission).
