import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FontAwesome5 } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,

        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
        },

        tabBarActiveTintColor: '#F07820',
        tabBarInactiveTintColor: '#FFFFFF',

        tabBarStyle: {
          backgroundColor: '#224F9A',
          height: 78,
          paddingBottom: 10,
          paddingTop: 8,
          borderTopWidth: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          marginHorizontal: 0,
          paddingHorizontal: 8,
          elevation: 6,
        },
        tabBarItemStyle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Mis viajes',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="suitcase" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="myprofile"
        options={{
          title: 'Mi perfil',
          tabBarIcon: ({ color }) => (
            <FontAwesome5 name="user-alt" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="scanner"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="scanner-users"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
