import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { Text } from 'react-native';

export default function KidLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        headerShown: true,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        headerStyle: { backgroundColor: COLORS.white },
        headerTitleStyle: { color: COLORS.textDark, fontWeight: 'bold' }
      }}
    >
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>
        }} 
      />
      <Tabs.Screen 
        name="games" 
        options={{ 
          title: 'Games',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🎮</Text>
        }} 
      />
      <Tabs.Screen 
        name="chat" 
        options={{ 
          title: 'Chat',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💬</Text>
        }} 
      />
      <Tabs.Screen 
        name="favorites" 
        options={{ 
          title: 'Favorites',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💖</Text>
        }} 
      />
      <Tabs.Screen 
        name="history" 
        options={{ 
          title: 'History',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⏱️</Text>
        }} 
      />
    </Tabs>
  );
}
