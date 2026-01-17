/**
 * Bee Logistics Color Palette
 * Brand Color: Primary Brand Yellow #FFCD36
 */

import { Platform } from 'react-native';

// Primary Brand Yellow: #FFCD36
export const BRAND_YELLOW = '#FFCD36';

export const BeeColors = {
  yellow: {
    50: '#fefce8',
    100: '#fef9c3',
    400: BRAND_YELLOW, // Primary Brand Yellow #FFCD36
    500: '#eab308',
    600: '#ca8a04',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
    600: '#d97706',
    800: '#92400e',
  },
  blue: {
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  white: '#ffffff',
  black: '#000000',
};

const tintColorLight = BRAND_YELLOW;
const tintColorDark = BRAND_YELLOW;

export const Colors = {
  light: {
    // Backgrounds
    // App Background: #FFFFFF
    background: '#FFFFFF',
    // Cards / Panels: #F7F7F7
    card: '#F7F7F7',
    surface: '#F7F7F7',
    // Modal / Surface: #FFFFFF
    modal: '#FFFFFF',
    // Borders / Dividers: #E0E0E0
    border: '#E0E0E0',
    
    // Text
    // Primary Text: #212121
    text: '#212121',
    // Secondary Text: #616161
    textSecondary: '#616161',
    textMuted: '#616161',
    icon: '#616161',
    // Disabled Text: #9E9E9E
    textDisabled: '#9E9E9E',
    // Placeholder: #9E9E9E
    placeholder: '#9E9E9E',
    // Links / Active: #FFCD36
    link: BRAND_YELLOW,
    
    // Primary Brand / Accent: #FFCD36
    primary: BRAND_YELLOW,
    primaryText: '#212121',
    tint: tintColorLight,
    tabIconDefault: '#616161',
    tabIconSelected: BRAND_YELLOW,
    
    // Status colors
    success: '#4CAF50', // Green for ON/enabled/active
    error: '#F44336',
    warning: '#FF9800',
    
    // Form Inputs
    inputBackground: '#FFFFFF',
    inputBorder: '#E0E0E0',
    inputText: '#212121',
    inputPlaceholder: '#9E9E9E',
    inputFocusBorder: BRAND_YELLOW,
    inputErrorBorder: '#F44336',
    inputDisabledBackground: '#F5F5F5',
    inputDisabledText: '#9E9E9E',
    
    // Button System Colors
    buttonPrimary: BRAND_YELLOW,
    buttonPrimaryText: '#212121',
    buttonPrimaryHover: '#F2C200',
    buttonPrimaryPressed: '#E6B800',
    buttonPrimaryDisabled: '#FFE799',
    buttonPrimaryDisabledText: '#9E9E9E',
    buttonSecondary: '#FFFFFF',
    buttonSecondaryBorder: '#E0E0E0',
    buttonSecondaryText: '#212121',
    buttonSecondaryHover: '#F5F5F5',
    buttonSecondaryPressed: '#EEEEEE',
    buttonDanger: '#F44336',
    buttonDangerText: '#FFFFFF',
    
    // Toggle Switch Colors (Green = ON)
    toggleOffTrack: '#E0E0E0',
    toggleOffKnob: '#FFFFFF',
    toggleOnTrack: '#4CAF50', // Green for ON
    toggleOnKnob: '#FFFFFF',
    toggleDisabledTrack: '#F5F5F5',
    toggleDisabledKnob: '#BDBDBD',
  },
  dark: {
    // Backgrounds
    // App Background: #121212
    background: '#121212',
    // Cards / Panels: #1E1E1E
    card: '#1E1E1E',
    surface: '#1E1E1E',
    // Modal / Surface: #212121
    modal: '#212121',
    // Borders / Dividers: #2E2E2E
    border: '#2E2E2E',
    
    // Text
    // Primary Text: #FFFFFF
    text: '#FFFFFF',
    // Secondary Text: #BDBDBD
    textSecondary: '#BDBDBD',
    textMuted: '#BDBDBD',
    icon: '#BDBDBD',
    // Disabled Text: #757575
    textDisabled: '#757575',
    // Placeholder: #757575
    placeholder: '#757575',
    // Links / Active: #FFCD36
    link: BRAND_YELLOW,
    
    // Primary Brand / Accent: #FFCD36
    primary: BRAND_YELLOW,
    primaryText: '#121212',
    tint: tintColorDark,
    tabIconDefault: '#BDBDBD',
    tabIconSelected: BRAND_YELLOW,
    
    // Status colors
    success: '#8BC34A', // Green for ON/enabled/active
    error: '#EF5350',
    warning: '#FFA726',
    
    // Form Inputs
    inputBackground: '#1E1E1E',
    inputBorder: '#2E2E2E',
    inputText: '#FFFFFF',
    inputPlaceholder: '#757575',
    inputFocusBorder: BRAND_YELLOW,
    inputErrorBorder: '#EF5350',
    inputDisabledBackground: '#2A2A2A',
    inputDisabledText: '#757575',
    
    // Button System Colors
    buttonPrimary: BRAND_YELLOW,
    buttonPrimaryText: '#121212',
    buttonPrimaryHover: '#F2C200',
    buttonPrimaryPressed: '#E6B800',
    buttonPrimaryDisabled: '#665500',
    buttonPrimaryDisabledText: '#BDBDBD',
    buttonSecondary: '#212121',
    buttonSecondaryBorder: '#2E2E2E',
    buttonSecondaryText: '#FFFFFF',
    buttonSecondaryHover: '#2A2A2A',
    buttonSecondaryPressed: '#2A2A2A',
    buttonDanger: '#EF5350',
    buttonDangerText: '#FFFFFF',
    
    // Toggle Switch Colors (Green = ON)
    toggleOffTrack: '#2A2A2A',
    toggleOffKnob: '#BDBDBD',
    toggleOnTrack: '#8BC34A', // Green for ON
    toggleOnKnob: '#121212',
    toggleDisabledTrack: '#2A2A2A',
    toggleDisabledKnob: '#757575',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

