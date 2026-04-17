import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { startSttStream } from './asr/stt'
import { mountUi, setStatus, setTranscript } from './ui'

mountUi()

const API_KEY = import.meta.env.VITE_STT_API_KEY as string
if (!API_KEY) {
  setStatus('error', 'VITE_STT_API_KEY not set — copy .env.example to .env.local')
  console.warn('VITE_STT_API_KEY is not set.')
}

const bridge = await waitForEvenAppBridge()

const transcript = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'transcript',
  content: 'Listening…',
  isEventCapture: 1,
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [transcript] }),
)
if (created !== 0) {
  setStatus('error', `createStartUpPageContainer failed: ${created}`)
  console.error('Failed to create startup page')
}

let lastRender = ''
let renderTimer: number | null = null
let currentContent = 'Listening…'

function scheduleGlassesRender() {
  if (renderTimer !== null) return
  renderTimer = window.setTimeout(async () => {
    renderTimer = null
    if (currentContent === lastRender) return
    lastRender = currentContent
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'transcript',
        content: currentContent,
      }),
    )
  }, 120) // debounce display writes — BLE render queue is slow
}

// The default stt.ts is a blank stub that throws. Catch the throw so the UI
// surfaces the "configure stt.ts" error chip instead of hanging on "Connecting…".
let stt: ReturnType<typeof startSttStream> | null = null
try {
  stt = startSttStream(
    API_KEY,
    ({ finalText, interimText }) => {
      const combined = (finalText + interimText).trim()
      // 240 chars is a rough fit for the 576x288 text container at default font.
      currentContent = combined ? combined.slice(-240) : 'Listening…'
      setTranscript(finalText, interimText)
      scheduleGlassesRender()
    },
    err => {
      setStatus('error', `STT error: ${(err as Error)?.message ?? err}`)
      console.error('STT error:', err)
    },
  )
} catch (err) {
  setStatus('error', (err as Error)?.message ?? 'STT startup failed')
  console.error('STT startup failed:', err)
}

if (stt) {
  await bridge.audioControl(true)
  setStatus('listening', 'Microphone live · double-tap the temple to exit')
}

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  bridge.audioControl(false)
  stt?.close()
  unsubscribe()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const pcm = event.audioEvent?.audioPcm
  if (pcm) stt?.sendPcm(pcm)

  const sys = event.sysEvent
  if (!sys) return
  const eventType = OsEventTypeList.fromJson(sys.eventType)
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    // Show the system exit confirmation dialog. The user can still cancel;
    // if they confirm, SYSTEM_EXIT_EVENT fires and we clean up there.
    bridge.shutDownPageContainer(1)
    return
  }
  if (
    eventType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
    eventType === OsEventTypeList.ABNORMAL_EXIT_EVENT
  ) {
    cleanup()
  }
})

window.addEventListener('beforeunload', cleanup)
