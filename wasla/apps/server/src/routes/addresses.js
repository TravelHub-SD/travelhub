const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { requireAuth } = require('../lib/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { parseBody } = require('../lib/validate');

const router = express.Router();
router.use(requireAuth);

const addressSchema = z.object({
  label: z.string().trim().min(1, 'اسم العنوان مطلوب').max(30),
  area: z.string().trim().min(1, 'المنطقة مطلوبة').max(60),
  city: z.string().trim().min(1).max(60).default('الخرطوم'),
  details: z.string().trim().min(1, 'تفاصيل العنوان مطلوبة').max(300),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().default(false),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ addresses });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseBody(addressSchema, req.body);
    const count = await prisma.address.count({ where: { userId: req.user.id } });
    // أول عنوان يصبح الافتراضي تلقائياً
    const isDefault = data.isDefault || count === 0;

    const address = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }
      return tx.address.create({ data: { ...data, isDefault, userId: req.user.id } });
    });

    res.status(201).json({ address });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await findOwnedAddress(req.user.id, req.params.id);
    const data = parseBody(addressSchema.partial(), req.body);

    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false },
        });
      }
      return tx.address.update({ where: { id: req.params.id }, data });
    });

    res.json({ address });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const address = await findOwnedAddress(req.user.id, req.params.id);
    await prisma.address.delete({ where: { id: address.id } });

    // إن حذفنا الافتراضي، رقّي أحدث عنوان متبقٍ ليحل محله
    if (address.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    res.json({ ok: true });
  })
);

async function findOwnedAddress(userId, id) {
  const address = await prisma.address.findUnique({ where: { id } });
  if (!address || address.userId !== userId) {
    throw new HttpError(404, 'العنوان غير موجود', 'ADDRESS_NOT_FOUND');
  }
  return address;
}

module.exports = router;
