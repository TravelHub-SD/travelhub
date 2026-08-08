// محدِّد تزامن (semaphore) لعمليات المتصفح — يمنع فتح عشرات نوافذ Chromium
// معاً تحت الحمل العالي (السبب الرئيسي لتجمّد الموصّل). الطلبات الزائدة تنتظر
// في طابور؛ ومن ينتظر أطول من maxWaitMs يُرفض بسرعة (BUSY) بدل تعليق كل النظام.

export function createLimiter(max, maxWaitMs, opTimeoutMs = 100_000) {
  let active = 0
  const queue = []

  const pump = () => {
    if (active >= max) return
    const item = queue.shift()
    if (!item) return
    clearTimeout(item.timer)
    active++
    // مهلة صارمة لكل عملية: لو تعلّقت (متصفح/دخول) نحرّر الحصة بدل احتكارها للأبد
    Promise.race([
      Promise.resolve().then(item.fn),
      new Promise((_, rej) =>
        setTimeout(() => {
          const e = new Error("انتهت مهلة العملية")
          e.code = "OP_TIMEOUT"
          rej(e)
        }, opTimeoutMs),
      ),
    ])
      .then(item.resolve, item.reject)
      .finally(() => {
        active--
        pump()
      })
  }

  const run = (fn) =>
    new Promise((resolve, reject) => {
      const item = { fn, resolve, reject, timer: null }
      item.timer = setTimeout(() => {
        const i = queue.indexOf(item)
        if (i >= 0) {
          queue.splice(i, 1)
          const e = new Error("النظام مزدحم حالياً — حاول بعد لحظات")
          e.code = "BUSY"
          reject(e)
        }
      }, maxWaitMs)
      queue.push(item)
      pump()
    })

  run.stats = () => ({ active, queued: queue.length })
  return run
}
