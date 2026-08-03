/** نظام التصميم لتطبيق وصلة */
export const colors = {
  primary: '#FF6B2C',
  primaryDark: '#E85A1C',
  primarySoft: '#FFF1EA',
  text: '#14181F',
  textMuted: '#6B7480',
  textFaint: '#9AA2AD',
  bg: '#FFFFFF',
  bgSoft: '#F6F7F9',
  border: '#E8EAEE',
  success: '#12A150',
  successSoft: '#E8F7EF',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#F5A524',
  star: '#F5A524',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
} as const;

/**
 * خط Cairo — مصمّم للعربية ويغطي الأوزان التي نحتاجها.
 *
 * على أندرويد لا يُطبَّق fontWeight على الخطوط المخصّصة، فكل وزن يحتاج اسم
 * عائلة مستقلاً. لذلك نستعمل هذه الأسماء بدل fontWeight في كل الأنماط.
 * الأسماء يجب أن تطابق مفاتيح useFonts في app/_layout.tsx حرفياً.
 */
export const font = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semibold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extrabold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
} as const;

/**
 * الواجهة عربية بالكامل، فنبني الاتجاه في الأنماط صراحةً بدل الاعتماد على
 * I18nManager.forceRTL — الأخير يتطلب إعادة تشغيل التطبيق ليأخذ مفعوله.
 */
export const rtl = {
  row: { flexDirection: 'row-reverse' } as const,
  text: { textAlign: 'right', writingDirection: 'rtl' } as const,
};
