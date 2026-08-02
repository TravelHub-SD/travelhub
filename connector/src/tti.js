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
import { createLimiter } from "./limiter.js"

// محدِّد تزامن مشترك لكل عمليات المتصفح (بحث/إتاحة/مطارات) — يحمي من الحمل العالي.
const browserLimit = createLimiter(config.browserConcurrency, config.queueMaxWaitMs, config.opTimeoutMs)

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

// مسار محرّك الحجز + معامل externalParam لكل خط —
// يُكتشفان من نداء النظام الفعلي (GetAvailabilitySummary) الذي يُطلقه المحرّك
// تلقائياً عند فتحه، فنستعملهما لاحقاً في نداء الإتاحة لأي مسار مباشرةً.
const engineBase = new Map() // carrier.code → "https://…/BookingEngine/"
const engineExt = new Map() // carrier.code → externalParam (مثل "TA")

function rememberEngineBase(carrier, frame) {
  try {
    const u = frame.url()
    const i = u.indexOf("/BookingEngine/")
    if (i > 0 && !engineBase.has(carrier.code)) {
      engineBase.set(carrier.code, u.slice(0, i + "/BookingEngine/".length))
    }
  } catch {}
}

// يلتقط base + externalParam من أي رابط GetAvailabilitySummary يمرّ على الصفحة.
function captureFromAvailUrl(carrier, url) {
  try {
    const i = url.indexOf("/BookingEngine/")
    if (i <= 0) return
    engineBase.set(carrier.code, url.slice(0, i + "/BookingEngine/".length))
    const m = url.match(/[?&]externalParam=([^&]*)/)
    if (m && m[1]) engineExt.set(carrier.code, decodeURIComponent(m[1]))
  } catch {}
}

// يربط مستمعاً يلتقط معاملات المحرّك من نداء الإتاحة التلقائي؛ يُرجّع دالة فكّ الربط.
function attachAvailCapture(page, carrier) {
  const onResp = (r) => {
    const u = r.url()
    if (u.includes("GetAvailabilitySummary")) captureFromAvailUrl(carrier, u)
  }
  page.on("response", onResp)
  return () => page.off("response", onResp)
}

// أيام الإتاحة لخط واحد عبر نداء الـ API الداخلي للمحرّك (سريع — بلا DOM).
export async function getCarrierAvailability(carrier, args) {
  try {
    return await browserLimit(() => _getCarrierAvailability(carrier, args))
  } catch (err) {
    return { carrier: carrier.name, days: [], error: err?.message || String(err) }
  }
}

async function _getCarrierAvailability(carrier, { origin, destination, start, end }) {
  let page
  let detach = () => {}
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    detach = attachAvailCapture(page, carrier) // التقاط base + externalParam من نداء النظام

    // نداء الإتاحة داخل سياق الصفحة — يرجّع الحالة والنص الخام (لنكتشف HTML)
    const buildUrl = () => {
      const base = engineBase.get(carrier.code)
      if (!base) return null
      const ext = engineExt.get(carrier.code) ?? carrier.ext ?? ""
      const qs =
        `departureAirportCode=${encodeURIComponent(origin)}` +
        `&arrivalAirportCode=${encodeURIComponent(destination)}` +
        `&startDate=${start}T00%3A00%3A00.000&endDate=${end}T23%3A59%3A59.999` +
        `&externalParam=${encodeURIComponent(ext)}&ffpOnly=false&ssrs=`
      return `${base}GetAvailabilitySummary?${qs}`
    }
    const rawFetch = (u) =>
      page.evaluate(async (url) => {
        try {
          const r = await fetch(url, { credentials: "include" })
          return { status: r.status, body: await r.text() }
        } catch (e) {
          return { status: 0, body: String(e) }
        }
      }, u)
    const parse = (resp) => {
      if (!resp || resp.status === 0) return null
      const t = (resp.body || "").trim()
      if (!t || t[0] === "<") return null // HTML (صفحة دخول/خطأ) — ليست JSON
      try {
        return JSON.parse(t)
      } catch {
        return null
      }
    }

    // فتح محرّك الحجز مرة إن لم يكن المسار معروفاً (يُنشئ جلسة المحرّك)
    if (!engineBase.get(carrier.code)) {
      await getBookingFrame(page)
      await page.waitForTimeout(2000)
    }
    let url = buildUrl()
    if (!url) return { carrier: carrier.name, days: [], error: "لم يُعرف مسار المحرّك" }

    let data = parse(await rawFetch(url))
    // لو رجع HTML (جلسة محرّك غير نشطة) → افتح المحرّك وأعد المحاولة مرة واحدة
    if (!data) {
      await getBookingFrame(page)
      await page.waitForTimeout(1500)
      url = buildUrl() || url // قد يُحدَّث base/ext بعد الفتح
      data = parse(await rawFetch(url))
    }
    if (!data) {
      await invalidateSession(carrier.code) // الجلسة غالباً منتهية — أعِد الدخول لاحقاً
      return { carrier: carrier.name, days: [], error: "رد غير JSON (جلسة المحرّك غير نشطة)" }
    }

    const days = (data?.Response?.Days || [])
      .filter((d) => d?.AvailStatus === 1)
      .map((d) => ({ date: String(d.Date).slice(0, 10), seats: Number(d.Availability) || 0 }))
    return { carrier: carrier.name, days, error: null }
  } catch (e) {
    // فشل JSON (صفحة دخول بدل بيانات) أو تعطّل الإطار — أبطل الجلسة احتياطاً
    await invalidateSession(carrier.code).catch(() => {})
    return { carrier: carrier.name, days: [], error: e?.message || String(e) }
  } finally {
    detach()
    if (page) await page.close().catch(() => {})
  }
}

