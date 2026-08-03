const prisma = require('../prisma');

/** مراحل الطلب بالترتيب، مع الرسالة المعروضة في شاشة التتبع */
const ORDER_FLOW = [
  { status: 'PENDING', message: 'تم استلام طلبك، في انتظار تأكيد المتجر' },
  { status: 'CONFIRMED', message: 'المتجر أكّد الطلب' },
  { status: 'PREPARING', message: 'جاري تجهيز طلبك' },
  { status: 'ON_THE_WAY', message: 'المندوب في الطريق إليك' },
  { status: 'DELIVERED', message: 'تم توصيل الطلب. بالهناء والشفاء!' },
];

const ORDER_STATUSES = ORDER_FLOW.map((s) => s.status).concat('CANCELLED');

/** الحالات التي يُسمح للعميل بالإلغاء فيها */
const CANCELLABLE = new Set(['PENDING', 'CONFIRMED']);

function nextStatus(current) {
  const index = ORDER_FLOW.findIndex((s) => s.status === current);
  if (index === -1 || index === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[index + 1];
}

function messageFor(status) {
  const step = ORDER_FLOW.find((s) => s.status === status);
  return step ? step.message : 'تم تحديث حالة الطلب';
}

/** ينقل الطلب لحالة جديدة ويسجّل الحدث في نفس المعاملة */
async function transitionOrder(orderId, status, message) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: orderId },
      data: { status },
    });
    await tx.orderEvent.create({
      data: { orderId, status, message: message || messageFor(status) },
    });
    return order;
  });
}

module.exports = {
  ORDER_FLOW,
  ORDER_STATUSES,
  CANCELLABLE,
  nextStatus,
  messageFor,
  transitionOrder,
};
