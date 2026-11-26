import { Stack } from 'expo-router';
import { COLORS } from '../../../constants/theme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function AdminIssuesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
