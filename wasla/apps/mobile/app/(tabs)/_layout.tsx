import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Loading } from '@/components/ui';
import { font, colors } from '@/theme';

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const { itemCount } = useCart();

  if (isLoading) return <Loading />;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        // ارتفاع أكبر من الافتراضي لأن Cairo أطول من خط النظام فتُقص التسميات
        tabBarStyle: { borderTopColor: colors.border, height: 70, paddingBottom: 10, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 17, fontFamily: font.bold },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'البحث',
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="receipt-outline" size={size} color={color} />
              {itemCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{itemCount}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    left: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 15, fontFamily: font.extrabold },
});
