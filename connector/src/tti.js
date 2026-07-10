// ─────────────────────────────────────────────────────────────
// منطق أتمتة بوابة Zenith (TTI): تسجيل الدخول، البحث، وكشط النتائج.
//
// محدّدات البحث مؤكّدة من HTML الحقيقي. محدّدات الدخول والنتائج
// ما تزال تحتاج تأكيداً (HTML صفحة الدخول + صفحة SearchResult.aspx)
// وموسومة بـ TODO.
// ─────────────────────────────────────────────────────────────
import { config, SELECTORS } from "./config.js"
import { getLoggedInPage, invalidateSession } from "./browser.js"
import { flightsFromServerModel } from "./normalize.js"

// "2026-08-01" → { d, m, y }
function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return { d, m, y }
}

// تسجيل الدخول لخط معيّن (login + password + code شركة). ✅ محدّدات مؤكّدة.
async function login(page, carrier) {
  const L = SELECTORS.login
  const loginUrl = new URL(L.loginPath, config.portalUrl).toString()
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" })

  await page.fill(L.username, carrier.login)
  await page.fill(L.password, carrier.password)
  await page.fill(L.code, carrier.code) // كود الشركة (3TAIR / BADR / SUDANAIR)

  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.click(L.submit),
  ])
  await page.waitForSelector(L.loggedInMarker, { timeout: 20000 })
}

// اختيار مطار في قائمة منسدلة عبر كود IATA (السمة airportCode على الـ option).
async function selectAirport(page, selectSel, iata) {
  const value = await page.$eval(
    selectSel,
    (sel, code) => {
      const opt = [...sel.options].find(
        (o) => (o.getAttribute("airportCode") || "").toUpperCase() === code,
      )
      return opt ? opt.value : null
    },
    iata,
  )
  if (!value) throw new Error(`المطار ${iata} غير متاح في ${selectSel}`)
  await page.selectOption(selectSel, value)
}

// تعبئة نموذج البحث وتنفيذه (رحلة ذهاب فقط).
async function runSearch(page, { origin, destination, departureDate, adults }) {
  const S = SELECTORS.search
  // افتح لوحة "Book a flight"
  await page.click(S.openPanel).catch(() => {})
  // انتظر تعبئة قائمة المطارات عبر JS
  await page.waitForFunction(
    (sel) => document.querySelectorAll(`${sel} option`).length > 1,
    S.origin,
    { timeout: 15000 },
  )

  await selectAirport(page, S.origin, origin)
  // تغيير المغادرة يعيد ملء الوجهة — ننتظر ثم نختار
  await page.waitForTimeout(300)
  await selectAirport(page, S.destination, destination)

  // نوع الرحلة: ذهاب فقط
  await page.check(S.tripTypeOneWay).catch(() => {})

  // التاريخ عبر datepicker + النص
  const { d, m, y } = parseDate(departureDate)
  await page.evaluate(
    ({ sel, d, m, y }) => {
      const el = document.querySelector(sel)
      const val = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
      const $ = window.jQuery
      try {
        if ($ && $(el).datepicker) $(el).datepicker("setDate", new Date(y, m - 1, d))
      } catch {}
      if (el) el.value = val
    },
    { sel: S.date, d, m, y },
  )

  // عدد البالغين (أول حقل ركّاب)
  await page.locator(S.adultsInput).first().fill(String(adults))

  // إرسال — النتائج تظهر في iframe#mainFrame
  const wait = page
    .waitForResponse((r) => /SearchResult\.aspx/i.test(r.url()), { timeout: 30000 })
    .catch(() => null)
  await page.click(S.submit)
  await wait
  await page.waitForTimeout(1500) // مهلة لعرض النتائج داخل الـ iframe
}

// قراءة نتائج البحث من كائن Knockout المضمّن في صفحة النتائج
// (TTIModel.FlightListDisplay.ServerModel) بدل كشط DOM — أدقّ وأثبت.
async function readResults(page, carrier) {
  const frame = page.frame({ name: "mainFrame" })
  if (!frame) return []

  // انتظر تحميل صفحة FlightListDisplay وتعريف الكائن
  await frame
    .waitForFunction(
      () => window.TTIModel?.FlightListDisplay?.ServerModel != null,
      { timeout: 25000 },
    )
    .catch(() => null)

  const model = await frame
    .evaluate(() => {
      try {
        return window.TTIModel?.FlightListDisplay?.ServerModel ?? null
      } catch {
        return null
      }
    })
    .catch(() => null)

  if (!model) return []
  return flightsFromServerModel(model, carrier)
}

// تشخيص: يسجّل الدخول، يفتح البحث، ويرجّع حقائق عن الصفحة (+ صورة اختيارية)
// لمعرفة سبب فشل ظهور نموذج البحث. يُزال بعد الضبط.
export async function debugCarrier(carrier, { screenshot = false } = {}) {
  const { page } = await getLoggedInPage(carrier, login)
  try {
    const afterLoginUrl = page.url()
    await page.click(SELECTORS.search.openPanel).catch(() => {})
    await page.waitForTimeout(6000) // امنح mainFrame وقتاً لتحميل محرّك الحجز
    const frame = page.frame({ name: "mainFrame" })
    const facts = {
      afterLoginUrl,
      mainFrameUrl: frame ? frame.url() : null,
      dockOriginOptions: await page.$$eval("#id_depart option", (o) => o.length).catch(() => -1),
      hasDockFrmbook: (await page.$('form[name="frmbook"]')) ? true : false,
      mainFrameSelects: frame ? await frame.$$eval("select", (s) => s.length).catch(() => -1) : null,
      mainFrameForms: frame
        ? await frame.$$eval("form", (fs) => fs.map((f) => f.getAttribute("action") || f.name || "?")).catch(() => null)
        : null,
      mainFrameHtmlLen: frame ? (await frame.content().catch(() => "")).length : 0,
    }
    if (screenshot) {
      const buf = await page.screenshot({ fullPage: false })
      return { facts, screenshot: buf }
    }
    return { facts }
  } finally {
    await page.close().catch(() => {})
  }
}

// البحث عبر خط واحد → مصفوفة رحلات مطبّعة. يبتلع الأخطاء ويرجّع [] مع تسجيلها.
export async function searchCarrier(carrier, params) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    await runSearch(page, params)
    const flights = await readResults(page, carrier)
    return { carrier: carrier.name, flights, error: null }
  } catch (err) {
    await invalidateSession(carrier.code) // جلسة قد تكون انتهت — أعِد الدخول لاحقاً
    return { carrier: carrier.name, flights: [], error: err?.message || String(err) }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}
