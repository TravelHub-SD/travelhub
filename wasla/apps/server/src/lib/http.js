/** خطأ يحمل رمز حالة HTTP — يلتقطه معالج الأخطاء المركزي */
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || undefined;
  }
}

/** يغلّف معالجات async حتى تصل أخطاؤها إلى next() تلقائياً */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { HttpError, asyncHandler };
