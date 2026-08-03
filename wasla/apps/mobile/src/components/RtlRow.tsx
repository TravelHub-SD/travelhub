import { useRef, type ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

/**
 * قائمة أفقية تبدأ من اليمين.
 * مع flexDirection: 'row-reverse' يوضع أول عنصر في أقصى يمين المحتوى، بينما
 * تبدأ ScrollView من اليسار — فنقفز للنهاية مرة واحدة ليظهر أول عنصر أولاً،
 * ونتوقف عن التدخّل بمجرد أن يسحب المستخدم بنفسه.
 */
export function RtlRow({
  children,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ScrollView>(null);
  const userHasScrolled = useRef(false);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      onScrollBeginDrag={() => {
        userHasScrolled.current = true;
      }}
      onContentSizeChange={() => {
        if (!userHasScrolled.current) ref.current?.scrollToEnd({ animated: false });
      }}
      contentContainerStyle={[{ flexDirection: 'row-reverse' }, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}
