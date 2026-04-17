# evenhub-templates

Starter templates for [Even Realities G2](https://www.evenrealities.com/) smart glasses apps.

Four fully working scaffolds you can clone and run:

| Template | What it shows |
|---|---|
| [`minimal/`](./minimal) | Bare base: Vite + TypeScript + Even Hub SDK + simulator. "Hello from G2!" on the display. |
| [`asr/`](./asr) | Live mic → speech-to-text pipeline with companion UI and double-tap exit. STT provider is a blank stub — plug in your own. |
| [`image/`](./image) | Image container rendering. Preprocessing/dithering is optional; the SDK handles grayscale conversion. |
| [`text-heavy/`](./text-heavy) | Long-form text with click-to-advance pagination. Demonstrates the 2000-char `textContainerUpgrade` path. |

## Get a template

Using [`degit`](https://github.com/Rich-Harris/degit) (recommended — no git history, fast):

```bash
npx degit LesenmiaoYu/evenhub-templates/minimal my-app
cd my-app
npm install
npm run dev
```

Substitute `minimal` with `asr`, `image`, or `text-heavy` for the other templates.

Or clone the whole repo and copy the folder you want:

```bash
git clone https://github.com/LesenmiaoYu/evenhub-templates.git
cp -r evenhub-templates/asr my-app
cd my-app && npm install
```

## Prerequisites

- Node.js v18+
- The Even Hub companion app installed on a phone, or the `evenhub-simulator` on desktop
- (ASR template only) An STT provider of your choice — Deepgram, AssemblyAI, Whisper, Soniox, self-hosted, etc.

## Test on real glasses

```bash
npm run dev
npx evenhub qr --url http://<your-ip>:5173
```

Scan the QR code with the Even Hub companion app on a phone paired with your G2.

## Test in the simulator

```bash
npm run dev
npx evenhub-simulator http://localhost:5173
```

## Pack for distribution

```bash
npx evenhub pack
```

Produces an `.ehpk` you can upload through the Even Hub dev portal.

## Hardware quick reference

| Property | Value |
|---|---|
| Display | 576 x 288 px, 4-bit greyscale (16 shades of green) |
| Microphone | On the glasses, PCM s16le @ 16 kHz mono |
| Camera | None |
| Speaker | None |
| Input | Touchpad on the temple, optional R1 ring |

## Resources

- [Even Hub Docs](https://hub.evenrealities.com/docs/getting-started/overview)
- [Even Hub SDK (npm)](https://www.npmjs.com/package/@evenrealities/even_hub_sdk)
- [Even Hub CLI (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-cli)
- [Simulator (npm)](https://www.npmjs.com/package/@evenrealities/evenhub-simulator)
- [Community Discord](https://discord.gg/Y4jHMCU4sv)

## License

MIT
