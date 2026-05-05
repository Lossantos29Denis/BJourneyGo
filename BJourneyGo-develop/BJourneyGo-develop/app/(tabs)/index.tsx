import { Redirect } from 'expo-router';

export default function TabsIndex() {
  // Ensure / (tabs) resolves to the visible home tab
  return <Redirect href="/(tabs)/home" />;
}
