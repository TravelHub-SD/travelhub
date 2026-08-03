const prisma = require('./prisma');
const { nextStatus, transitionOrder } = require('./lib/orderFlow');

/**
 * محاكي دورة حياة الطلب.
 * في نظام حقيقي يحدّث المتجرُ والمندوبُ الحالةَ من تطبيقاتهم؛ هنا نتقدّم بالوقت
 * حتى تعمل شاشة تتبع الطلب في التطبيق كما ستعمل في الإنتاج.
 */
const STEP_SECONDS = Number(process.env.SIMULATOR_STEP_SECONDS || 25);
const TICK_MS = 5000;

const ACTIVE = ['PENDING', 'CONFIRMED', 'PREPARING', 'ON_THE_WAY'];

async function tick() {
  const cutoff = new Date(Date.now() - STEP_SECONDS * 1000);

  const orders = await prisma.order.findMany({
    where: { status: { in: ACTIVE }, updatedAt: { lte: cutoff } },
    take: 50,
  });

  for (const order of orders) {
    const step = nextStatus(order.status);
    if (!step) continue;
    await transitionOrder(order.id, step.status, step.message);
  }
}

function startSimulator() {
  const timer = setInterval(() => {
    tick().catch((err) => console.error('[simulator]', err.message));
  }, TICK_MS);

  timer.unref(); // لا يمنع الخروج النظيف للعملية
  console.log(`[simulator] يعمل — كل مرحلة ${STEP_SECONDS} ثانية`);
  return timer;
}

module.exports = { startSimulator };
