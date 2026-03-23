import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function ParentLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.white },
        headerTitleStyle: { color: COLORS.textDark, fontWeight: 'bold' },
        headerTintColor: '#8A51FC' // Cubby Purple
      }}
    >
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          title: 'ParentHub',
          headerTitleAlign: 'center'
        }} 
      />
    </Stack>
  );
}
