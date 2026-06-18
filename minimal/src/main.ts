import { Aura } from '@aljamri/aura-sdk'

// Minimal template: drive the glasses through the Aura SDK rather than the raw
// Even Hub bridge. The SDK creates the page containers, wires double-tap exit,
// and handles language-aware rendering (English here; Arabic renders as an
// image via the engine).
async function main() {
  const aura = new Aura({
    lang: 'en',
    gestures: false,
    alwaysListen: false,
  })

  aura.onExit(() => {
    setStatus('Exited — close the app on the glasses.')
  })

  await aura.init()
  await aura.show('Hello from G2!\nDouble-tap to exit.', 'en')
  setStatus('Check the glasses — "Hello from G2!" should be visible.')
}

function setStatus(text: string) {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return
  app.innerHTML = `
    <main style="margin:auto;padding:24px;max-width:640px;text-align:center;">
      <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Minimal (Aura SDK)</h1>
      <p style="color:#919191;font-size:14px;margin:0;">${text}</p>
    </main>
  `
}

main().catch((err) => {
  console.error('Aura minimal failed to start:', err)
  setStatus(`Failed to start: ${err instanceof Error ? err.message : String(err)}`)
})
