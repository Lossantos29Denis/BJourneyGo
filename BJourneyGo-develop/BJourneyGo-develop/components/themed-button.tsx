import { useThemeColor } from '@/hooks/use-theme-color';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableOpacityProps,
} from 'react-native';

export type ThemedButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  isLoading?: boolean;
  lightColor?: string;
  darkColor?: string;
};

export function ThemedButton({
  title,
  variant = 'primary',
  isLoading,
  lightColor,
  darkColor,
  style,
  disabled,
  ...otherProps
}: ThemedButtonProps) {
  const tintColor = useThemeColor({ light: '#0a7ea4', dark: '#fff' }, 'tint');
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const secondaryBackground = useThemeColor({ light: '#e5e7eb', dark: '#374151' }, 'background');

  const getBackgroundColor = () => {
    if (disabled || isLoading) return '#9ca3af';
    switch (variant) {
      case 'primary':
        return tintColor;
      case 'secondary':
        return secondaryBackground;
      case 'outline':
        return 'transparent';
      default:
        return tintColor;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
        return '#ffffff';
      case 'secondary':
        return textColor;
      case 'outline':
        return tintColor;
      default:
        return '#ffffff';
    }
  };

  const getBorderStyle = () => {
    if (variant === 'outline') {
      return {
        borderWidth: 2,
        borderColor: disabled || isLoading ? '#9ca3af' : tintColor,
      };
    }
    return {};
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        getBorderStyle(),
        style,
      ]}
      disabled={disabled || isLoading}
      {...otherProps}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
