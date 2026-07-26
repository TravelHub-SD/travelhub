// محدِّد تزامن (semaphore) لعمليات المتصفح — يمنع فتح عشرات نوافذ Chromium
// معاً تحت الحمل العالي (السبب الرئيسي لتجمّد الموصّل). الطلبات الزائدة تنتظر
// في طابور؛ ومن ينتظر أطول من maxWaitMs يُرفض بسرعة (BUSY) بدل تعليق كل النظام.

export function createLimiter(max, maxWaitMs) {
  let active = 0
  const queue = []

  const pump = () => {
    if (active >= max) return
    const item = queue.shift()
    if (!item) return
    clearTimeout(item.timer)
    active++
    Promise.resolve()
      .then(item.fn)
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
