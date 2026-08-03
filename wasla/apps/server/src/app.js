const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./env');
const { HttpError } = require('./lib/http');

const authRoutes = require('./routes/auth');
const catalogRoutes = require('./routes/catalog');
const addressRoutes = require('./routes/addresses');
const orderRoutes = require('./routes/orders');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, app: 'wasla', currency: env.CURRENCY });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api/addresses', addressRoutes);
  app.use('/api/orders', orderRoutes);

  app.use((_req, _res, next) => {
    next(new HttpError(404, 'المسار غير موجود', 'NOT_FOUND'));
  });

  // معالج الأخطاء المركزي — يجب أن يبقى بأربعة معاملات
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: {
        message: status >= 500 ? 'حدث خطأ في السيرفر، حاول مرة أخرى' : err.message,
        code: err.code || 'INTERNAL_ERROR',
      },
    });
  });

  return app;
}

module.exports = { createApp };
