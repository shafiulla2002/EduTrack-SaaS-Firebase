export const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#64748b',
    background: '#f8fafc',
    surface: '#ffffff',
    primary: '#4f46e5',
    primaryDark: '#4338ca',
    secondary: '#06b6d4',
    accent: '#8b5cf6',
    border: '#e2e8f0',
    tabIconDefault: '#94a3b8',
    tabIconSelected: '#4f46e5',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    cardBackground: '#ffffff',
    glassBorder: 'rgba(226, 232, 240, 0.8)',
    backgroundElement: '#f1f5f9',
    backgroundSelected: '#e2e8f0',
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    background: '#020617',
    surface: '#0f172a',
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    secondary: '#22d3ee',
    accent: '#a855f7',
    border: '#1e293b',
    tabIconDefault: '#64748b',
    tabIconSelected: '#6366f1',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    cardBackground: '#0f172a',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    backgroundElement: '#1e293b',
    backgroundSelected: '#334155',
  },
};

export type ThemeColor = keyof typeof Colors.light;
export const MaxContentWidth = 1200;
export const BottomTabInset = 80;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Fonts = {
  sans: 'System',
  mono: 'Courier',
};

export const BorderRadii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const BorderRadius = BorderRadii;

