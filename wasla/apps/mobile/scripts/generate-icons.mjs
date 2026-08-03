/**
 * يولّد أيقونات التطبيق وشاشة البداية من ملف الشعار المتجه.
 *
 *   node scripts/generate-icons.mjs
 *
 * بعد استبدال assets/logo/wasla-mark.svg بالشعار الأصلي، شغّل الأمر
 * فتتحدّث كل الأيقونات دفعة واحدة.
 *
 * يتطلب sharp:  npm i -D sharp
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'assets/logo/wasla-mark.svg');
const ORANGE = '#F4661B';

const markSvg = readFileSync(SRC, 'utf8');

/**
 * يعيد تلوين العلامة — البرتقالي للجسم والأبيض للغطاء.
 * نمرّ عبر رمز مؤقّت لأن الاستبدال المتتالي قد يعيد استبدال ما كتبناه للتو.
 */
function recolor(svg, { body, dome }) {
  return svg
    .replaceAll(ORANGE, '__BODY__')
    .replaceAll('#FFFFFF', '__DOME__')
    .replaceAll('__BODY__', body)
    .replaceAll('__DOME__', dome);
}

/**
 * يضع العلامة داخل مربّع بخلفية ومساحة أمان.
 * scale = نسبة عرض العلامة من ضلع المربّع.
 */
function compose(markSource, { size, background, scale }) {
  const markWidth = Math.round(size * scale);
  const markHeight = Math.round((markWidth * 140) / 200);
  const x = Math.round((size - markWidth) / 2);
  const y = Math.round((size - markHeight) / 2);

  const bg = background
    ? `<rect width="${size}" height="${size}" fill="${background}"/>`
    : '';

  const inner = markSource
    .replace(/^<\?xml[^>]*\?>\s*/, '')
    .replace(/<svg[^>]*>/, '')
    .replace('</svg>', '');

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      bg +
      `<g transform="translate(${x} ${y}) scale(${markWidth / 200})">${inner}</g>` +
      `</svg>`
  );
}

const orangeOnLight = markSvg;
const whiteMark = recolor(markSvg, { body: '#FFFFFF', dome: ORANGE });
const blackMark = recolor(markSvg, { body: '#000000', dome: '#FFFFFF' });

const TARGETS = [
  // أيقونة التطبيق: خلفية بيضاء وعلامة برتقالية، كما في ملف الهوية
  { file: 'icon.png', size: 1024, source: orangeOnLight, background: '#FFFFFF', scale: 0.66 },

  // أندرويد التكيّفية: الواجهة تُقصّ دائرياً فنترك مساحة أمان أوسع
  { file: 'android-icon-foreground.png', size: 1024, source: orangeOnLight, background: null, scale: 0.5 },
  { file: 'android-icon-background.png', size: 1024, source: null, background: '#FFFFFF', scale: 1 },
  { file: 'android-icon-monochrome.png', size: 1024, source: blackMark, background: null, scale: 0.5 },

  // شاشة البداية فوق خلفية برتقالية، فالعلامة بيضاء
  { file: 'splash-icon.png', size: 1024, source: whiteMark, background: null, scale: 0.62 },

  { file: 'favicon.png', size: 96, source: orangeOnLight, background: '#FFFFFF', scale: 0.7 },
];

mkdirSync(join(root, 'assets'), { recursive: true });

for (const target of TARGETS) {
  const out = join(root, 'assets', target.file);

  if (!target.source) {
    // خلفية صلبة فقط
    await sharp({
      create: {
        width: target.size,
        height: target.size,
        channels: 4,
        background: target.background,
      },
    })
      .png()
      .toFile(out);
  } else {
    const svg = compose(target.source, {
      size: target.size,
      background: target.background,
      scale: target.scale,
    });
    await sharp(svg, { density: 384 }).png().toFile(out);
  }

  console.log(`✓ ${target.file} (${target.size}px)`);
}

console.log('\nتم توليد كل الأيقونات من', SRC.replace(root + '/', ''));
