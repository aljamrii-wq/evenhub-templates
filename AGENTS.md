# AGENTS.md

## Scope
- This file applies to the Aura repository (smart glasses AI layer).
- The workspace `AGENTS.md` remains binding. This file must not weaken safety, verification, or bilingual-language requirements.

## Release Policy
- Development pushes never trigger deploys, releases, or production cutovers.
- Only Git tags matching `v*` may trigger production delivery.
- Use `./scripts/release.sh <version>` for releases (when built).
- Do not run production deploys, npm publish, or Even Hub portal uploads from development pushes.

## Project Mastery
- Aura is an on-glasses intelligence layer for Even Realities G2 smart glasses.
- Start with `README.md`, this file, `.hermes/architecture.md`, `aura-sdk/package.json`, and `engine/requirements.txt` before broad file search.
- Main surfaces: `aura-sdk/` (TypeScript SDK), `engine/` (Python backend), four template apps (`minimal/`, `asr/`, `image/`, `text-heavy/`).
- The SDK wraps Even Hub SDK with Arabic rendering, IMU gestures, Hermes bridge, and auto-mode detection.
- The engine provides FastAPI + WebSocket backend with Arabic bitmap rendering via PIL.

## Delivery Rules
- For SDK changes, run `cd aura-sdk && npm run build`.
- For engine changes, run `cd engine && source .venv/bin/activate && pytest -v`.
- For template changes, verify `npm run build` in the affected template directory.
- Own the worktree end-to-end: classify every dirty and untracked path as intended source, generated artifact, runtime/cache, or unknown.

## Mandatory Bilingual Rule
- Aura must support English and Arabic across the SDK, engine, and template apps.
- Arabic text must be rendered via the engine's ArabicBitmapRenderer (PIL + arabic_reshaper + python-bidi).
- Arabic UI must use RTL layout where applicable.
- SDK must detect Arabic vs English and route to correct renderer.
- No Aura release is launch-ready until English, Arabic, and RTL behavior pass verification.

## Verification
- Verify Arabic rendering with real Arabic strings via pytest.
- Verify SDK builds cleanly with `tsc --noEmit` or `npm run build`.
- Check engine health endpoint returns 200 after deploy.

## No Demo-Mode Engineering
- Agent output from any worker is draft evidence only until verified against this repo, tests, runtime, or exact issue requirements.
- For complex coding, research, or infrastructure work, final quality requires direct project evidence: files read, call graph understood, real diffs, real tests, real build output.

## Security Boundaries
- No secrets in code. Use env vars for HERMES_API_KEY, AURA_SECRET.
- No deploys, no merges to main, no npm publish, no Even Hub portal uploads unless issue explicitly authorizes.
- No cross-repo edits beyond the Aura repo.
- WebSocket connections must be authenticated before production use.

## Ecosystem Awareness
- `even-toolkit` (67★) provides battle-tested G2 components — evaluate before rebuilding.
- `g2-kit-unofficial` (16★) documents BLE protocol gotchas — study `ble/docs/` before direct BLE work.
- The G2 developer ecosystem has 15+ community apps — check for prior art before building new features.
