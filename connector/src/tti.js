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

// يحصل على إطار محرّك الحجز (داخل mainFrame) بعد فتحه، وينتظر جاهزية النموذج.
// مهلة أطول + إعادة نقر، لأن التحميل قد يبطؤ عند تشغيل عدّة خطوط بالتوازي.
async function getBookingFrame(page) {
  const S = SELECTORS.search
  await page.waitForSelector(S.openPanel, { timeout: 20000 }).catch(() => {})
  await page.click(S.openPanel).catch(() => {}) // زر "Book a flight"
  for (let i = 0; i < 80; i++) {
    const frame = page.frame({ name: "mainFrame" })
    if (frame && (await frame.$("#CalendarID0").catch(() => null))) return frame
    if (i === 20 || i === 45) await page.click(S.openPanel).catch(() => {}) // أعد المحاولة
    await page.waitForTimeout(500)
  }
  throw new Error("لم يُحمّل نموذج البحث (محرّك الحجز)")
}

// يختار مطاراً في قائمة منسدلة (Knockout) عبر كود IATA.
// القائمتان الأولى/الثانية = المغادرة/الوجهة. ننقر العنصر الذي <strong> فيه = الكود.
async function selectBookingAirport(frame, menuIndex, iata) {
  // افتح القائمة (اختياري لكنه يساعد بعض الـ bindings)
  await frame.locator(".dropdown-toggle").nth(menuIndex).click().catch(() => {})
  await frame.waitForTimeout(300)
  const ok = await frame.evaluate(
    ({ menuIndex, iata }) => {
      const menu = document.querySelectorAll(".dropdown-menu")[menuIndex]
      if (!menu) return false
      const link = Array.from(menu.querySelectorAll("a")).find(
        (a) => a.querySelector("strong")?.textContent?.trim().toUpperCase() === iata.toUpperCase(),
      )
      if (link) {
        link.click()
        return true
      }
      return false
    },
    { menuIndex, iata },
  )
  if (!ok) throw new Error(`المطار ${iata} غير متاح في القائمة`)
}

// تعبئة نموذج محرّك الحجز وتنفيذه (رحلة ذهاب فقط).
async function runSearch(page, { origin, destination, departureDate }) {
  const frame = await getBookingFrame(page)

  // نوع الرحلة: ذهاب فقط (افتراضي غالباً، لكن نؤكّده)
  await frame.getByText("One way", { exact: true }).first().click().catch(() => {})

  // انتظر امتلاء قوائم المطارات
  await frame
    .waitForFunction(() => document.querySelector(".dropdown-menu a strong") != null, { timeout: 15000 })
    .catch(() => {})

  await selectBookingAirport(frame, 0, origin) // المغادرة
  await frame.waitForTimeout(600) // تُعاد تعبئة قائمة الوجهة حسب المغادرة
  await selectBookingAirport(frame, 1, destination) // الوجهة

  // التاريخ DD/MM/YYYY
  const { d, m, y } = parseDate(departureDate)
  const dateStr = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
  await frame.evaluate((val) => {
    const el = document.querySelector("#CalendarID0")
    if (el) {
      el.value = val
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("blur", { bubbles: true }))
    }
  }, dateStr)

  // إرسال البحث
  await frame
    .locator("button:has-text('Search flights'), a:has-text('Search flights'), :text('Search flights')")
    .first()
    .click()
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
    // افتح محرّك الحجز (Book a flight) وامنحه وقتاً للتحميل داخل mainFrame
    await page.click(SELECTORS.search.openPanel).catch(() => {})
    await page.waitForTimeout(8000)

    const frame = page.frame({ name: "mainFrame" })
    const dump = frame
      ? await frame
          .evaluate(() => {
            const q = (sel, root = document) => Array.from(root.querySelectorAll(sel))
            const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim()
            const toggles = q(".dropdown-toggle").map((t) => txt(t).slice(0, 25))
            const menus = q(".dropdown-menu").slice(0, 8).map((m) => ({
              n: m.querySelectorAll("li,a").length,
              items: q("li a, li", m).map((a) => txt(a)).filter(Boolean).slice(0, 5),
            }))
            const firstItem = document.querySelector(".dropdown-menu li a, .dropdown-menu a, .dropdown-menu li")
            return {
              url: location.href,
              title: document.title,
              toggles,
              menus,
              firstItemHtml: firstItem ? firstItem.outerHTML.slice(0, 400) : null,
              hasDateInput: !!document.querySelector("#CalendarID0"),
              hasSearchBtn: !!q("button, a, input").find((b) => /search flights/i.test(b.textContent || b.value || "")),
            }
          })
          .catch((e) => ({ error: String(e) }))
      : null

    const facts = {
      afterLoginUrl,
      dockOriginOptions: await page.$$eval("#id_depart option", (o) => o.length).catch(() => -1),
      mainFrameUrl: frame ? frame.url() : null,
      mainFrame: dump,
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
