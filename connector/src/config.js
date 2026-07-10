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
  // تسامح مع أخطاء لصق شائعة: مسافات، أو تكرار اسم المتغيّر داخل القيمة
  // (مثل TTI_CARRIERS=TTI_CARRIERS=[...])، أو أقواس اقتباس محيطة.
  let raw = (process.env.TTI_CARRIERS || "[]").trim()
  raw = raw.replace(/^\s*TTI_CARRIERS\s*=\s*/i, "").trim()
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    raw = raw.slice(1, -1).trim()
  }
  carriers = JSON.parse(raw)
  if (!Array.isArray(carriers)) carriers = []
} catch (e) {
  console.error("[config] TTI_CARRIERS ليست JSON صحيحة — سيتم تجاهلها:", e.message)
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
  // أسعار البوابة بالجنيه السوداني؛ الافتراضي 3650 ليطابق سعر الموقع عند العرض.
  sdgPerUsd: num(process.env.SDG_PER_USD, 3650),
  mock: process.env.MOCK === "1",
  carriers, // [{ name, iata, login, password, code }]
}

// محدّدات صفحات بوابة Zenith (TTI).
// ✅ محدّدات البحث مؤكّدة من HTML الحقيقي لصفحة newUI/index.asp.
// ⏳ محدّدات الدخول والنتائج بحاجة لتأكيد من HTML صفحتَي otds/index.asp و SearchResult.aspx.
export const SELECTORS = {
  // صفحة الدخول: emea.ttinteractive.com/otds/index.asp — ✅ مؤكّدة من الـ HTML.
  login: {
    loginPath: "/otds/index.asp",
    username: "#login",
    password: "#pwd",
    code: "#LoginCompanyIdentificationCode",
    submit: "#signInButton",
    // بعد نجاح الدخول تظهر لوحة Zenith (mainMenu / زر Book a flight / رابط الخروج)
    loggedInMarker: "#mainMenu, .flightSearchAction, a.DelogLink",
  },

  // نموذج البحث داخل newUI/index.asp — مؤكّد من الـ HTML.
  // ملاحظة: يُرسل GET إلى SearchResult.aspx، والنتائج تُعرض داخل iframe#mainFrame.
  search: {
    form: 'form[name="frmbook"]',
    openPanel: '.flightSearchAction',            // زر "Book a flight" يفتح لوحة البحث
    origin: '#id_depart',                        // <select> كل option فيه سمة airportCode=IATA
    destination: '#id_arrivee',                  // <select> (يُعاد ملؤه عند تغيير المغادرة)
    tripTypeOneWay: '#TypeTrajetAllersimple',    // radio value=0
    tripTypeRoundTrip: '#TypeTrajetAllerRetour', // radio value=1
    date: '#DepartureDate',                      // نص DD/MM/YYYY (jQuery UI datepicker)
    returnDate: '#ArrivalDate',
    adultsInput: '.tripPaxes .pax input',        // أول input = بالغين
    fareClass: 'select[name="id_classe"]',       // -1 Public fares (افتراضي)
    submit: '#btSubmit',
    resultsFrame: 'iframe#mainFrame',            // النتائج تُعرض هنا
  },

  // ✅ النتائج: لا نكشط DOM. صفحة النتائج (FlightListDisplay) تطبيق Knockout
  // وكل البيانات في كائن JS: window.TTIModel.FlightListDisplay.ServerModel
  // (PricedTripsSummary + DataReferenceAirports/FareBasis/BookingClasses…).
  // نقرأه مباشرة من داخل iframe#mainFrame — انظر tti.js/normalize.js.
}

// خريطة اسم المدينة الظاهر في النتائج → كود IATA (النتائج تعرض أسماء مدن).
export const CITY_TO_IATA = {
  "Khartoum": "KRT",
  "Port Sudan": "PZU",
  "Nyala": "UYL",
  "El Fasher": "ELF",
  "El Obeid": "EBD",
  "Dongola": "DOG",
  "Kassala": "KSL",
  "Wadi Halfa": "WHF",
  "Geneina": "EGN",
  "Atbara": "ATB",
  "Merowe": "MWE",
}
