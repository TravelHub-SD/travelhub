const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../lib/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { parseBody } = require('../lib/validate');
const { CANCELLABLE, nextStatus, messageFor, transitionOrder } = require('../lib/orderFlow');

const router = express.Router();
router.use(requireAuth);

const createOrderSchema = z.object({
  storeSlug: z.string().trim().min(1, 'المتجر مطلوب'),
  addressId: z.string().trim().min(1, 'اختر عنوان التوصيل'),
  paymentMethod: z.enum(['CASH', 'CARD', 'WALLET']).default('CASH'),
  note: z.string().trim().max(300).default(''),
  items: z
    .array(
      z.object({
        menuItemId: z.string().trim().min(1),
        quantity: z.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل').max(50),
        note: z.string().trim().max(200).default(''),
      })
    )
    .min(1, 'السلة فارغة'),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseBody(createOrderSchema, req.body);

    const store = await prisma.store.findUnique({ where: { slug: data.storeSlug } });
    if (!store) throw new HttpError(404, 'المتجر غير موجود', 'STORE_NOT_FOUND');
    if (!store.isOpen) throw new HttpError(409, 'المتجر مغلق حالياً', 'STORE_CLOSED');

    const address = await prisma.address.findUnique({ where: { id: data.addressId } });
    if (!address || address.userId !== req.user.id) {
      throw new HttpError(404, 'العنوان غير موجود', 'ADDRESS_NOT_FOUND');
    }

    // الأسعار تُقرأ من قاعدة البيانات وليس من العميل — لا نثق بما يرسله التطبيق
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: data.items.map((i) => i.menuItemId) }, storeId: store.id },
    });
    const byId = new Map(menuItems.map((item) => [item.id, item]));

    const lines = data.items.map((line) => {
      const item = byId.get(line.menuItemId);
      if (!item) throw new HttpError(400, 'أحد الأصناف غير متاح في هذا المتجر', 'ITEM_NOT_IN_STORE');
      if (!item.isAvailable) throw new HttpError(409, `الصنف "${item.name}" غير متوفر حالياً`, 'ITEM_UNAVAILABLE');
      return {
        menuItemId: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: line.quantity,
        note: line.note,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    if (subtotal < store.minOrder) {
      throw new HttpError(
        409,
        `الحد الأدنى للطلب من هذا المتجر ${(store.minOrder / 100).toFixed(0)}`,
        'BELOW_MIN_ORDER'
      );
    }

    const total = subtotal + store.deliveryFee;
    const addressSnapshot = `${address.label} — ${address.area}، ${address.city}. ${address.details}`;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          code: await generateOrderCode(tx),
          userId: req.user.id,
          storeId: store.id,
          addressId: address.id,
          paymentMethod: data.paymentMethod,
          note: data.note,
          subtotal,
          deliveryFee: store.deliveryFee,
          total,
          etaMinutes: store.etaMinutes,
          addressSnapshot,
          items: { create: lines },
        },
      });

      await tx.orderEvent.create({
        data: { orderId: created.id, status: 'PENDING', message: messageFor('PENDING') },
      });

      return created;
    });

    res.status(201).json({ order: await loadOrder(order.id) });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { name: true, slug: true, logoUrl: true } },
        items: true,
      },
    });

    res.json({ orders: orders.map(serializeOrder) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertOwnedOrder(req.user.id, req.params.id);
    res.json({ order: await loadOrder(req.params.id) });
  })
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await assertOwnedOrder(req.user.id, req.params.id);

    if (order.status === 'CANCELLED') throw new HttpError(409, 'الطلب ملغى بالفعل', 'ALREADY_CANCELLED');
    if (!CANCELLABLE.has(order.status)) {
      throw new HttpError(409, 'لا يمكن إلغاء الطلب بعد بدء التجهيز', 'CANNOT_CANCEL');
    }

    await transitionOrder(order.id, 'CANCELLED', 'تم إلغاء الطلب بناءً على طلبك');
    res.json({ order: await loadOrder(order.id) });
  })
);

/**
 * ينقل الطلب للمرحلة التالية يدوياً.
 * موجود للعرض والتجربة — في الإنتاج تأتي هذه التحديثات من تطبيق المتجر/المندوب.
 */
router.post(
  '/:id/advance',
  asyncHandler(async (req, res) => {
    const order = await assertOwnedOrder(req.user.id, req.params.id);
    const step = nextStatus(order.status);
    if (!step) throw new HttpError(409, 'الطلب في مرحلته الأخيرة', 'NO_NEXT_STATUS');

    await transitionOrder(order.id, step.status, step.message);
    res.json({ order: await loadOrder(order.id) });
  })
);

const reviewSchema = z.object({
  rating: z.number().int().min(1, 'التقييم من 1 إلى 5').max(5, 'التقييم من 1 إلى 5'),
  comment: z.string().trim().max(500).default(''),
});

router.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const order = await assertOwnedOrder(req.user.id, req.params.id);
    const data = parseBody(reviewSchema, req.body);

    if (order.status !== 'DELIVERED') {
      throw new HttpError(409, 'يمكنك التقييم بعد توصيل الطلب', 'ORDER_NOT_DELIVERED');
    }
    const existing = await prisma.review.findUnique({ where: { orderId: order.id } });
    if (existing) throw new HttpError(409, 'قيّمت هذا الطلب مسبقاً', 'ALREADY_REVIEWED');

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId: order.id,
          userId: req.user.id,
          storeId: order.storeId,
          rating: data.rating,
          comment: data.comment,
        },
      });

      // نعيد حساب المتوسط من الصفر بدل التحديث التراكمي حتى لا ينحرف مع الوقت
      const agg = await tx.review.aggregate({
        where: { storeId: order.storeId },
        _avg: { rating: true },
        _count: true,
      });
      await tx.store.update({
        where: { id: order.storeId },
        data: {
          rating: Math.round((agg._avg.rating || 0) * 10) / 10,
          ratingCount: agg._count,
        },
      });

      return created;
    });

    res.status(201).json({ review });
  })
);

async function assertOwnedOrder(userId, id) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== userId) {
    throw new HttpError(404, 'الطلب غير موجود', 'ORDER_NOT_FOUND');
  }
  return order;
}

async function loadOrder(id) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      store: { select: { name: true, slug: true, logoUrl: true } },
      items: true,
      events: { orderBy: { createdAt: 'asc' } },
      review: true,
    },
  });
  return serializeOrder(order);
}

function serializeOrder(order) {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    note: order.note,
    addressSnapshot: order.addressSnapshot,
    etaMinutes: order.etaMinutes,
    createdAt: order.createdAt,
    store: order.store,
    items: order.items?.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      note: i.note,
    })),
    events: order.events?.map((e) => ({
      id: e.id,
      status: e.status,
      message: e.message,
      createdAt: e.createdAt,
    })),
    review: order.review || null,
  };
}

/** رقم طلب قصير وقابل للقراءة: WSL-4821 */
async function generateOrderCode(tx) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `WSL-${Math.floor(1000 + Math.random() * 9000)}`;
    const clash = await tx.order.findUnique({ where: { code } });
    if (!clash) return code;
  }
  // احتياطي شبه مستحيل التصادم
  return `WSL-${Date.now().toString().slice(-8)}`;
}

module.exports = router;
