const jwt = require('jsonwebtoken');
const env = require('../env');
const prisma = require('../prisma');
const { HttpError, asyncHandler } = require('./http');

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

/** يطلب توكن صالح ويضع المستخدم في req.user */
const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'مطلوب تسجيل الدخول', 'UNAUTHENTICATED');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'الجلسة منتهية، سجّل الدخول مرة أخرى', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new HttpError(401, 'الحساب غير موجود', 'USER_NOT_FOUND');

  req.user = user;
  next();
});

module.exports = { signToken, requireAuth };
