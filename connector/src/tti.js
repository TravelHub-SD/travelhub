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

// يقرأ مطارات النظام لخط معيّن من قوائم محرّك الحجز (المغادرة + الوجهة).
// يُرجّع خريطة { CODE: label }.
export async function listCarrierAirports(carrier) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    const frame = await getBookingFrame(page)
    await frame
      .waitForFunction(() => document.querySelector(".dropdown-menu a strong") != null, { timeout: 15000 })
      .catch(() => {})
    return await frame.evaluate(() => {
      const out = {}
      const menus = document.querySelectorAll(".dropdown-menu")
      ;[0, 1].forEach((i) => {
        const menu = menus[i]
        if (!menu) return
        menu.querySelectorAll("a").forEach((a) => {
          const code = a.querySelector("strong")?.textContent?.trim()
          if (code && /^[A-Z]{3}$/.test(code)) {
            out[code] = (a.textContent || "").replace(code, "").trim()
          }
        })
      })
      return out
    })
  } catch {
    return {}
  } finally {
    if (page) await page.close().catch(() => {})
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
