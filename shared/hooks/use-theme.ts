import { useMemo } from 'react';
import { useColorScheme } from './use-color-scheme';
import { BRAND_YELLOW, Colors } from '@/constants/theme';

/**
 * Theme colors interface
 * Provides semantic color names for light and dark modes
 */
export interface ThemeColors {
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  
  // Background colors
  background: string;
  surface: string;
  card: string;
  modal: string;
  
  // Border colors
  border: string;
  borderDark: string;
  
  // Primary colors
  primary: string;
  primaryDark: string;
  primaryText: string;
  link: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
  
  // Form Input colors
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputPlaceholder: string;
  inputFocusBorder: string;
  inputErrorBorder: string;
  inputDisabledBackground: string;
  inputDisabledText: string;
  placeholder: string;
  
  // Button System Colors
  buttonPrimary: string;
  buttonPrimaryText: string;
  buttonPrimaryHover: string;
  buttonPrimaryPressed: string;
  buttonPrimaryDisabled: string;
  buttonPrimaryDisabledText: string;
  buttonSecondary: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  buttonSecondaryHover: string;
  buttonSecondaryPressed: string;
  buttonDanger: string;
  buttonDangerText: string;
  
  // Toggle Switch Colors
  toggleOffTrack: string;
  toggleOffKnob: string;
  toggleOnTrack: string;
  toggleOnKnob: string;
  toggleDisabledTrack: string;
  toggleDisabledKnob: string;
}

