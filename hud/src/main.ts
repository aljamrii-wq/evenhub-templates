/**
 * Aura HUD — always-on heads-up display for Even Realities G2.
 *
 * Shows time, date, mode, Hermes status, and a time-of-day greeting.
 * Renders natively for English; Arabic goes through aura-engine for
 * proper RTL shaping via the @aljamri/aura-sdk ArabicRenderer.
 *
 * Double-tap to exit. Tap the touchpad to force a refresh.
 */

import {
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  ImageRawDataUpdate,
  ImageContainerProperty,
  TextContainerProperty,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { ArabicRenderer, ModeDetector, DISPLAY_WIDTH, DISPLAY_HEIGHT } from '@aljamri/aura-sdk'
import { waitForEvenAppBridge } from './bridge'

// ── Layout constants ────────────────────────────────────────────

const DISPLAY_W = DISPLAY_WIDTH   // 576
const DISPLAY_H = DISPLAY_HEIGHT  // 288

const TOP_H = 28    // status bar
const MAIN_H = 220  // greeting + date
const HINT_H = 28   // bottom hint

const CID_TOP = 1
const CID_MAIN = 2
const CID_HINT = 3
const CID_ARABIC = 4

// ── Language support ─────────────────────────────────────────────

type HUDLang = 'en' | 'ar'

const searchParams = new URLSearchParams(location.search)
const initialLang: HUDLang = (searchParams.get('lang') as HUDLang) || 'en'

// ── Time-of-day greeting dictionaries ────────────────────────────

const GREETINGS: Record<HUDLang, Record<string, string>> = {
  en: { morning: 'Good Morning', afternoon: 'Good Afternoon', evening: 'Good Evening', night: 'Good Night' },
  ar: { morning: 'صباح الخير', afternoon: 'طاب مساؤك', evening: 'مساء الخير', night: 'تصبح على خير' },
}

const DAY_NAMES: Record<HUDLang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
}

const MONTH_NAMES: Record<HUDLang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
       'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
}

// ── Helpers ──────────────────────────────────────────────────────

