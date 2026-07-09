// ─────────────────────────────────────────────────────────────
// منطق أتمتة بوابة TTI: تسجيل الدخول، البحث، وكشط النتائج لكل خط.
//
// ⚠️ الخطوات أدناه هيكلية ومبنية على محدّدات مبدئية في config.js.
//    بعد فحص البوابة الحقيقية (صور/HTML) نضبط الخطوات والمحدّدات.
//    كل مكان يحتاج مراجعة موسوم بـ TODO.
// ─────────────────────────────────────────────────────────────
import { config, SELECTORS } from "./config.js"
import { getLoggedInPage, invalidateSession } from "./browser.js"
import { normalizeRow } from "./normalize.js"

// تسجيل الدخول لخط معيّن (login + password + code).
async function login(page, carrier) {
  await page.goto(config.portalUrl, { waitUntil: "domcontentloaded" })
  await page.fill(SELECTORS.login.username, carrier.login)
  await page.fill(SELECTORS.login.password, carrier.password)
  if (carrier.code && SELECTORS.login.code) {
    // بعض البوابات تختار الخط عبر حقل كود، وبعضها عبر قائمة منسدلة — نضبطها لاحقاً. TODO
    await page.fill(SELECTORS.login.code, carrier.code).catch(() => {})
  }
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.click(SELECTORS.login.submit),
  ])
  // تأكيد نجاح الدخول
  await page.waitForSelector(SELECTORS.login.loggedInMarker, { timeout: 15000 })
}

// تعبئة نموذج البحث وتنفيذه.
async function runSearch(page, { origin, destination, departureDate, adults }) {
  await page.fill(SELECTORS.search.origin, origin)
  await page.fill(SELECTORS.search.destination, destination)
  await page.fill(SELECTORS.search.date, departureDate) // TODO: قد تحتاج تنسيق DD/MM/YYYY
  if (SELECTORS.search.adults) {
    await page.fill(SELECTORS.search.adults, String(adults)).catch(() => {})
  }
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click(SELECTORS.search.submit),
  ])
}

// كشط صفوف النتائج من الصفحة.
async function scrape(page, dateStr) {
  // لا نتائج؟
  const empty = await page.$(SELECTORS.results.empty)
  if (empty) return []

  await page.waitForSelector(SELECTORS.results.row, { timeout: 15000 }).catch(() => {})

  const S = SELECTORS.results
  const rows = await page.$$eval(
    S.row,
    (els, sel) => {
      const text = (el, q) => (q && el.querySelector(q)?.textContent?.trim()) || ""
      return els.map((el) => ({
        airlineIata: text(el, sel.airline),
        flightNo: text(el, sel.flightNo),
        depTime: text(el, sel.depTime),
        depCode: text(el, sel.depCode),
        arrTime: text(el, sel.arrTime),
        arrCode: text(el, sel.arrCode),
        price: text(el, sel.price),
      }))
    },
    S,
  )
  return rows.map((r) => ({ ...r, dateStr }))
}

// البحث عبر خط واحد → مصفوفة رحلات مطبّعة. يبتلع الأخطاء ويرجّع [] مع تسجيلها.
export async function searchCarrier(carrier, params) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    await runSearch(page, params)
    const rawRows = await scrape(page, params.departureDate)
    return {
      carrier: carrier.name,
      flights: rawRows
        .filter((r) => r.depCode && r.arrCode)
        .map((r) => normalizeRow({ ...r, airlineIata: r.airlineIata || carrier.iata }, carrier)),
      error: null,
    }
  } catch (err) {
    // جلسة قد تكون انتهت — أبطلها ليعاد الدخول في الطلب القادم.
    await invalidateSession(carrier.code)
    return { carrier: carrier.name, flights: [], error: err?.message || String(err) }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}
