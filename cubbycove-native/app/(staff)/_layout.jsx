import { Stack } from 'expo-router';
import { COLORS } from '../../constants/theme';

export default function StaffLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: false,
      }}
    />
  );
}
