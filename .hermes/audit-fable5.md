# Aura Production-Readiness Audit (fable5 pass)

> Date: 2026-06-18 · Branch: `claude/aura-sdk-production-pass-6cqlug`
> Scope: SDK (`aura-sdk/`), engine (`engine/`), Flutter companion (`lib/`), templates.

## Method

Read `README.md`, `AGENTS.md`, `aura-sdk/src/index.ts`, `engine/main.py`,
`engine/renderer.py`, `lib/main.dart`, plus the full SDK source, engine bridge,
and the four templates. Ran the engine and SDK test suites against a fresh
environment.

## Baseline state (measured)

| Suite | Command | Result |
|---|---|---|
| Engine | `python -m pytest engine/ -q` | **136 passed** |
| Engine coverage | `--cov=renderer` | **95%** (already > 90%) |
| SDK | `npm test` | **4 of 8 suites fail to compile**; 67 tests pass in the suites that do compile |
| SDK types | `npx tsc --noEmit` | **17 errors** |
| Templates | `npm run build` | **broken** — duplicate `waitForEvenAppBridge` import in every `main.ts` |

The codebase is much further along than "hacked-together": the engine is solid
and well-tested, and the SDK has good test coverage. The breakage is concentrated
in a few real defects rather than being pervasive.

## What's production-ready

- **Engine HTTP/render path.** `renderer.py` is clean, validates dimensions and
  font size, handles empty input, and packs 4-bit grayscale correctly. 95% coverage.
- **Engine WebSocket auth.** `_validate_ws_origin` is genuinely careful: header
  + subprotocol token auth, `secrets.compare_digest`, localhost-only fallback,
  and an explicit refusal to accept query-string tokens.
- **Engine input bounding.** `/render` caps text length; `/mode` truncates keys,
  values, and interaction counts server-side beyond the Pydantic limits.
- **SDK container-constraints.** Branded types + validators for G2 geometry are
  thorough and well-tested.
- **SDK gesture + mode logic.** `gestures.ts` and `modes.ts` are coherent and pass.

## What's broken (root causes)

1. **SDK does not type-check (17 errors).** `engine.ts` imports six `Engine*`
   types that were never added to `types.ts`. `bridge/index.ts` reads four
   `bridge*` fields that aren't on `AuraConfig`. `aura.ts` reads
   `this.hermes.version`, and `hermes.test.ts` reads `bridge.isReady` — neither
   exists on `HermesBridge`. These block 4 test suites from even compiling.
2. **`HermesBridge` is the pre-handshake version.** The tests describe a HELLO/
   `hello_ack` handshake with `isReady`, `version`, reconnect-with-backoff, and
   reject-on-close-during-handshake. The shipped class has none of it. (The
   `send` unit test is also internally inconsistent with the reconnect test about
   whether a HELLO frame is emitted on open — one of the two must be reconciled.)
3. **Arabic renders as tofu.** `arabic_reshaper` + `python-bidi` produce correct
   codepoints, but no Arabic-capable font is installed, so `_load_font` falls
   back to DejaVuSans (Latin only). Every Arabic glyph becomes a `.notdef` box.
   Tests pass because they assert byte length / non-blank, not glyph correctness.
   **This violates the "Arabic is non-negotiable" requirement.**
4. **Templates don't build.** Each `main.ts` imports `waitForEvenAppBridge`
   twice — a redeclaration error that fails `tsc --noEmit`. `asr/`, `image/`,
   and `text-heavy/` also use the raw Even Hub SDK and aren't wired to
   `@aljamri/aura-sdk` (not in the npm workspace).
5. **Engine WS reconnect is untested, and there's no SDK↔engine handshake.**
   `handle_websocket` has no disconnect/reconnect test, and the engine has no
   HELLO handler, so the SDK handshake (once added) has nothing to talk to.

## Top 5 fixes ranked by user-visible impact

1. **Install/bundle an Arabic font and verify real glyph rendering.** Without
   this, the entire Arabic value proposition shows boxes. Highest user impact.
2. **Make the SDK type-check and pass `npm test`.** Add the missing types,
   implement the `HermesBridge` handshake (`isReady`/`version`/reconnect), and
   reconcile the inconsistent test. Unblocks the whole SDK.
3. **Fix the four templates so they build** (remove duplicate import, add error
   handling). These are the first thing a developer runs.
4. **Add HELLO handshake + disconnect/reconnect tests to the engine** so the
   SDK and engine agree on the wire protocol end-to-end.
5. **Document and verify the cross-stack pipeline** (Arabic text → engine PNG →
   SDK → display) so integration regressions are catchable.

## Known constraints / notes

- `EngineClient.detectMode({hour,day,wearing})` does not match the engine
  `/mode` contract (`device_info` + `recent_interactions`). Pydantic ignores the
  extra fields, so it returns a default rather than erroring. Tracked, not fixed
  in this pass (out of the core Arabic pipeline).
- The task asks for a `fable5-production-pass` branch, but the harness mandates
  development on `claude/aura-sdk-production-pass-6cqlug` and forbids pushing
  elsewhere. Work is delivered on the mandated branch.
