/**
 * Aura SDK Demo — Minimal Template
 *
 * Demonstrates:
 *   - English text via native G2 text rendering
 *   - Arabic text via aura-engine image rendering
 *   - Mode detection (flydubai/aljamri/personal)
 *   - Double-tap to exit
 */

import { Aura } from '@aljamri/aura-sdk'

// ── Init ──
const aura = new Aura({
  lang: 'ar',      // Primary: Arabic
  mode: 'auto',    // Auto-detect mode from time + context
  gestures: true,  // Enable head gesture detection
})

// Mode change callback — updates companion UI
aura.onModeChange((ctx) => {
  const el = document.getElementById('mode')
  if (el) el.textContent = ctx.mode
})

await aura.init()
console.log('Aura SDK initialized')

// ── Show English + Arabic on G2 display ──

// 1. Show English (text container)
await aura.show('Hello from Aura', 'en')
console.log('English text displayed')

// 2. Show Arabic via image rendering (2s later)
setTimeout(async () => {
  await aura.show('مرحبا من أورا', 'ar')
  console.log('Arabic text displayed via engine rendering')
}, 2000)

// ── Gesture callbacks ──
aura.onNod(() => {
  console.log('Nod detected')
  aura.show('Nod!', 'en')
})

aura.onShake(() => {
  console.log('Shake detected')
  // Cycle modes on shake
  const modes: Array<'flydubai' | 'aljamri' | 'personal'> = ['flydubai', 'aljamri', 'personal']
  const current = modes.indexOf(aura.currentMode as any)
  const next = modes[(current + 1) % modes.length]
  aura.show(`Mode: ${next}`, 'en')
})

// ── Update companion UI ──
const appEl = document.getElementById('app')
if (appEl) {
  appEl.innerHTML = `
    <div>
      <h2>Aura SDK Demo</h2>
      <p>Glasses display: "Hello from Aura" (EN) → "مرحبا من أورا" (AR)</p>
      <p>Mode: <strong id="mode">${aura.currentMode}</strong></p>
      <p style="font-size:12px;opacity:0.5">Nod / Shake for gestures</p>
      <p style="font-size:12px;opacity:0.5">Double-tap to exit</p>
    </div>
  `
}
