type Status = 'connecting' | 'listening' | 'error'

let statusEl: HTMLDivElement
let finalEl: HTMLSpanElement
let interimEl: HTMLSpanElement

export function mountUi() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <main class="panel">
      <header>
        <h1>ASR Demo</h1>
        <div id="status" class="status status-connecting">Connecting…</div>
      </header>
      <section class="transcript" aria-live="polite">
        <span id="final"></span><span id="interim" class="interim"></span>
      </section>
      <footer>Double-tap the glasses temple to exit.</footer>
    </main>
  `
  statusEl = app.querySelector<HTMLDivElement>('#status')!
  finalEl = app.querySelector<HTMLSpanElement>('#final')!
  interimEl = app.querySelector<HTMLSpanElement>('#interim')!
  injectStyles()
}

export function setStatus(kind: Status, text: string) {
  if (!statusEl) return
  statusEl.className = `status status-${kind}`
  statusEl.textContent = text
}

export function setTranscript(finalText: string, interimText: string) {
  if (!finalEl) return
  finalEl.textContent = finalText
  interimEl.textContent = interimText
}

function injectStyles() {
  const css = `
    :root { color-scheme: dark; }
    html, body { margin: 0; height: 100%; background: #0a0a0a; color: #e6e6e6;
      font: 16px/1.4 -apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif;
      touch-action: manipulation; -webkit-text-size-adjust: 100%;
      overscroll-behavior: none; }
    #app { display: flex; height: 100%; }
    .panel { display: flex; flex-direction: column; gap: 16px;
      width: 100%; max-width: 640px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
    header { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 18px; font-weight: 600; margin: 0; letter-spacing: 0.02em; }
    .status { font-size: 12px; padding: 4px 10px; border-radius: 999px;
      border: 1px solid transparent; letter-spacing: 0.04em; text-transform: uppercase; }
    .status-connecting { color: #a0a0a0; border-color: #333; }
    .status-listening  { color: #3cfa44; border-color: #1f6b24; background: rgba(60,250,68,0.06); }
    .status-error      { color: #ff6b6b; border-color: #5a1f1f; background: rgba(255,107,107,0.06); }
    .transcript { flex: 1; overflow: auto; background: #141414; border: 1px solid #262626;
      border-radius: 12px; padding: 20px; font-size: 18px; line-height: 1.5;
      min-height: 180px; white-space: pre-wrap; word-break: break-word; }
    .interim { color: #8a8a8a; }
    footer { font-size: 12px; color: #707070; text-align: center; }
  `
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
}
