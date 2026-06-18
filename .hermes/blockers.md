# Blockers & Tracked Follow-ups (fable5 production pass)

Nothing in this pass was a hard blocker — the required work (engine, SDK,
integration, templates) all completed and is green. The items below are
deliberate scope boundaries: real improvements that are larger than a
"fix, don't rewrite" pass or that can't be verified without hardware.

## 1. Templates still use raw Even Hub primitives where the SDK has no wrapper

`asr/`, `image/`, and `text-heavy/` now consume `@aljamri/aura-sdk` (display
constants) and build cleanly, but they still call the Even Hub SDK directly for
capabilities the SDK does not yet wrap:

- `asr/` — `bridge.audioControl` + raw PCM frames from `event.audioEvent`.
- `image/` — `ImageRawDataUpdate` for serial raw-image writes.
- `text-heavy/` — `@evenrealities/pretext` pagination + scroll events.

Fully routing these through an `Aura`-class API would require adding audio,
raw-image, and pagination surfaces to the SDK, plus simulator/glasses
verification (no hardware in this environment). Tracked, not done here.

## 2. `EngineClient.detectMode` ↔ engine `/mode` contract mismatch

The TS client posts `{hour, day, wearing}`; the engine `/mode` endpoint expects
`{device_info, recent_interactions}`. Pydantic ignores the unknown fields, so the
call returns a default-context mode instead of erroring. The Arabic render path
(the critical one) is unaffected. Aligning the contract — likely by reshaping the
client request or accepting both shapes server-side — is a follow-up.

## 3. Arabic-support probe is a safety net, not a guarantee on minimal images

`ArabicBitmapRenderer.font_supports_arabic` only reports `False` for the PIL
bitmap default. On modern Pillow even `load_default()` returns a TrueType font
with some Arabic coverage, so the probe rarely fires. The real guarantee is the
bundled Amiri font (`engine/fonts/Amiri-Regular.ttf`), which is always loaded
first. The probe remains as defense-in-depth.

## 4. CI does not build the templates

`.github/workflows/ci.yml` builds and tests `aura-sdk` and `engine` only. Adding
a template build job would have caught the duplicate-import regression. Not added
here to avoid changing CI network/install assumptions, but recommended.

## 5. Branch name

The task requested a `fable5-production-pass` branch. The harness mandates
development on `claude/aura-sdk-production-pass-6cqlug` and forbids pushing
elsewhere, so all work landed there. Flagged for the reviewer.
