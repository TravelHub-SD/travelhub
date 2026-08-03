import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { brand, font } from '../theme';

/**
 * شعار وصله — إعادة بناء متجهة (SVG) من ملف الهوية البصرية:
 * خطوط سرعة + انسيابة برتقالية على شكل حرف، وفوقها غطاء تقديم أبيض.
 *
 * متجه وليس صورة، فيظهر حاداً في كل الأحجام وبأي لون.
 * لاستبداله بملف الشعار الأصلي: ضع wasla-logo.svg في assets/ واستورده هنا
 * بدل محتوى <Svg> — بقية التطبيق لا تحتاج أي تعديل.
 */
export function WaslaMark({
  size = 96,
  color = brand.orange,
  domeColor = '#FFFFFF',
}: {
  size?: number;
  color?: string;
  domeColor?: string;
}) {
  // يجب أن تبقى هذه الأشكال مطابقة لـ assets/logo/wasla-mark.svg
  const height = (size * 150) / 215;

  return (
    <Svg width={size} height={height} viewBox="0 0 215 150">
      {/* خطوط السرعة */}
      <G stroke={color} strokeWidth={13} strokeLinecap="round" fill="none">
        <Path d="M12 50 H52" />
        <Path d="M4 78 H46" />
        <Path d="M18 106 H54" />
      </G>

      {/* الانسيابة: صينية ترتفع يميناً */}
      <Path
        d="M132 26 L178 26 L178 88 C178 120, 78 120, 78 86 L78 64"
        stroke={color}
        strokeWidth={26}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* غطاء التقديم — حدّ برتقالي ليبقى ظاهراً على الخلفيات البيضاء أيضاً */}
      <G fill={domeColor} stroke={color} strokeWidth={5} strokeLinejoin="round">
        <Circle cx={126} cy={60} r={6} />
        <Path d="M99 96 C99 60, 153 60, 153 96 Z" />
        <Rect x={93} y={94} width={66} height={12} rx={6} />
      </G>
    </Svg>
  );
}

/** الشعار كاملاً: العلامة + الاسم + الشعار النصي */
export function WaslaLogo({
  size = 110,
  color = brand.orange,
  inkColor = brand.ink,
  taglineColor = brand.orange,
  showTagline = true,
}: {
  size?: number;
  color?: string;
  inkColor?: string;
  taglineColor?: string;
  showTagline?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <WaslaMark size={size} color={color} />
      <Text style={[styles.name, { fontSize: size * 0.42, lineHeight: size * 0.6, color: inkColor }]}>
        {brand.name}
      </Text>
      {showTagline ? (
        <Text
          style={[
            styles.tagline,
            { fontSize: size * 0.145, lineHeight: size * 0.24, color: taglineColor },
          ]}
        >
          {brand.tagline}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  name: { fontFamily: font.black, textAlign: 'center', marginTop: 4 },
  tagline: { fontFamily: font.bold, textAlign: 'center' },
});
