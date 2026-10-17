"use client"

import { useEffect, useState } from "react"

/**
 * يضمن أن يُرسم ردّ router.refresh() حين يصل.
 *
 * في Next 16.2.10 (وReact الـcanary المضمّن فيه) يصل ردّ التحديث كاملاً
 * أحياناً، ثم تبقى البيانات القديمة على الشاشة حتى يقع أيّ تحديث حالة آخر
 * في الصفحة. قِسناه على المنصرفات: ٣ من كل ١٠ حفظات بقي فيها المجموع
 * القديم، وكتابة حرفٍ في حقلٍ أظهرت الجديد دون أي طلب جديد. أي أن العمل
 * جاهز ولم يُجدوَل فقط.
 *
 * فنراقب انتهاء طلبات الـRSC (Resource Timing يسجّلها بعد آخر بايت)، ثم
 * نحدّث حالةً لا تُرسم شيئاً. هذا التحديث يجعل React يُنجز ما تعلّق.
 * يُركّب مرّة في رأس كل قسم محميّ.
 */
export function RouterFlush() {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (typeof PerformanceObserver === "undefined") return
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const observer = new PerformanceObserver((list) => {
      if (!list.getEntries().some((e) => e.name.includes("_rsc="))) return
      // فكّ الرد يكمل بعد وصول آخر بايت ببضع مهام، فنكرّر قليلاً.
      for (const ms of [0, 150, 500]) {
        const t = setTimeout(() => {
          timers.delete(t)
          setTick((n) => n + 1)
        }, ms)
        timers.add(t)
      }
    })
    observer.observe({ type: "resource" })
    return () => {
      observer.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [])

  return null
}
