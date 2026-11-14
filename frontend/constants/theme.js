export const COLORS = {
  // Brand accents (Clean, modern civic green/teal & trust blue)
  primary: '#0d9488', // Teal 600
  primaryDark: '#0f766e', // Teal 700
  primaryLight: '#ccfbf1', // Teal 100
  secondary: '#0284c7', // Sky 600
  secondaryLight: '#e0f2fe',

  // Neutrals
  background: '#f8fafc', // Slate 50
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9', // Slate 100
  text: '#0f172a', // Slate 900
  textSecondary: '#64748b', // Slate 500
  textMuted: '#94a3b8', // Slate 400
  border: '#e2e8f0', // Slate 200
  borderDark: '#cbd5e1',

  // Status Colors (Matching backend status values)
  pending: '#d97706', // Amber 600
  pendingBg: '#fef3c7', // Amber 100
  pendingBorder: '#fde68a',

  inProgress: '#2563eb', // Blue 600
  inProgressBg: '#dbeafe', // Blue 100
  inProgressBorder: '#bfdbfe',

  resolved: '#059669', // Emerald 600
  resolvedBg: '#d1fae5', // Emerald 100
  resolvedBorder: '#a7f3d0',

  danger: '#dc2626', // Red 600
  dangerBg: '#fee2e2', // Red 100
  dangerBorder: '#fca5a5',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};

export const SHADOW = {
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
};
