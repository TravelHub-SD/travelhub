const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../prisma');
const { signToken, requireAuth } = require('../lib/auth');
const { HttpError, asyncHandler } = require('../lib/http');
const { parseBody } = require('../lib/validate');

const router = express.Router();

// أرقام السودان: 09xxxxxxxx أو 01xxxxxxxx
const phoneSchema = z
  .string()
  .trim()
  .regex(/^0[019]\d{8}$/, 'رقم الهاتف غير صحيح (مثال: 0912345678)');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'الاسم قصير جداً').max(60),
  phone: phoneSchema,
  email: z.string().trim().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل').max(100),
});

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

function publicUser(user) {
  return { id: user.id, name: user.name, phone: user.phone, email: user.email };
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = parseBody(registerSchema, req.body);
    const email = data.email ? data.email : null;

    const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existing) throw new HttpError(409, 'هذا الرقم مسجّل مسبقاً', 'PHONE_TAKEN');

    if (email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) throw new HttpError(409, 'هذا البريد مسجّل مسبقاً', 'EMAIL_TAKEN');
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        email,
        passwordHash: await bcrypt.hash(data.password, 10),
      },
    });

    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = parseBody(loginSchema, req.body);

    const user = await prisma.user.findUnique({ where: { phone: data.phone } });
    // رسالة واحدة للحالتين حتى لا نكشف أي الأرقام مسجّلة
    const ok = user && (await bcrypt.compare(data.password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'رقم الهاتف أو كلمة المرور غير صحيحة', 'BAD_CREDENTIALS');

    res.json({ token: signToken(user.id), user: publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(60).optional(),
      email: z.string().trim().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
    });
    const data = parseBody(schema, req.body);

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email || null }),
      },
    });

    res.json({ user: publicUser(user) });
  })
);

module.exports = router;
