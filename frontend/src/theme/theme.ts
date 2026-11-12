import { createTheme, Theme } from '@mui/material/styles';
import { ThemePresetId } from '../store/themeSlice';

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  emoji: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  paper: string;
  gradient: string;
  sidebarBg: string;
  appBarBg: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'dark-navy',
    label: 'Dark Navy',
    emoji: '🌌',
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#6366f1',
    bg: '#070a13',
    paper: '#111827',
    gradient: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    sidebarBg: '#070a13',
    appBarBg: 'rgba(7,10,19,0.88)',
  },
  {
    id: 'purple-galaxy',
    label: 'Purple Galaxy',
    emoji: '🔮',
    primary: '#a855f7',
    secondary: '#ec4899',
    accent: '#8b5cf6',
    bg: '#0d0518',
    paper: '#180c2e',
    gradient: 'linear-gradient(135deg,#a855f7,#ec4899)',
    sidebarBg: '#0d0518',
    appBarBg: 'rgba(13,5,24,0.88)',
  },
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    emoji: '🌊',
    primary: '#06b6d4',
    secondary: '#3b82f6',
    accent: '#0ea5e9',
    bg: '#030d17',
    paper: '#0c1a2b',
    gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)',
    sidebarBg: '#030d17',
    appBarBg: 'rgba(3,13,23,0.88)',
  },
  {
    id: 'forest-green',
    label: 'Forest Green',
    emoji: '🌿',
    primary: '#10b981',
    secondary: '#06b6d4',
    accent: '#14b8a6',
    bg: '#020f0a',
    paper: '#071a10',
    gradient: 'linear-gradient(135deg,#10b981,#06b6d4)',
    sidebarBg: '#020f0a',
    appBarBg: 'rgba(2,15,10,0.88)',
  },
  {
    id: 'crimson-red',
    label: 'Crimson Red',
    emoji: '🔴',
    primary: '#ef4444',
    secondary: '#f97316',
    accent: '#f43f5e',
    bg: '#0f0406',
    paper: '#1c0808',
    gradient: 'linear-gradient(135deg,#ef4444,#f97316)',
    sidebarBg: '#0f0406',
    appBarBg: 'rgba(15,4,6,0.88)',
  },
  {
    id: 'slate-pro',
    label: 'Slate Pro',
    emoji: '⚡',
    primary: '#64748b',
    secondary: '#94a3b8',
    accent: '#7c8fa6',
    bg: '#0a0c10',
    paper: '#131720',
    gradient: 'linear-gradient(135deg,#64748b,#94a3b8)',
    sidebarBg: '#0a0c10',
    appBarBg: 'rgba(10,12,16,0.88)',
  },
  {
    id: 'amber-gold',
    label: 'Amber Gold',
    emoji: '✨',
    primary: '#f59e0b',
    secondary: '#f97316',
    accent: '#eab308',
    bg: '#0f0c02',
    paper: '#1a1505',
    gradient: 'linear-gradient(135deg,#f59e0b,#f97316)',
    sidebarBg: '#0f0c02',
    appBarBg: 'rgba(15,12,2,0.88)',
  },
];

export function getPreset(id: ThemePresetId): ThemePreset {
  return THEME_PRESETS.find(p => p.id === id) || THEME_PRESETS[0];
}

export function buildMuiTheme(preset: ThemePreset): Theme {
  return createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: preset.primary,
        contrastText: '#ffffff',
      },
      secondary: {
        main: preset.secondary,
        contrastText: '#ffffff',
      },
      background: {
        default: preset.bg,
        paper: preset.paper,
      },
      text: {
        primary: '#f8fafc',
        secondary: '#94a3b8',
      },
      success: { main: '#10b981' },
      warning: { main: '#f59e0b' },
      error:   { main: '#ef4444' },
      info:    { main: '#06b6d4' },
      divider: 'rgba(255,255,255,0.08)',
    },
    typography: {
      fontFamily: '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      h1: { fontFamily: 'Outfit,sans-serif', fontWeight: 800 },
      h2: { fontFamily: 'Outfit,sans-serif', fontWeight: 700 },
      h3: { fontFamily: 'Outfit,sans-serif', fontWeight: 700 },
      h4: { fontFamily: 'Outfit,sans-serif', fontWeight: 600 },
      h5: { fontFamily: 'Outfit,sans-serif', fontWeight: 600 },
      h6: { fontFamily: 'Outfit,sans-serif', fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
            transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: `0 4px 12px ${preset.primary}44`,
              transform: 'translateY(-1px)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            background: `linear-gradient(135deg,${preset.paper}cc,${preset.bg}99)`,
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 8px 32px 0 rgba(0,0,0,0.37)',
            padding: '16px',
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  });
}
