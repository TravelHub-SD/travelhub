const env = require('./env');
const { createApp } = require('./app');
const { startSimulator } = require('./simulator');

const app = createApp();

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[wasla] السيرفر يعمل على http://localhost:${env.PORT}`);
  if (process.env.ORDER_SIMULATOR !== 'off') startSimulator();
});
