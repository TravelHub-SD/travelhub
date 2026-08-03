const { HttpError } = require('./http');

/** يتحقق من جسم الطلب بمخطط zod ويعيد البيانات النظيفة */
function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpError(400, first.message, 'VALIDATION_ERROR');
  }
  return result.data;
}

module.exports = { parseBody };
