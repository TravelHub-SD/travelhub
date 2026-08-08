/**
 * lib/connector.ts
 * ─────────────────────────────────────────────────────────────────
 * روابط موصّلات TTI. يدعم موصّلاً واحداً (كل الخطوط) أو عدة موصّلات
 * مقسّمة — موصّل لكل خط — تُستعلَم بالتوازي فتظهر كل الخطوط بسرعة.
 *
 *   SUDAN_CONNECTOR_URLS = "https://tarco…,https://badr…,https://sudanair…"
 *   (أو الأقدم SUDAN_CONNECTOR_URL لموصّل واحد)
 *   CONNECTOR_API_KEY    = المفتاح المشترك (نفسه لكل الموصّلات)
 */

export function connectorUrls(): string[] {
  const multi = process.env.SUDAN_CONNECTOR_URLS
  if (multi && multi.trim()) {
    return multi
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean)
  }
  const single = process.env.SUDAN_CONNECTOR_URL
  return single ? [single.trim().replace(/\/$/, "")] : []
}

export function connectorKey(): string {
  return process.env.CONNECTOR_API_KEY ?? ""
}
