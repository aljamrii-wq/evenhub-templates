import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ImageContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { makeTestPattern } from './image/renderer'

const bridge = await waitForEvenAppBridge()

// Event-capture text container sits behind the image and catches taps.
// Image containers can't set `isEventCapture`, so input needs a text layer.
const eventLayer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 0,
  paddingLength: 0,
  containerID: 1,
  containerName: 'eventLayer',
  content: ' ',
  isEventCapture: 1,
})

const statusLine = new TextContainerProperty({
  xPosition: 0,
  yPosition: 220,
  width: 576,
  height: 40,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 2,
  containerName: 'status',
  content: 'Loading…',
  isEventCapture: 0,
})

const IMG_W = 200
const IMG_H = 100
const image = new ImageContainerProperty({
  xPosition: (576 - IMG_W) / 2,
  yPosition: 40,
  width: IMG_W,
  height: IMG_H,
  containerID: 3,
  containerName: 'frame',
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [eventLayer, statusLine],
    imageObject: [image],
  }),
)
if (created !== 0) {
  console.error('createStartUpPageContainer failed:', created)
}

async function setStatus(text: string) {
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 2,
      containerName: 'status',
      content: text,
    }),
  )
}

// updateImageRawData must be serial — one in flight at a time.
let rendering: Promise<unknown> = Promise.resolve()
async function pushFrame(bytes: Uint8Array) {
  rendering = rendering.then(async () => {
    const result = await bridge.updateImageRawData({
      containerID: 3,
      containerName: 'frame',
      imageData: bytes,
    })
    if (result !== 'success') {
      await setStatus(`Render: ${result}`)
      console.error('updateImageRawData:', result)
    }
  })
  await rendering
}

const pattern = makeTestPattern(IMG_W, IMG_H)
await pushFrame(pattern)
await setStatus('Tap to redraw · double-tap to exit')

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  unsubscribe()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const sys = event.sysEvent
  if (!sys) return
  const eventType = OsEventTypeList.fromJson(sys.eventType)
  if (eventType === OsEventTypeList.CLICK_EVENT) {
    pushFrame(makeTestPattern(IMG_W, IMG_H)).catch(err => console.error(err))
    return
  }
  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
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

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:640px;text-align:center;">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Image Demo</h1>
    <p style="color:#8a8a8a;font-size:14px;margin:0;">
      Check the glasses — a test-pattern bitmap should render. Tap the
      glasses to redraw, double-tap to exit. Swap
      <code>makeTestPattern</code> for <code>loadImageBytes</code> in
      <code>src/image/renderer.ts</code> to display real assets.
    </p>
  </main>
`
