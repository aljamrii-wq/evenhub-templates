# hud

Always-on heads-up display for Even Realities G2 glasses. Shows time, date, mode, Hermes status, and a time-of-day greeting. Renders natively in English; Arabic goes through aura-engine for proper RTL shaping.

**English + Arabic** — switch via `?lang=ar` query param. Default is English.

## Run

```bash
npm install
npm run dev
```

Then either:
- **Simulator:** `npm run simulate`
- **Real glasses:** `npx evenhub qr --url http://<your-ip>:5174` and scan with the Even Hub companion app.

## Pack for distribution

```bash
npm run pack
```

Produces an `.ehpk` file you can upload through the Even Hub dev portal.

## What's in here

| File | Purpose |
|---|---|
| `index.html` | WebView host with companion mirror UI. |
| `src/main.ts` | HUD logic: clock, greeting, mode detection, Arabic rendering. |
| `src/bridge.ts` | Waits for EvenAppBridge singleton (shared with all templates). |
| `app.json` | Even Hub manifest. `supported_languages: ["en", "ar"]`. |
| `tsconfig.json` | Standard Vite vanilla-ts config. |
| `vite.config.ts` | Dev server on port 5174, host binding for LAN QR access. |

## Design

**English mode** uses three native text containers for a crisp layout:

```
│  FlyDubai ● Hermes   4:30 PM        │  ← top bar
│                                      │
│         Good Morning                 │  ← greeting
│    Monday, June 19                   │  ← date
│                                      │
│  tap · double-tap: exit              │  ← hint
```

**Arabic mode** composes the HUD as a single multi-line string and renders it through aura-engine's `/render` endpoint for correct RTL shaping and connected glyphs:

```
│  ✦ فلاي دبي ✦   ٤:٣٠ م             │
│                                      │
│         صباح الخير                   │
│   الاثنين، ١٩ يونيو                 │
│                                      │
│  اضغط للتحديث · اضغط مرتين للخروج     │
```

## Interactions

| Gesture | Action |
|---|---|
| Tap | Force-refresh the display |
| Double-tap | Exit the app |

## Next steps

- Add Hermes WebSocket connection for live status and AI responses.
- Wire IMU gestures (nod = cycle mode, shake = toggle language).
- Persist language preference via `setLocalStorage`.
- Add a second info card (tap to cycle: clock → weather → calendar).
