// إدارة المتصفح وجلسات الدخول (سياق مستقل لكل خط، يُعاد استخدامه).
import { chromium } from "playwright"
import { config } from "./config.js"

let browserPromise = null

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = config.browserWsEndpoint
      ? chromium.connectOverCDP(config.browserWsEndpoint) // متصفح مُستضاف (Browserbase/Browserless)
      : chromium.launch({ headless: config.headless })    // متصفح محلي على الخدمة
  }
  return browserPromise
}

// جلسات مفتوحة لكل خط: key = code → { context, loggedInAt }
const sessions = new Map()

/**
 * يرجّع صفحة (page) داخل سياق مسجّل الدخول للخط المحدّد.
 * يعيد استخدام الجلسة إن كانت حديثة، وإلا يعيد تسجيل الدخول.
 * @param {{name,iata,login,password,code}} carrier
 * @param {(page, carrier) => Promise<void>} loginFn
 */
export async function getLoggedInPage(carrier, loginFn) {
  const key = carrier.code
  const existing = sessions.get(key)
  const fresh = existing && Date.now() - existing.loggedInAt < config.sessionTtlMs

  if (fresh) {
    const page = await existing.context.newPage()
    return { page, reused: true }
  }

  // أغلق الجلسة القديمة إن وُجدت
  if (existing) {
    await existing.context.close().catch(() => {})
    sessions.delete(key)
  }

  const browser = await getBrowser()
  const context = await browser.newContext({ locale: "ar" })
  const page = await context.newPage()
  await loginFn(page, carrier)
  sessions.set(key, { context, loggedInAt: Date.now() })
  return { page, reused: false }
}

// يُبطل جلسة خط (مثلاً عند فشل التحقق من الدخول) لإجبار إعادة الدخول لاحقاً.
export async function invalidateSession(code) {
  const s = sessions.get(code)
  if (s) {
    await s.context.close().catch(() => {})
    sessions.delete(code)
  }
}

export async function shutdownBrowser() {
  for (const [, s] of sessions) await s.context.close().catch(() => {})
  sessions.clear()
  if (browserPromise) {
    const b = await browserPromise
    await b.close().catch(() => {})
    browserPromise = null
  }
}
