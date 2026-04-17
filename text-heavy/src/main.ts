import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { paginate } from './paginate'
import { SAMPLE_TEXT } from './sample'

const PAGE_CHAR_BUDGET = 450

const pages = paginate(SAMPLE_TEXT, PAGE_CHAR_BUDGET)
let currentPage = 0

const bridge = await waitForEvenAppBridge()

const body = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 240,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'body',
  content: pages[0] ?? '(empty)',
  isEventCapture: 1,
})

const pager = new TextContainerProperty({
  xPosition: 0,
  yPosition: 250,
  width: 576,
  height: 30,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 2,
  containerName: 'pager',
  content: pagerLabel(),
  isEventCapture: 0,
})

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [body, pager] }),
)
if (created !== 0) console.error('createStartUpPageContainer failed:', created)

function pagerLabel() {
  return `${currentPage + 1} / ${pages.length}  ·  tap: next  ·  swipe up: prev  ·  double-tap: exit`
}

// Serialize bridge writes so a fast-tapping user can't queue overlapping upgrades.
let rendering: Promise<unknown> = Promise.resolve()
async function showPage(index: number) {
  if (index < 0 || index >= pages.length || index === currentPage) return
  currentPage = index
  rendering = rendering.then(async () => {
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'body',
        content: pages[index],
      }),
    )
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 2,
        containerName: 'pager',
        content: pagerLabel(),
      }),
    )
  })
  await rendering
  mirrorCompanion()
}

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
    showPage(currentPage + 1).catch(err => console.error(err))
    return
  }
  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    showPage(currentPage - 1).catch(err => console.error(err))
    return
  }
  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    showPage(currentPage + 1).catch(err => console.error(err))
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
  <main style="margin:auto;padding:24px;max-width:680px;box-sizing:border-box;">
    <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h1 style="font-size:18px;font-weight:600;margin:0;">Text-Heavy Reader</h1>
      <span id="pageCount" style="font-size:12px;color:#919191;"></span>
    </header>
    <pre id="mirror" style="background:#2E2E2E;border:1px solid #3E3E3E;border-radius:12px;padding:20px;font-size:15px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:#E5E5E5;margin:0;"></pre>
    <footer style="font-size:12px;color:#7B7B7B;text-align:center;margin-top:16px;">
      Tap glasses: next page · swipe up: previous · double-tap: exit
    </footer>
  </main>
`

function mirrorCompanion() {
  const mirror = document.getElementById('mirror')
  const count = document.getElementById('pageCount')
  if (mirror) mirror.textContent = pages[currentPage] ?? ''
  if (count) count.textContent = `${currentPage + 1} / ${pages.length}`
}

mirrorCompanion()
