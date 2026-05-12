export const Colors = {
  dark: {
    background: '#050B14',
    card: '#0F172A',
    cardBorder: '#1E293B',
    text: '#F1F5F9',
    textDim: '#94A3B8',
    textMuted: '#64748B',
    textHighlight: '#38BDF8',
    accent: '#1D4ED8',
    accentLight: '#38BDF8',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    statusBarStyle: 'light' as const,
  },
  light: {
    background: '#F1F5F9',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    text: '#0F172A',
    textDim: '#475569',
    textMuted: '#94A3B8',
    textHighlight: '#0284C7',
    accent: '#2563EB',
    accentLight: '#0EA5E9',
    inputBg: '#F8FAFC',
    statusBarStyle: 'dark' as const,
  }
};

export type ThemeType = 'dark' | 'light';
