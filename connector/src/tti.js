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

// أداة فحص مؤقتة (v2): تقرأ هوية كل الحقول، نافذة التقويم المفتوحة فعلياً،
// ونداءات الشبكة التي تجلب الأيام المتاحة — لربط الركاب والأيام الخضراء.
export async function inspectBooking(carrier) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page

    // التقط نداءات الشبكة المرتبطة بالتقويم/الإتاحة
    const netCalls = []
    page.on("response", async (r) => {
      try {
        const url = r.url()
        if (/avail|calendar|dates|month|schedule/i.test(url) && !/\.(png|jpg|gif|css|woff|ico)/i.test(url)) {
          let body = null
          try {
            body = (await r.text()).slice(0, 2000)
          } catch {}
          netCalls.push({ url: url.slice(0, 300), status: r.status(), body })
        }
      } catch {}
    })

    const frame = await getBookingFrame(page)
    await frame.waitForTimeout(800)

    // هوية كل حقل + النص المحيط به (لمعرفة حقول الركاب المجهولة)
    const form = await frame.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input, select")).map((el) => ({
        tag: el.tagName,
        id: el.id || null,
        name: el.getAttribute("name") || null,
        cls: (el.className || "").toString().slice(0, 60) || null,
        type: el.getAttribute("type") || null,
        ph: el.getAttribute("placeholder") || null,
        val: (el.value || "").toString().slice(0, 25) || null,
        ctx: (el.closest("div,td,li,label")?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70),
        options:
          el.tagName === "SELECT"
            ? Array.from(el.options)
                .map((o) => `${o.value}:${(o.textContent || "").trim()}`)
                .slice(0, 12)
            : undefined,
      }))
      const formEl = document.querySelector("form") || document.body
      return { inputs, formHtml: formEl.outerHTML.slice(0, 10000) }
    })

    // افتح التقويم والتقط الطبقات الظاهرة فعلاً (datepicker يُلحق غالباً بالـ body)
    await frame.click("#CalendarID0").catch(() => {})
    await frame.waitForTimeout(1500)
    const calendar = await frame.evaluate(() => {
      const layers = Array.from(document.querySelectorAll("body > div, body > table")).filter((el) => {
        const s = getComputedStyle(el)
        return (
          s.display !== "none" &&
          s.visibility !== "hidden" &&
          el.offsetHeight > 40 &&
          (s.position === "absolute" || s.position === "fixed")
        )
      })
      return layers.slice(0, 4).map((el) => ({
        cls: (el.className || "").toString().slice(0, 120),
        html: el.outerHTML.slice(0, 6000),
      }))
    })

    // انتقل شهراً للأمام لتحفيز نداء شبكة الإتاحة (لو موجود)
    await frame
      .click(".datepicker th.next, .datepicker .next, .ui-datepicker-next, [class*='next']")
      .catch(() => {})
    await page.waitForTimeout(2000)

    return { carrier: carrier.name, ...form, calendar, netCalls: netCalls.slice(0, 10) }
  } catch (e) {
    return { error: e?.message || String(e) }
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