function greeting(lang: HUDLang): string {
  const hour = new Date().getHours()
  const key = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night'
  return GREETINGS[lang][key]
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function arabicNumerals(n: number): string {
  const map: Record<string, string> = {
    '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
    '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
  }
  return n.toString().split('').map(c => map[c] || c).join('')
}

function formatTime(date: Date): string {
  const h = date.getHours()
  const hour12 = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${hour12}:${pad(date.getMinutes())} ${ampm}`
}

function formatArabicTime(date: Date): string {
  const h = date.getHours()
  const hour12 = h % 12 || 12
  const ampm = h < 12 ? 'ص' : 'م'
  return `${arabicNumerals(hour12)}:${arabicNumerals(date.getMinutes())} ${ampm}`
}

function formatDate(date: Date, lang: HUDLang): string {
  const day = DAY_NAMES[lang][date.getDay()]
  const month = MONTH_NAMES[lang][date.getMonth()]
  if (lang === 'ar') {
    return `${day}، ${arabicNumerals(date.getDate())} ${month}`
  }
  return `${day}, ${month} ${date.getDate()}`
}

function modeLabel(mode: string, lang: HUDLang): string {
  if (lang === 'ar') {
    const arabicModes: Record<string, string> = {
      flydubai: 'فلاي دبي',
      aljamri: 'الجمري',
      personal: 'شخصي',
      auto: 'تلقائي',
    }
    return arabicModes[mode] || mode
  }
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

// ── State ────────────────────────────────────────────────────────

let currentLang: HUDLang = initialLang
let cleanedUp = false

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const bridge = await waitForEvenAppBridge()

  // Create renderer and mode detector
  const renderUrl = 'https://hermes.aljamrigroup.com/render'
  const arabic = new ArabicRenderer(currentLang, renderUrl)
  const modes = new ModeDetector()

  // Start mode detection
  try {
    const info = await bridge.getDeviceInfo()
    modes.start(
      info ? { wearing: info.status?.isWearing, battery: info.status?.batteryLevel } : {},
      new Date(),
    )
  } catch {
    modes.start({}, new Date())
  }

  // ── Create containers ────────────────────────────────────────

  if (currentLang === 'ar') {
    // Arabic: single full-screen image container
    const imgContainer = new ImageContainerProperty({
      containerID: CID_ARABIC,
      containerName: 'hud-arabic',
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_W,
      height: DISPLAY_H,
    })

    const startup = new CreateStartUpPageContainer({
      containerTotalNum: 1,
      imageObject: [imgContainer],
      textObject: [],
    })
    const result = await bridge.createStartUpPageContainer(startup)
    if (result !== 0) {
      throw new Error(`createStartUpPageContainer failed: ${result}`)
    }
  } else {
    // English: three text containers

    const topBar = new TextContainerProperty({
      containerID: CID_TOP,
      containerName: 'hud-top',
      xPosition: 0,
      yPosition: 2,
      width: DISPLAY_W,
      height: TOP_H,
      paddingLength: 4,
      borderWidth: 0,
      isEventCapture: 0,
    })

    const mainZone = new TextContainerProperty({
      containerID: CID_MAIN,
      containerName: 'hud-main',
      xPosition: 0,
      yPosition: 34,
      width: DISPLAY_W,
      height: MAIN_H,
      paddingLength: 16,
      borderWidth: 0,
      isEventCapture: 0,
    })

    const hintBar = new TextContainerProperty({
      containerID: CID_HINT,
      containerName: 'hud-hint',
      xPosition: 0,
      yPosition: DISPLAY_H - HINT_H - 2,
      width: DISPLAY_W,
      height: HINT_H,
      paddingLength: 4,
      borderWidth: 0,
      isEventCapture: 0,
    })

    const startup = new CreateStartUpPageContainer({
      containerTotalNum: 3,
      textObject: [topBar, mainZone, hintBar],
      imageObject: [],
    })
    const result = await bridge.createStartUpPageContainer(startup)
    if (result !== 0) {
      throw new Error(`createStartUpPageContainer failed: ${result}`)
    }
  }

  // ── Render pipeline ──────────────────────────────────────────

  let rendering: Promise<unknown> = Promise.resolve()

  async function renderHUD() {
    const now = new Date()
    const lang = currentLang
    const mode = modes.current

    if (lang === 'ar') {
      // Compose Arabic HUD as multi-line text, render as one image
      const hudText = [
        `✦ ${modeLabel(mode, 'ar')} ✦   ${formatArabicTime(now)}`,
        '',
        greeting('ar'),
        formatDate(now, 'ar'),
        '',
        'اضغط للتحديث · اضغط مرتين للخروج',
      ].join('\n')

      rendering = rendering.then(async () => {
        const pixels = await arabic.render(hudText, 24, 'ar')
        const update = new ImageRawDataUpdate({
          containerID: CID_ARABIC,
          containerName: 'hud-arabic',
          imageData: Array.from(pixels),
        })
        await bridge.updateImageRawData(update)
      })
    } else {
      // English: upgrade each text container
      const topContent = `${modeLabel(mode, 'en')} ● Hermes   ${formatTime(now)}`
      const mainContent = `${greeting('en')}\n${formatDate(now, 'en')}`
      const hintContent = 'tap · double-tap: exit'

      rendering = rendering.then(async () => {
        await bridge.textContainerUpgrade(
          new TextContainerUpgrade({ containerID: CID_TOP, containerName: 'hud-top', content: topContent }),
        )
        await bridge.textContainerUpgrade(
          new TextContainerUpgrade({ containerID: CID_MAIN, containerName: 'hud-main', content: mainContent }),
        )
        await bridge.textContainerUpgrade(
          new TextContainerUpgrade({ containerID: CID_HINT, containerName: 'hud-hint', content: hintContent }),
        )
      })
    }

    await rendering
    mirrorCompanion(now, lang, mode)
  }

  // ── Companion mirror ─────────────────────────────────────────

  function mirrorCompanion(now: Date, lang: HUDLang, mode: string) {
    const clock = document.getElementById('mirror-clock')
    const date = document.getElementById('mirror-date')
    const greetingEl = document.getElementById('mirror-greeting')
    const modeEl = document.getElementById('mirror-mode')
    const status = document.getElementById('mirror-status')

    if (clock) clock.textContent = formatTime(now)
    if (date) { date.textContent = formatDate(now, lang); date.dir = lang === 'ar' ? 'rtl' : 'ltr' }
    if (greetingEl) { greetingEl.textContent = greeting(lang); greetingEl.dir = lang === 'ar' ? 'rtl' : 'ltr' }
    if (modeEl) modeEl.textContent = modeLabel(mode, 'en')
    if (status) status.className = 'status-dot online'
  }

  // ── Event handling ───────────────────────────────────────────

  bridge.onEvenHubEvent((event: any) => {
    // Protobuf omits zero-value fields: CLICK_EVENT (0) arrives as undefined.
    // Always coalesce with ?? 0 before comparing.
    const sysType: number = event.sysEvent?.eventType ?? 0
    const textType: number = event.textEvent?.eventType ?? 0

    // Double-tap exits from any event envelope
    if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      cleanup()
      bridge.shutDownPageContainer(1)
      return
    }

    // Single tap: refresh display
    if (event.sysEvent && sysType === OsEventTypeList.CLICK_EVENT) {
      renderHUD().catch(err => console.error('HUD render error:', err))
      return
    }

    // System lifecycle
    if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      cleanup()
    }
  })

  window.addEventListener('beforeunload', cleanup)

  // ── Clock tick ───────────────────────────────────────────────

  // Update every 30s — BLE link is slow; faster updates hurt battery.
  const clockTick = setInterval(() => {
    renderHUD().catch(err => console.error('HUD clock tick error:', err))
  }, 30_000)

  function cleanup() {
    if (cleanedUp) return
    cleanedUp = true
    clearInterval(clockTick)
    modes.stop()
  }

  // ── Initial render ───────────────────────────────────────────

  await renderHUD()
  mirrorCompanion(new Date(), currentLang, modes.current)
}

main().catch((err) => {
  console.error('Aura HUD failed to start:', err)
  const app = document.querySelector<HTMLDivElement>('#app')
  if (app) {
    app.innerHTML = `<main style="margin:auto;padding:24px;max-width:640px;text-align:center;">
      <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Aura HUD</h1>
      <p style="color:#F87171;font-size:14px;margin:0;">Failed to start: ${err instanceof Error ? err.message : String(err)}</p>
    </main>`
  }
})
