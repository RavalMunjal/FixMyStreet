export const COLORS = {
  // Brand accents
  primary: '#0d9488',
  primaryDark: '#0f766e',
  primaryLight: '#ccfbf1',
  secondary: '#0284c7',
  secondaryLight: '#e0f2fe',

  // Neutrals
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderDark: '#cbd5e1',

  // Status Colors
  pending: '#d97706', // Reported / Pending
  pendingBg: '#fef3c7',
  pendingBorder: '#fde68a',

  underReview: '#7c3aed', // Under Review
  underReviewBg: '#ede9fe',
  underReviewBorder: '#ddd6fe',

  inProgress: '#2563eb', // In Progress
  inProgressBg: '#dbeafe',
  inProgressBorder: '#bfdbfe',

  resolved: '#059669', // Resolved
  resolvedBg: '#d1fae5',
  resolvedBorder: '#a7f3d0',

  danger: '#dc2626',
  dangerBg: '#fee2e2',
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
