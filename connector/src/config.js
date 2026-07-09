// ─────────────────────────────────────────────────────────────
// إعدادات الموصّل + محدّدات الصفحات (SELECTORS)
//
// ⚠️ المحدّدات أدناه "مبدئية" لأننا لم نفحص البوابة الحقيقية بعد.
//    بعد أن تشارك صور/HTML صفحات (الدخول، البحث، النتائج) سنضبطها.
//    كل محدّد موضّح بتعليق يبيّن ماذا يمثّل.
// ─────────────────────────────────────────────────────────────

function num(v, def) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

let carriers = []
try {
  carriers = JSON.parse(process.env.TTI_CARRIERS || "[]")
  if (!Array.isArray(carriers)) carriers = []
} catch {
  console.error("[config] TTI_CARRIERS ليست JSON صحيحة — سيتم تجاهلها")
  carriers = []
}

export const config = {
  port: num(process.env.PORT, 8080),
  apiKey: process.env.CONNECTOR_API_KEY || "",
  portalUrl: process.env.TTI_PORTAL_URL || "https://emea.ttinteractive.com/newUI/index.asp",
  browserWsEndpoint: process.env.BROWSER_WS_ENDPOINT || "",
  headless: (process.env.HEADLESS ?? "true") !== "false",
  sessionTtlMs: num(process.env.SESSION_TTL_MINUTES, 15) * 60_000,
  cacheTtlMs: num(process.env.CACHE_TTL_SECONDS, 120) * 1000,
  sdgPerUsd: num(process.env.SDG_PER_USD, 0),
  mock: process.env.MOCK === "1",
  carriers, // [{ name, iata, login, password, code }]
}

// محدّدات الصفحات — تُملأ/تُراجَع بعد فحص البوابة الحقيقية.
export const SELECTORS = {
  login: {
    // حقول نموذج تسجيل الدخول
    username: 'input[name="login"]',      // TODO: تأكيد الاسم الحقيقي
    password: 'input[name="password"]',   // TODO
    code: 'input[name="code"]',           // كود الخط (3tair/badr/sudanair) — TODO
    submit: 'input[type="submit"], button[type="submit"]', // TODO
    // عنصر يظهر فقط بعد نجاح الدخول (للتأكد أن الجلسة فعّالة)
    loggedInMarker: '#mainMenu, a[href*="logout" i]', // TODO
  },
  search: {
    origin: 'input[name="from"]',         // TODO
    destination: 'input[name="to"]',      // TODO
    date: 'input[name="depDate"]',        // TODO (صيغة التاريخ قد تختلف — نضبطها لاحقاً)
    adults: 'input[name="adt"]',          // TODO
    submit: '#btnSearch, button[type="submit"]', // TODO
  },
  results: {
    // صف الرحلة الواحد في جدول النتائج
    row: 'table.results tr.flightRow',    // TODO
    // داخل الصف:
    airline: '.airline',                  // TODO
    flightNo: '.flightNo',                // TODO
    depTime: '.dep .time',                // TODO
    depCode: '.dep .code',                // TODO
    arrTime: '.arr .time',                // TODO
    arrCode: '.arr .code',                // TODO
    price: '.price',                      // TODO
    // عنصر يدل على عدم وجود نتائج
    empty: '.noResults',                  // TODO
  },
}