// ضبط عدد الركاب (بالغون/أطفال/رضّع) — الحقول الثلاثة المرتبطة بـ getSetTravelerCount.
// نكتب مباشرة في نموذج Knockout (الأضمن)؛ وإلا نقرات +/− بعدد محسوب مسبقاً —
// لا نقرأ قيمة الحقل بين النقرات لأن Knockout قد لا يحدّثها فتنفلت الحلقة.
async function setPaxCounts(frame, { adults = 1, children = 0, infants = 0 }) {
  const targets = [
    Math.max(1, Math.min(9, Number(adults) || 1)),
    Math.max(0, Math.min(8, Number(children) || 0)),
    Math.max(0, Math.min(9, Number(infants) || 0)),
  ]
  const paxDebug = await frame.evaluate(
    ({ targets }) => {
      const out = []
      const inputs = Array.from(
        document.querySelectorAll('input[data-bind*="getSetTravelerCount"]'),
      ).slice(0, 3)
      inputs.forEach((input, i) => {
        const want = targets[i]
        // 1) الكتابة عبر نموذج Knockout مباشرة
        try {
          const vm = window.ko && window.ko.dataFor(input)
          const fn = vm && vm.getSetTravelerCount
          if (typeof fn === "function") {
            fn(want)
            out.push(`ko${i}=${fn()}`)
            return
          }
        } catch {}
        // 2) بديل: نقرات بعدد ثابت محسوب من القيمة الابتدائية فقط
        const start = Number(input.value) || 0
        const diff = want - start
        const group = input.closest(".input-group")
        const btns = group ? Array.from(group.querySelectorAll("button")) : []
        const plus = btns.find((b) => b.querySelector(".glyphicon-plus"))
        const minus = btns.find((b) => b.querySelector(".glyphicon-minus"))
        for (let k = 0; k < Math.abs(diff) && k < 9; k++) (diff > 0 ? plus : minus)?.click()
        out.push(`clk${i}:${start}→${want}`)
      })
      return out.join(",")
    },
    { targets },
  )
  await frame.waitForTimeout(400)

  // أغلق أي نافذة/تنبيه ركاب ظهر أثناء التعديل
  await frame
    .evaluate(() => {
      document.querySelectorAll(".popover .close, .popover button.close, .popover [data-dismiss]").forEach((b) => b.click())
    })
    .catch(() => {})

  // بعض الإعدادات تُظهر قائمة "عمر الطفل" لكل طفل مُضاف — لو ظهرت قائمة
  // فارغة قرب عدّادات الركاب نختار قيمة وسطى (وإلا يرفض المحرّك البحث بصمت).
  await frame.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input[data-bind*="getSetTravelerCount"]')).slice(0, 3)
    for (const inp of inputs) {
      let scope = inp
      for (let i = 0; i < 4 && scope.parentElement; i++) scope = scope.parentElement
      scope.querySelectorAll("select").forEach((sel) => {
        if (sel.offsetParent === null) return // مخفي
        if (sel.value === "" || sel.value === "-1" || sel.value == null || sel.selectedIndex < 0) {
          const opts = Array.from(sel.options).filter((o) => o.value !== "" && o.value !== "-1")
          if (opts.length) {
            sel.value = opts[Math.floor(opts.length / 2)].value
            sel.dispatchEvent(new Event("change", { bubbles: true }))
          }
        }
      })
    }
  })
  await frame.waitForTimeout(200)
  return paxDebug
}

