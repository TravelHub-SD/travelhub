require('dotenv').config();

const env = {
  PORT: Number(process.env.PORT || 4000),
  JWT_SECRET: process.env.JWT_SECRET || 'wasla-dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CURRENCY: process.env.CURRENCY || 'ج.س',
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'wasla-dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = env;
