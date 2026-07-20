export const colors = {
  ink: '#172033',
  inkMuted: '#667085',
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  line: '#E1E6EC',
  brand: '#2563EB',
  brandDark: '#1746A2',
  brandSoft: '#EAF1FF',
  success: '#148E68',
  successDark: '#0D654B',
  successSoft: '#DDF3EA',
  blue: '#246BFD',
  blueSoft: '#E8EFFF',
  amber: '#B86B00',
  amberSoft: '#FFF1D6',
  danger: '#B33A3A',
  dangerSoft: '#FCE7E7',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const shadow = {
  card: { shadowColor: '#172033', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
} as const;

export const type = {
  hero: { fontSize: 34, lineHeight: 39, fontWeight: '800' as const, letterSpacing: -1.1 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 18, lineHeight: 23, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const },
} as const;
