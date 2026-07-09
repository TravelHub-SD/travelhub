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

  // جدول النتائج داخل iframe#mainFrame (SearchResult.aspx).
  // البنية المرئية معروفة، لكن أسماء العناصر تحتاج HTML صفحة النتائج. TODO
  results: {
    row: '.flightRow, .fareRow',                 // TODO تأكيد
    airline: '.airline, .flightNumber',          // شارة مثل "SD 207" — TODO
    flightNo: '.flightNumber',                   // TODO
    depTime: '.departure .time',                 // "06:00" — TODO
    depCode: '.departure .city',                 // "Port Sudan" — TODO
    arrTime: '.arrival .time',                   // "07:00" — TODO
    arrCode: '.arrival .city',                   // "Khartoum" — TODO
    price: '.totalPrice',                        // "750,000 SDG" — TODO
    empty: '.noResult, .noFlights',              // TODO
  },
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
