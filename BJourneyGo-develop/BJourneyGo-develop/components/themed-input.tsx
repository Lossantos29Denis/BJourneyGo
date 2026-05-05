import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';

export type ThemedInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
  label?: string;
  error?: string;
  icon?: React.ComponentProps<typeof IconSymbol>['name'];
  isPassword?: boolean;
  textColorLight?: string;
  textColorDark?: string;
};

export function ThemedInput({
  style,
  lightColor,
  darkColor,
  label,
  error,
  icon,
  isPassword,
  textColorLight,
  textColorDark,
  ...otherProps
}: ThemedInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );
  const defaultBorderColor = useThemeColor({ light: '#d1d5db', dark: '#374151' }, 'text');
  const placeholderColor = useThemeColor({ light: '#9ca3af', dark: '#6b7280' }, 'text');
  const textColor = useThemeColor({ light: textColorLight || lightColor, dark: textColorDark || darkColor }, 'text');
  const borderColor = error ? '#ef4444' : defaultBorderColor;

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: textColor }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          { backgroundColor, borderColor },
          error && styles.inputError,
        ]}
      >
        {icon && (
          <IconSymbol
            name={icon}
            size={20}
            color={textColor}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            { color: textColor },
            style,
          ]}
          placeholderTextColor={placeholderColor}
          secureTextEntry={isPassword && !isPasswordVisible}
          {...otherProps}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.eyeIcon}
          >
            <IconSymbol
              name={isPasswordVisible ? 'eye.slash' : 'eye'}
              size={20}
              color={textColor}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  icon: {
    marginRight: 12,
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});
