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

// ─── ضبط أعداد الركاب في محرّك الحجز ─────────────────────────────────────────
// محرّك Zenith تطبيق Knockout، لذا نجرّب ثلاث طرق بالترتيب لكل فئة:
//   1) <select> أو <input> اسمه/معرّفه يدلّ على الفئة (adult/child/infant)
//   2) observable في نموذج Knockout (ko.dataFor) أو في window.TTIModel
// نرجّع تقريراً بما نجح ليُحوَّل ما فشل إلى تحذيرات في ردّ البحث.
async function setPaxCounts(frame, counts) {
  return await frame.evaluate((counts) => {
    const PATTERNS = {
      adults: /adult|adt|adulte/i,
      children: /child|chd|enfant/i,
      infants: /infant|\binf\b|bebe|b[eé]b[eé]|baby/i,
    }
    const fire = (el) =>
      ["input", "change", "blur"].forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })))

    // 1) عناصر DOM مباشرة
    const tryDom = (type, count) => {
      const re = PATTERNS[type]
      const ctrls = document.querySelectorAll('select, input[type="number"], input[type="text"], input:not([type])')
      for (const el of ctrls) {
        const idn = [el.id, el.name, el.getAttribute("data-bind"), el.getAttribute("aria-label"), el.className]
          .filter(Boolean)
          .join(" ")
        if (!re.test(idn)) continue
        if (/depart|arriv|date|airport|calendar/i.test(idn)) continue
        if (el.tagName === "SELECT") {
          const opt = Array.from(el.options).find(
            (o) => o.value === String(count) || o.textContent.trim() === String(count),
          )
          if (!opt) continue
          el.value = opt.value
          fire(el)
          return `select:${el.id || el.name}`
        }
        el.value = String(count)
        fire(el)
        return `input:${el.id || el.name || el.className}`
      }
      return null
    }

    // 2) observables في Knockout / TTIModel
    const isObservable = (v) => typeof v === "function" && typeof v.peek === "function"
    const tryKo = (type, count) => {
      const re = PATTERNS[type]
      const roots = []
      try {
        if (window.ko) {
          const anchor = document.querySelector("#CalendarID0") || document.body
          const vm = window.ko.dataFor(anchor) || window.ko.dataFor(document.body)
          if (vm) roots.push(vm)
        }
      } catch {}
      if (window.TTIModel) roots.push(window.TTIModel)

      const seen = new Set()
      const stack = roots.map((obj) => ({ obj, depth: 0 }))
      while (stack.length) {
        const { obj, depth } = stack.pop()
        if (!obj || typeof obj !== "object" || depth > 3 || seen.has(obj)) continue
        seen.add(obj)
        for (const k of Object.keys(obj)) {
          let v
          try {
            v = obj[k]
          } catch {
            continue
          }
          if (isObservable(v) && re.test(k)) {
            const cur = v.peek()
            if (typeof cur === "number" || /^\d+$/.test(String(cur))) {
              try {
                v(typeof cur === "number" ? count : String(count))
                return `ko:${k}`
              } catch {}
            }
          } else if (v && typeof v === "object" && !Array.isArray(v)) {
            stack.push({ obj: v, depth: depth + 1 })
          }
        }
      }
      return null
    }

    const report = {}
    for (const type of ["adults", "children", "infants"]) {
      const count = counts[type] || 0
      if (type !== "adults" && count === 0) {
        report[type] = "skip" // لا حاجة لتغيير صفر
        continue
      }
      report[type] = tryDom(type, count) || tryKo(type, count) || null
    }
    return report
  }, counts)
}

// تعبئة نموذج محرّك الحجز وتنفيذه (رحلة ذهاب فقط).
// يرجّع تحذيرات ضبط الركاب (إن فشل ضبط فئة ما نتابع البحث ونبلّغ).
async function runSearch(page, { origin, destination, departureDate, adults = 1, children = 0, infants = 0 }) {
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

  // أعداد الركاب
  const warnings = []
  const paxReport = await setPaxCounts(frame, { adults, children, infants }).catch(() => null)
  if (!paxReport) {
    warnings.push("تعذّر الوصول لخانات الركاب في محرّك الحجز")
  } else {
    if (adults > 1 && !paxReport.adults) warnings.push(`تعذّر ضبط عدد البالغين (${adults}) — بُحث بالإعداد الافتراضي`)
    if (children > 0 && !paxReport.children) warnings.push(`تعذّر ضبط عدد الأطفال (${children}) — لم يُشملوا في البحث`)
    if (infants > 0 && !paxReport.infants) warnings.push(`تعذّر ضبط عدد الرضّع (${infants}) — لم يُشملوا في البحث`)
  }

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

  return { warnings }
}