// تحويل YYYY-MM-DD إلى صيغة المحرّك DD/MM/YYYY
function toEngineDate(iso) {
  const { d, m, y } = parseDate(iso)
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`
}

// تعبئة نموذج محرّك الحجز وتنفيذه.
// عند وجود returnDate نستخدم وضع "Round trip" الأصلي في النظام —
// بحث واحد يرجّع الاتجاهين معاً (نصف الحمل ونصف زمن الانتظار).
async function runSearch(page, carrier, params) {
  const { origin, destination, departureDate, returnDate } = params
  const frame = await getBookingFrame(page)
  rememberEngineBase(carrier, frame)

  // نوع الرحلة حسب الطلب
  const tripLabel = returnDate ? "Round trip" : "One way"
  await frame.getByText(tripLabel, { exact: true }).first().click().catch(() => {})
  await frame.waitForTimeout(400)

  // انتظر امتلاء قوائم المطارات
  await frame
    .waitForFunction(() => document.querySelector(".dropdown-menu a strong") != null, { timeout: 15000 })
    .catch(() => {})

  await selectBookingAirport(frame, 0, origin) // المغادرة
  await frame.waitForTimeout(600) // تُعاد تعبئة قائمة الوجهة حسب المغادرة
  await selectBookingAirport(frame, 1, destination) // الوجهة

  // تاريخ المغادرة DD/MM/YYYY
  await frame.evaluate((val) => {
    const el = document.querySelector("#CalendarID0")
    if (el) {
      el.value = val
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("blur", { bubbles: true }))
    }
  }, toEngineDate(departureDate))

  // تاريخ العودة (حقل العودة: DatePicker return أو CalendarID1 أو أي DatePicker آخر)
  if (returnDate) {
    await frame.waitForTimeout(300)
    const retOk = await frame.evaluate((val) => {
      const el =
        document.querySelector("input.DatePicker.return") ||
        document.querySelector("#CalendarID1") ||
        Array.from(document.querySelectorAll("input.DatePicker")).find(
          (e) => e.id !== "CalendarID0" && e.offsetParent !== null,
        )
      if (!el) return false
      el.value = val
      el.dispatchEvent(new Event("change", { bubbles: true }))
      el.dispatchEvent(new Event("blur", { bubbles: true }))
      return true
    }, toEngineDate(returnDate))
    if (!retOk) throw new Error("حقل تاريخ العودة غير موجود في المحرّك")
  }

  // عدد الركاب (بالغون/أطفال/رضّع) من طلب الموقع
  const paxDebug = await setPaxCounts(frame, params)

  // إرسال البحث
  await frame
    .locator("button:has-text('Search flights'), a:has-text('Search flights'), :text('Search flights')")
    .first()
    .click()

  return paxDebug
}

// قراءة نتائج البحث من كائن Knockout المضمّن في صفحة النتائج
// (TTIModel.FlightListDisplay.ServerModel) بدل كشط DOM — أدقّ وأثبت.
async function readResults(page, carrier, params) {
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

  if (!model) {
    // اجمع أدلة: أين نحن؟ وهل يعرض المحرّك رسالة خطأ/تنبيه؟
    let extra = ""
    try {
      const path = frame.url().split("/BookingEngine/")[1] || frame.url()
      extra = ` صفحة=${path.split("?")[0]}`
      const note = await frame.evaluate(() => {
        const texts = []
        for (const sel of [".modal.in", ".modal.show", "#AlertModal", "#TTINotifications", ".alert", ".validation-summary-errors"]) {
          const el = document.querySelector(sel)
          if (el && el.offsetParent !== null) {
            const t = (el.textContent || "").trim().replace(/\s+/g, " ")
            if (t) texts.push(t)
          }
        }
        return texts.join(" | ").slice(0, 250)
      })
      if (note) extra += ` رسالة="${note}"`
    } catch {}
    return { flights: [], debug: `لا ServerModel —${extra}` }
  }
  const flights = flightsFromServerModel(
    model,
    carrier,
    params?.returnDate ? { origin: params.origin, roundTrip: true } : undefined,
  )
  let debug = null
  if (!flights.length) {
    // شكل البيانات لتشخيص حالات الصفر (مثلاً بحث فيه طفل)
    try {
      const s = model.PricedTripsSummary || []
      const f0 = s[0]?.Trips?.[0]?.Flights?.[0]
      const pts = (f0?.PassengerTypes || [])
        .map((pt) => `${pt.Code || pt.PaxType || "?"}:${(pt.FareBasisList || []).length}أجرة`)
        .join(",")
      debug = `صفر رحلات — summaries=${s.length}, trips=${s[0]?.Trips?.length ?? 0}, paxTypes=[${pts}]`
    } catch {
      debug = "صفر رحلات — تعذّر قراءة الشكل"
    }
  }
  return { flights, debug }
}

// يقرأ مطارات النظام لخط معيّن من قوائم محرّك الحجز (المغادرة + الوجهة).
// يُرجّع خريطة { CODE: label }.
export async function listCarrierAirports(carrier) {
  try {
    return await browserLimit(() => _listCarrierAirports(carrier))
  } catch {
    return {}
  }
}

async function _listCarrierAirports(carrier) {
  let page
  let detach = () => {}
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    detach = attachAvailCapture(page, carrier) // التقاط base + externalParam أثناء التسخين
    const frame = await getBookingFrame(page)
    rememberEngineBase(carrier, frame)
    await frame
      .waitForFunction(() => document.querySelector(".dropdown-menu a strong") != null, { timeout: 15000 })
      .catch(() => {})
    await page.waitForTimeout(1500) // مهلة لالتقاط نداء الإتاحة التلقائي
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
    detach()
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
        // للحقول الرقمية الصغيرة (عدّادات الركاب غالباً): HTML الجدّ لمعرفة هويتها
        anc: /^\d$/.test((el.value || "").toString())
          ? (el.parentElement?.parentElement?.outerHTML || "").slice(0, 900)
          : undefined,
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

    // نفّذ البحث والتقط رابط صفحة النتائج (يحمل معاملات الركاب في الغالب)
    let resultUrl = null
    try {
      await frame
        .locator("button:has-text('Search flights'), a:has-text('Search flights'), :text('Search flights')")
        .first()
        .click()
      await page.waitForTimeout(6000)
      resultUrl =
        page
          .frames()
          .map((f) => f.url())
          .find((u) => /FlightList|SearchResult|Availability/i.test(u)) || null
    } catch {}

    return { carrier: carrier.name, ...form, calendar, netCalls: netCalls.slice(0, 10), resultUrl }
  } catch (e) {
    return { error: e?.message || String(e) }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

// البحث عبر خط واحد → مصفوفة رحلات مطبّعة. يبتلع الأخطاء ويرجّع [] مع تسجيلها.
// مغلّف بمحدِّد التزامن لحماية الموصّل من فتح متصفحات كثيرة معاً.
export async function searchCarrier(carrier, params) {
  try {
    return await browserLimit(() => _searchCarrier(carrier, params))
  } catch (err) {
    // رُفض من الطابور (النظام مزدحم) — لا نُبطل الجلسة
    return { carrier: carrier.name, flights: [], error: err?.message || String(err) }
  }
}

async function _searchCarrier(carrier, params) {
  let page
  try {
    const res = await getLoggedInPage(carrier, login)
    page = res.page
    const paxDebug = await runSearch(page, carrier, params)
    const { flights, debug } = await readResults(page, carrier, params)
    return { carrier: carrier.name, flights, error: debug ? `${debug} | ركاب: ${paxDebug || "?"}` : null }
  } catch (err) {
    await invalidateSession(carrier.code) // جلسة قد تكون انتهت — أعِد الدخول لاحقاً
    return { carrier: carrier.name, flights: [], error: err?.message || String(err) }
  } finally {
    if (page) await page.close().catch(() => {})
  }
}