/**
 * Custom hook that provides theme colors based on device color scheme
 * Automatically switches between light and dark mode based on system settings
 * @returns ThemeColors object with appropriate colors for current mode
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const colors = useTheme();
 *   
 *   return (
 *     <View style={{ backgroundColor: colors.background }}>
 *       <Text style={{ color: colors.text }}>Hello</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeColors {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return useMemo(() => {
    if (isDark) {
      return {
        // Text colors
        // Primary Text: #FFFFFF - High contrast on dark
        text: Colors.dark.text,
        // Secondary Text: #BDBDBD - Body text, inactive UI elements
        textSecondary: Colors.dark.textSecondary,
        textMuted: Colors.dark.textMuted,
        // Disabled Text: #757575
        textDisabled: Colors.dark.textDisabled,
        
        // Background colors
        // Primary Background: #121212 - Main app background
        background: Colors.dark.background,
        // Secondary Background: #1E1E1E - Elevated surfaces and containers
        surface: Colors.dark.surface,
        card: Colors.dark.card,
        // Modal / Surface: #212121
        modal: Colors.dark.modal,
        
        // Border colors
        // Borders / Dividers: #2E2E2E
        border: Colors.dark.border,
        borderDark: '#424242',
        
        // Primary colors
        // Primary Brand / Accent: #FFCD36 - Highlights, badges, tabs, active states
        // Primary Buttons: #FFCD36 - Key interactive elements
        primary: BRAND_YELLOW,
        primaryDark: '#E6B82E',
        // Button Text: #121212 - High contrast on yellow
        primaryText: Colors.dark.primaryText,
        // Links / Active: #FFCD36
        link: Colors.dark.link,
        
        // Status colors
        // Success / ON Green: #8BC34A
        success: Colors.dark.success,
        error: Colors.dark.error,
        warning: Colors.dark.warning,
        info: '#42A5F5',
        
        // Form Input colors
        inputBackground: Colors.dark.inputBackground,
        inputBorder: Colors.dark.inputBorder,
        inputText: Colors.dark.inputText,
        inputPlaceholder: Colors.dark.inputPlaceholder,
        inputFocusBorder: Colors.dark.inputFocusBorder,
        inputErrorBorder: Colors.dark.inputErrorBorder,
        inputDisabledBackground: Colors.dark.inputDisabledBackground,
        inputDisabledText: Colors.dark.inputDisabledText,
        placeholder: Colors.dark.placeholder,
        
        // Button System Colors (Dark Mode)
        buttonPrimary: Colors.dark.buttonPrimary,
        buttonPrimaryText: Colors.dark.buttonPrimaryText,
        buttonPrimaryHover: Colors.dark.buttonPrimaryHover,
        buttonPrimaryPressed: Colors.dark.buttonPrimaryPressed,
        buttonPrimaryDisabled: Colors.dark.buttonPrimaryDisabled,
        buttonPrimaryDisabledText: Colors.dark.buttonPrimaryDisabledText,
        buttonSecondary: Colors.dark.buttonSecondary,
        buttonSecondaryBorder: Colors.dark.buttonSecondaryBorder,
        buttonSecondaryText: Colors.dark.buttonSecondaryText,
        buttonSecondaryHover: Colors.dark.buttonSecondaryHover,
        buttonSecondaryPressed: Colors.dark.buttonSecondaryPressed,
        buttonDanger: Colors.dark.buttonDanger,
        buttonDangerText: Colors.dark.buttonDangerText,
        
        // Toggle Switch Colors (Dark Mode) - Green = ON
        toggleOffTrack: Colors.dark.toggleOffTrack,
        toggleOffKnob: Colors.dark.toggleOffKnob,
        toggleOnTrack: Colors.dark.toggleOnTrack, // #8BC34A - Green for ON
        toggleOnKnob: Colors.dark.toggleOnKnob,
        toggleDisabledTrack: Colors.dark.toggleDisabledTrack,
        toggleDisabledKnob: Colors.dark.toggleDisabledKnob,
      };
    }

    // Light mode colors - White-First Brand System
    return {
      // Text colors
      // Primary Text: #212121 - Strong contrast on white
      text: Colors.light.text,
      // Secondary Text / Icons: #616161 - Subtle hierarchy
      textSecondary: Colors.light.textSecondary,
      textMuted: Colors.light.textMuted,
      // Disabled Text: #9E9E9E
      textDisabled: Colors.light.textDisabled,
      
      // Background colors
      // Primary Background: #FFFFFF - Clean, neutral, maximum readability
      background: Colors.light.background,
      // Secondary Background / Cards: #F7F7F7 - Soft separation without borders
      surface: Colors.light.surface,
      card: Colors.light.card,
      // Modal / Surface: #FFFFFF
      modal: Colors.light.modal,
      
      // Border colors
      // Borders / Dividers: #E0E0E0
      border: Colors.light.border,
      borderDark: '#BDBDBD',
      
      // Primary colors
      // Primary Brand / Accent: #FFCD36 - Highlights, badges, tabs, active states
      // Primary Buttons / CTAs: #FFCD36 - Brand-driven actions
      primary: Colors.light.primary,
      primaryDark: '#E6B82E',
      // Button Text: #212121 - High contrast on yellow
      primaryText: Colors.light.primaryText,
      // Links / Active: #FFCD36
      link: Colors.light.link,
      
      // Status colors
      // Success / ON Green: #4CAF50
      success: Colors.light.success,
      error: Colors.light.error,
      warning: Colors.light.warning,
      info: '#2196F3',
      
      // Form Input colors
      inputBackground: Colors.light.inputBackground,
      inputBorder: Colors.light.inputBorder,
      inputText: Colors.light.inputText,
      inputPlaceholder: Colors.light.inputPlaceholder,
      inputFocusBorder: Colors.light.inputFocusBorder,
      inputErrorBorder: Colors.light.inputErrorBorder,
      inputDisabledBackground: Colors.light.inputDisabledBackground,
      inputDisabledText: Colors.light.inputDisabledText,
      placeholder: Colors.light.placeholder,
      
      // Button System Colors (Light Mode)
      buttonPrimary: Colors.light.buttonPrimary,
      buttonPrimaryText: Colors.light.buttonPrimaryText,
      buttonPrimaryHover: Colors.light.buttonPrimaryHover,
      buttonPrimaryPressed: Colors.light.buttonPrimaryPressed,
      buttonPrimaryDisabled: Colors.light.buttonPrimaryDisabled,
      buttonPrimaryDisabledText: Colors.light.buttonPrimaryDisabledText,
      buttonSecondary: Colors.light.buttonSecondary,
      buttonSecondaryBorder: Colors.light.buttonSecondaryBorder,
      buttonSecondaryText: Colors.light.buttonSecondaryText,
      buttonSecondaryHover: Colors.light.buttonSecondaryHover,
      buttonSecondaryPressed: Colors.light.buttonSecondaryPressed,
      buttonDanger: Colors.light.buttonDanger,
      buttonDangerText: Colors.light.buttonDangerText,
      
      // Toggle Switch Colors (Light Mode) - Green = ON
      toggleOffTrack: Colors.light.toggleOffTrack,
      toggleOffKnob: Colors.light.toggleOffKnob,
      toggleOnTrack: Colors.light.toggleOnTrack, // #4CAF50 - Green for ON
      toggleOnKnob: Colors.light.toggleOnKnob,
      toggleDisabledTrack: Colors.light.toggleDisabledTrack,
      toggleDisabledKnob: Colors.light.toggleDisabledKnob,
    };
  }, [isDark]);
}