// قراءة نتائج البحث من كائن Knockout المضمّن في صفحة النتائج
// (TTIModel.FlightListDisplay.ServerModel) بدل كشط DOM — أدقّ وأثبت.
async function readResults(page, carrier, pax) {
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
  return flightsFromServerModel(model, carrier, pax)
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
    const { warnings } = await runSearch(page, params)
    const pax = { adults: params.adults || 1, children: params.children || 0, infants: params.infants || 0 }
    const flights = await readResults(page, carrier, pax)
    return { carrier: carrier.name, flights, error: null, warnings }
  } catch (err) {
    await invalidateSession(carrier.code) // جلسة قد تكون انتهت — أعِد الدخول لاحقاً
    return { carrier: carrier.name, flights: [], error: err?.message || String(err), warnings: [] }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

// ─── توفّر الرحلات (أيام التقويم الخضراء في محرّك الحجز) ─────────────────────
// محرّك الحجز يلوّن أيام الرحلات في تقويم #CalendarID0. نفتح التقويم بعد
// اختيار المطارين ونقرأ خلايا الأيام (أصنافها + لون خلفيتها المحسوب) لعدّة
// أشهر، ثم نستنتج الأيام المتاحة في decideAvailableDates.

// يفتح تقويم حقل التاريخ وينتظر ظهوره.
async function openCalendar(frame) {
  const isOpen = () =>
    frame.evaluate(() => {
      const cands = document.querySelectorAll(
        '#ui-datepicker-div, .ui-datepicker, .datepicker-days, .datepicker, [class*="datepicker"], [class*="calendar-panel"]',
      )
      return Array.from(cands).some((el) => el.offsetParent !== null && el.querySelector("td"))
    })

  await frame.click("#CalendarID0").catch(() => {})
  await frame.waitForTimeout(800)
  if (await isOpen().catch(() => false)) return true

  // بعض الودجات تفتح على focus لا click
  await frame.evaluate(() => {
    const el = document.querySelector("#CalendarID0")
    if (el) {
      el.focus()
      el.dispatchEvent(new Event("focus", { bubbles: true }))
    }
  }).catch(() => {})
  await frame.waitForTimeout(800)
  return await isOpen().catch(() => false)
}

// يقرأ الشهر المعروض حالياً في التقويم: عنوانه + خلاياه (يوم/شهر/سنة إن وُجدت
// كسمات data كما في jQuery UI، الأصناف، لون الخلفية المحسوب، ومعطَّل أم لا).
async function readCalendarMonth(frame) {
  return await frame.evaluate(() => {
    const cands = document.querySelectorAll(
      '#ui-datepicker-div, .ui-datepicker, .datepicker-days, .datepicker, [class*="datepicker"], [class*="calendar-panel"]',
    )
    const root = Array.from(cands).find((el) => el.offsetParent !== null && el.querySelector("td"))
    if (!root) return null

    const title =
      root.querySelector(".ui-datepicker-title, .datepicker-switch, [class*='title'], [class*='month-name']")
        ?.textContent?.trim() || null

    const cells = []
    for (const td of root.querySelectorAll("td")) {
      const txt = (td.textContent || "").trim()
      if (!/^\d{1,2}$/.test(txt)) continue
      const inner = td.querySelector("a, span, button")
      const bgInner = inner ? getComputedStyle(inner).backgroundColor : ""
      cells.push({
        day: Number(txt),
        month: td.dataset.month != null ? Number(td.dataset.month) : null, // jQuery UI: 0-based
        year: td.dataset.year != null ? Number(td.dataset.year) : null,
        cls: `${td.className} | ${inner ? inner.className : ""}`.trim(),
        bg: getComputedStyle(td).backgroundColor,
        bgInner,
        disabled:
          /(^|\s)(ui-datepicker-unselectable|ui-state-disabled|disabled)(\s|$)/.test(td.className) ||
          Boolean(inner && /(^|\s)(ui-state-disabled|disabled)(\s|$)/.test(inner.className)),
        otherMonth: /other|old|new-|ui-datepicker-other-month/.test(td.className),
      })
    }
    return { title, rootSel: root.id ? `#${root.id}` : root.className, cells }
  })
}

// ينقر زر "الشهر التالي" في التقويم. true إن وجد الزر.
async function nextCalendarMonth(frame) {
  const clicked = await frame.evaluate(() => {
    const cands = document.querySelectorAll(
      '#ui-datepicker-div, .ui-datepicker, .datepicker-days, .datepicker, [class*="datepicker"], [class*="calendar-panel"]',
    )
    const root = Array.from(cands).find((el) => el.offsetParent !== null && el.querySelector("td"))
    if (!root) return false
    const next = root.querySelector('.ui-datepicker-next, .next, [class*="next"]')
    if (!next) return false
    next.click()
    return true
  }).catch(() => false)
  if (clicked) await frame.waitForTimeout(500)
  return clicked
}

const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

// يحوّل بيانات شهر مقروء إلى قائمة أيام متاحة ISO (YYYY-MM-DD).
// الاستنتاج بالأولوية: خلايا خضراء اللون / صنف يدلّ على توفّر → متاحة؛
// وإلا فإن كانت بعض الأيام المستقبلية معطّلة → المفعَّلة هي المتاحة؛
// وإلا لا نستطيع التمييز (نرجّع null ليُسجَّل تحذير).
export function decideAvailableDates(monthData, fallbackYm) {
  if (!monthData?.cells?.length) return { dates: null, reason: "empty" }

  // سنة/شهر لكل خلية: سمات data أولاً، ثم عنوان الشهر، ثم الشهر المفترض
  let ym = null // { y, m0 }
  const t = (monthData.title || "").toLowerCase()
  const mIdx = EN_MONTHS.findIndex((m) => t.includes(m))
  const yMatch = t.match(/(20\d{2})/)
  if (mIdx >= 0 && yMatch) ym = { y: Number(yMatch[1]), m0: mIdx }
  else if (fallbackYm) ym = fallbackYm

  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const cellDate = (c) => {
    const y = c.year ?? ym?.y
    const m0 = c.month ?? ym?.m0
    if (y == null || m0 == null) return null
    return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`
  }

  const greenish = (bg) => {
    const m = String(bg || "").match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
    if (!m) return false
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
    return g > 90 && g > r + 15 && g > b + 15
  }
  const availClass = (cls) => /(avail|hasflight|flight-day|open-day|green)/i.test(cls || "")

  const cells = monthData.cells.filter((c) => !c.otherMonth)
  const withDates = cells.map((c) => ({ ...c, date: cellDate(c) })).filter((c) => c.date)

  const greens = withDates.filter((c) => greenish(c.bg) || greenish(c.bgInner) || availClass(c.cls))
  if (greens.length) return { dates: greens.map((c) => c.date), reason: "green" }

  const future = withDates.filter((c) => c.date >= todayIso)
  const enabled = future.filter((c) => !c.disabled)
  const disabled = future.filter((c) => c.disabled)
  // بعض الأيام المستقبلية معطَّل → التعطيل يعني "لا رحلات"، فالمفعّل متاح
  if (disabled.length > 0 && enabled.length > 0) return { dates: enabled.map((c) => c.date), reason: "enabled-subset" }

  return { dates: null, reason: "indistinguishable" }
}

// توفّر خط واحد: يرجّع { carrier, dates[], error, debug? }
export async function getCarrierAvailability(carrier, { origin, destination, months = 3, debug = false }) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    const frame = await getBookingFrame(page)

    await frame.getByText("One way", { exact: true }).first().click().catch(() => {})
    await frame
      .waitForFunction(() => document.querySelector(".dropdown-menu a strong") != null, { timeout: 15000 })
      .catch(() => {})
    await selectBookingAirport(frame, 0, origin)
    await frame.waitForTimeout(600)
    await selectBookingAirport(frame, 1, destination)
    await frame.waitForTimeout(1000) // مهلة ليجلب المحرّك جدول التوفّر للوجهة

    if (!(await openCalendar(frame))) {
      return { carrier: carrier.name, dates: [], error: "لم يظهر التقويم بعد اختيار المطارين", debug: null }
    }

    const dates = []
    const warnings = []
    const rawMonths = []
    const now = new Date()
    for (let i = 0; i < months; i++) {
      const monthData = await readCalendarMonth(frame).catch(() => null)
      if (debug) rawMonths.push(monthData)
      const fallback = { y: now.getFullYear() + Math.floor((now.getMonth() + i) / 12), m0: (now.getMonth() + i) % 12 }
      const { dates: monthDates, reason } = decideAvailableDates(monthData, fallback)
      if (monthDates) dates.push(...monthDates)
      else warnings.push(`الشهر ${i + 1}: تعذّر تمييز أيام الرحلات (${reason})`)
      if (i < months - 1 && !(await nextCalendarMonth(frame))) break
    }

    return {
      carrier: carrier.name,
      dates: [...new Set(dates)].sort(),
      error: warnings.length ? warnings.join(" | ") : null,
      debug: debug ? { months: rawMonths } : null,
    }
  } catch (err) {
    await invalidateSession(carrier.code)
    return { carrier: carrier.name, dates: [], error: err?.message || String(err), debug: null }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

// ─── تشخيص مؤقت (/probe): يفحص خانات الركاب وتقويم التوفّر على النظام الحقيقي ─
// يُزال بعد تأكيد المحدّدات. deep=1 ينفّذ بحثاً كاملاً ويرجّع عيّنة من
// PassengerTypes الخام للتحقق من دلالة الأسعار مع تعدّد الركاب.
export async function probeCarrier(carrier, { origin, destination, departureDate, adults = 2, children = 1, deep = false }) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    const frame = await getBookingFrame(page)
    await frame
      .waitForFunction(() => document.querySelector(".dropdown-menu a strong") != null, { timeout: 15000 })
      .catch(() => {})

    // 1) خانات الركاب: عناصر DOM تطابق أنماط الفئات + مفاتيح Knockout المرشّحة
    const paxProbe = await frame.evaluate(() => {
      const re = /adult|adt|adulte|child|chd|enfant|infant|\binf\b|bebe|baby|pax|passenger/i
      const domHits = []
      for (const el of document.querySelectorAll("select, input, [data-bind]")) {
        const idn = [el.id, el.name, el.getAttribute("data-bind"), el.className].filter(Boolean).join(" ")
        if (re.test(idn) && !/airport|depart|arriv|calendar/i.test(idn)) {
          domHits.push(el.outerHTML.slice(0, 400))
          if (domHits.length >= 10) break
        }
      }
      const koKeys = []
      const isObs = (v) => typeof v === "function" && typeof v.peek === "function"
      const roots = []
      try {
        if (window.ko) roots.push(window.ko.dataFor(document.querySelector("#CalendarID0") || document.body))
      } catch {}
      if (window.TTIModel) roots.push(window.TTIModel)
      const seen = new Set()
      const stack = roots.filter(Boolean).map((obj) => ({ obj, depth: 0, path: "" }))
      while (stack.length && koKeys.length < 30) {
        const { obj, depth, path } = stack.pop()
        if (!obj || typeof obj !== "object" || depth > 3 || seen.has(obj)) continue
        seen.add(obj)
        for (const k of Object.keys(obj)) {
          let v
          try { v = obj[k] } catch { continue }
          if (re.test(k)) koKeys.push(`${path}${k}${isObs(v) ? ` = ${JSON.stringify(v.peek())}` : ""}`)
          else if (v && typeof v === "object" && !Array.isArray(v)) stack.push({ obj: v, depth: depth + 1, path: `${path}${k}.` })
        }
      }
      return { domHits, koKeys }
    }).catch((e) => ({ error: String(e) }))

    // 2) التقويم: اختر المطارين وافتح التقويم وارجع عيّنة خام من الشهر الأول
    let calendarProbe = null
    if (origin && destination) {
      try {
        await selectBookingAirport(frame, 0, origin)
        await frame.waitForTimeout(600)
        await selectBookingAirport(frame, 1, destination)
        await frame.waitForTimeout(1000)
        const opened = await openCalendar(frame)
        const month = opened ? await readCalendarMonth(frame) : null
        const clsCounts = {}
        for (const c of month?.cells || []) clsCounts[c.cls] = (clsCounts[c.cls] || 0) + 1
        calendarProbe = {
          opened,
          title: month?.title,
          rootSel: month?.rootSel,
          distinctCellClasses: clsCounts,
          sampleCells: (month?.cells || []).slice(0, 12),
        }
      } catch (e) {
        calendarProbe = { error: e?.message || String(e) }
      }
    }

    // 3) deep: بحث كامل + عيّنة PassengerTypes الخام من ServerModel
    let deepProbe = null
    if (deep && origin && destination && departureDate) {
      try {
        const { warnings } = await runSearch(page, { origin, destination, departureDate, adults, children, infants: 0 })
        await page
          .frame({ name: "mainFrame" })
          ?.waitForFunction(() => window.TTIModel?.FlightListDisplay?.ServerModel != null, { timeout: 25000 })
          .catch(() => null)
        deepProbe = await page.frame({ name: "mainFrame" })?.evaluate(() => {
          const m = window.TTIModel?.FlightListDisplay?.ServerModel
          if (!m) return { error: "no ServerModel" }
          const seg = m.PricedTripsSummary?.[0]?.Trips?.[0]?.Flights?.[0]
          return {
            serverModelKeys: Object.keys(m),
            passengerTypesSample: JSON.parse(JSON.stringify(seg?.PassengerTypes ?? null)),
          }
        })
        deepProbe = { paxWarnings: warnings, ...deepProbe }
      } catch (e) {
        deepProbe = { error: e?.message || String(e) }
      }
    }

    return { paxProbe, calendarProbe, deepProbe }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}
