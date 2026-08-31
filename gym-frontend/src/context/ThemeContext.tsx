import { TinyColor } from '@ctrl/tinycolor'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface ThemeTokens {
  // Base tokens
  bg: string
  page: string
  card: string
  elevated: string
  inputBg: string
  text: string
  muted: string
  soft: string
  border: string
  borderStrong: string
  placeholder: string

  // Accent tokens
  accent: string
  buttonBg: string
  buttonText: string
  buttonBorder: string
  buttonShadow: string
  activeBg: string
  activeText: string
  outlineText: string
  outlineBorder: string
  outlineHoverBg: string

  // Legacy support (to be cleaned up later if needed)
  accentHover: string
  accentMuted: string
  accentBorder: string
  accentFill: string
  accentHoverBorder: string
  safeAccent: string
}

interface ThemeContextType {
  tokens: ThemeTokens
  accentColor: string
  applyTheme: (hex: string) => void
  applyAccentFast: (hex: string) => void
  applyThemeFull: (hex: string) => void
  applyThemeMode: (mode: 'dark' | 'light') => void
  commitPending: () => void
  themeKey: number
  dark: boolean
  toggleTheme: () => void
}

export const DEFAULT_ACCENT_COLOR = '#e05a30'

export const PRESET_ACCENT_COLORS = [
  { color: '#e05a30', label: 'Cam - mặc định' },
  { color: '#2563eb', label: 'Xanh dương' },
  { color: '#16a34a', label: 'Xanh lá' },
  { color: '#7c3aed', label: 'Tím' },
  { color: '#db2777', label: 'Hồng' },
  { color: '#b45309', label: 'Vàng đất' },
  { color: '#ffffff', label: 'Trắng' },
  { color: '#000000', label: 'Đen' },
]

const ThemeContext = createContext<ThemeContextType | null>(null)

export const detectColorType = (hex: string): 'white' | 'black' | 'normal' => {
  const c = new TinyColor(hex)
  if (!c.isValid) return 'normal'
  const normalized = c.toHexString().toLowerCase()
  if (normalized === '#ffffff') return 'white'
  if (normalized === '#000000') return 'black'

  const hsv = c.toHsv()
  if (hsv.v > 0.96 && hsv.s < 0.05) return 'white'
  if (hsv.v < 0.08) return 'black'

  return 'normal'
}

export const getContrastText = (bgColor: string): string => {
  const c = new TinyColor(bgColor)
  return c.isLight() ? '#111111' : '#FFFFFF'
}

export const resolveEffectiveTheme = (
  systemTheme: 'light' | 'dark',
  userThemePreference?: 'system' | 'light' | 'dark',
): 'light' | 'dark' => {
  if (userThemePreference === 'light') return 'light'
  if (userThemePreference === 'dark') return 'dark'
  return systemTheme === 'light' ? 'light' : 'dark'
}

const LIGHT_BASE: Partial<ThemeTokens> = {
  // Use layered neutral surfaces instead of pure white everywhere. This keeps
  // the light theme calm while retaining clear boundaries between page, cards
  // and form controls.
  bg: '#E7ECF2',
  page: '#DDE5EE',
  card: '#F8FAFC',
  elevated: '#EEF2F6',
  inputBg: '#F6F8FB',
  text: '#172033',
  muted: '#5B667A',
  soft: '#7B879A',
  border: '#C8D2DF',
  borderStrong: '#A8B6C8',
  placeholder: '#8A94A6',
}

const DARK_BASE: Partial<ThemeTokens> = {
  bg: '#000000',
  page: '#050506',
  card: '#101014',
  elevated: '#17181D',
  inputBg: '#15161B',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.68)',
  soft: 'rgba(255,255,255,0.45)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.26)',
  placeholder: 'rgba(255,255,255,0.35)',
}

export const resolveBaseTokens = (mode: 'dark' | 'light'): Partial<ThemeTokens> => {
  return mode === 'light' ? LIGHT_BASE : DARK_BASE
}

export const resolveAccentTokens = (accentColor: string, mode: 'dark' | 'light'): Partial<ThemeTokens> => {
  const type = detectColorType(accentColor)

  if (type === 'normal') {
    const accent = new TinyColor(accentColor)
    const outlineBorder = accent.clone().setAlpha(0.35).toRgbString()
    const outlineHoverBg = accent.clone().setAlpha(0.08).toRgbString()
    const contrastText = getContrastText(accentColor)
    const isLightMode = mode === 'light'

    return {
      accent: accentColor,
      buttonBg: accentColor,
      buttonText: contrastText,
      buttonBorder: accentColor,
      buttonShadow: 'none',
      activeBg: isLightMode ? accent.clone().setAlpha(0.14).toRgbString() : accentColor,
      activeText: isLightMode ? accent.clone().darken(8).toHexString() : contrastText,
      outlineText: accentColor,
      outlineBorder,
      outlineHoverBg,

      // Legacy
      accentHover: accent.clone().darken(10).toHexString(),
      accentMuted: accent.clone().setAlpha(mode === 'light' ? 0.14 : 0.22).toRgbString(),
      accentBorder: accent.clone().setAlpha(0.3).toRgbString(),
      accentFill: accentColor,
      accentHoverBorder: accentColor,
      safeAccent: accentColor,
    }
  }

  if (mode === 'light') {
    return {
      accent: accentColor,
      buttonBg: '#111111',
      buttonText: '#FFFFFF',
      buttonBorder: '#111111',
      buttonShadow: 'none',
      activeBg: '#111111',
      activeText: '#FFFFFF',
      outlineText: '#111111',
      outlineBorder: 'rgba(0,0,0,0.35)',
      outlineHoverBg: 'rgba(0,0,0,0.06)',

      // Legacy
      accentHover: '#000000',
      accentMuted: 'rgba(0,0,0,0.08)',
      accentBorder: 'rgba(0,0,0,0.2)',
      accentFill: '#111111',
      accentHoverBorder: '#000000',
      safeAccent: '#111111',
    }
  }

  return {
    accent: accentColor,
    buttonBg: '#FFFFFF',
    buttonText: '#111111',
    buttonBorder: '#FFFFFF',
    buttonShadow: 'none',
    activeBg: '#FFFFFF',
    activeText: '#111111',
    outlineText: '#FFFFFF',
    outlineBorder: 'rgba(255,255,255,0.45)',
    outlineHoverBg: 'rgba(255,255,255,0.10)',

    // Legacy
    accentHover: '#f0f0f0',
    accentMuted: 'rgba(255,255,255,0.12)',
    accentBorder: 'rgba(255,255,255,0.3)',
    accentFill: '#FFFFFF',
    accentHoverBorder: '#FFFFFF',
    safeAccent: '#FFFFFF',
  }
}

export const generateTheme = (accentColor: string, mode: 'dark' | 'light' = 'dark'): ThemeTokens => {
  const base = resolveBaseTokens(mode)
  const accent = resolveAccentTokens(accentColor, mode)

  return {
    ...base,
    ...accent,
  } as ThemeTokens
}

const setThemeVariables = (tokens: ThemeTokens, mode: 'dark' | 'light') => {
  const r = document.documentElement.style
  const isDarkMode = mode === 'dark'

  // Base tokens
  r.setProperty('--gs-bg', tokens.bg)
  r.setProperty('--gs-page', tokens.page)
  r.setProperty('--gs-card', tokens.card)
  r.setProperty('--gs-elevated', tokens.elevated)
  r.setProperty('--gs-bg-elevated', tokens.elevated)
  r.setProperty('--gs-bg-soft', tokens.card)
  r.setProperty('--gs-bg-subtle', isDarkMode ? 'rgba(255,255,255,0.055)' : '#EEF1F6')
  r.setProperty('--gs-active-bg', isDarkMode ? 'rgba(255,255,255,0.08)' : tokens.accentMuted)
  r.setProperty('--gs-shadow', isDarkMode ? '0 12px 30px rgba(0,0,0,0.22)' : '0 8px 24px rgba(15,23,42,0.07)')
  r.setProperty('--gs-input-bg', tokens.inputBg)
  r.setProperty('--gs-text', tokens.text)
  r.setProperty('--gs-muted', tokens.muted)
  r.setProperty('--gs-text-muted', tokens.muted)
  r.setProperty('--gs-soft', tokens.soft)
  r.setProperty('--gs-text-soft', tokens.soft)
  r.setProperty('--gs-border', tokens.border)
  r.setProperty('--gs-border-strong', tokens.borderStrong)
  r.setProperty('--gs-placeholder', tokens.placeholder)
  r.setProperty('--text-primary', tokens.text)

  // Accent tokens
  r.setProperty('--theme-accent', tokens.accent)
  r.setProperty('--accent-color', tokens.accent)
  r.setProperty('--theme-button-bg', tokens.buttonBg)
  r.setProperty('--theme-button-text', tokens.buttonText)
  r.setProperty('--theme-button-border', tokens.buttonBorder)
  r.setProperty('--theme-button-shadow', tokens.buttonShadow)
  r.setProperty('--theme-active-bg', tokens.activeBg)
  r.setProperty('--theme-active-text', tokens.activeText)
  r.setProperty('--theme-outline-text', tokens.outlineText)
  r.setProperty('--theme-outline-border', tokens.outlineBorder)
  r.setProperty('--theme-outline-hover-bg', tokens.outlineHoverBg)

  // Legacy & Compatibility
  r.setProperty('--theme-safe-accent', tokens.safeAccent)
  r.setProperty('--theme-accent-hover', tokens.accentHover)
  r.setProperty('--theme-accent-fill', tokens.accentFill)
  r.setProperty('--theme-accent-hover-border', tokens.accentHoverBorder)
  r.setProperty('--theme-accent-muted', tokens.accentMuted)
  r.setProperty('--theme-accent-border', tokens.accentBorder)
  r.setProperty('--theme-bg', tokens.bg)
  r.setProperty('--theme-card', tokens.card)
  r.setProperty('--theme-elevated', tokens.elevated)
  r.setProperty('--theme-border', tokens.border)
  r.setProperty('--theme-text', tokens.text)
  r.setProperty('--theme-muted', tokens.muted)
  r.setProperty('--theme-placeholder', tokens.placeholder)
  r.setProperty('--theme-input-bg', tokens.inputBg)
  r.setProperty('--gs-panel', tokens.card)
  r.setProperty('--gs-panel-strong', tokens.elevated)
  r.setProperty('--gs-accent', tokens.accent)
  r.setProperty('--gs-accent-soft', tokens.accentMuted)

  // Specific sections
  r.setProperty('--theme-nav-active-bg', tokens.activeBg)
  r.setProperty('--theme-nav-active-text', tokens.activeText)
  r.setProperty('--theme-nav-active-border', tokens.outlineBorder)

  r.setProperty('--profile-side-active-bg', tokens.activeBg)
  r.setProperty('--profile-side-active-text', tokens.activeText)
  r.setProperty('--profile-side-active-border', tokens.activeBg)
  r.setProperty('--profile-side-hover-bg', isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
  r.setProperty('--profile-side-inactive-text', tokens.muted)

  r.setProperty('--hero-text', tokens.text)
  r.setProperty('--hero-muted', tokens.muted)
  r.setProperty('--hero-outline-text', tokens.outlineText)
  r.setProperty('--hero-outline-border', tokens.outlineBorder)
  r.setProperty('--hero-outline-hover-bg', tokens.outlineHoverBg)

  document.body.style.setProperty('background-color', tokens.bg, 'important')
  document.body.style.setProperty('color', tokens.text, 'important')
  document.getElementById('root')?.style.setProperty('background-color', tokens.bg, 'important')
  document.getElementById('root')?.style.setProperty('color', tokens.text, 'important')

  document.documentElement.setAttribute('data-theme', mode)
  if (mode === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const savedAccent = localStorage.getItem('gymAccentColor') || DEFAULT_ACCENT_COLOR
  const savedMode = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'

  const [accentColor, setAccentColor] = useState(savedAccent)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(savedMode)
  const [tokens, setTokens] = useState<ThemeTokens>(generateTheme(savedAccent, savedMode))
  const [themeKey, setThemeKey] = useState(0)

  const pendingAccentRef = useRef(savedAccent)
  const accentColorRef = useRef(savedAccent)
  const themeModeRef = useRef<'dark' | 'light'>(savedMode)

  const applyAccentFast = (hex: string) => {
    pendingAccentRef.current = hex
    localStorage.setItem('gymAccentColor', hex)
    // For fast preview, we just regenerate tokens and set them
    const tempTokens = generateTheme(hex, themeModeRef.current)
    setThemeVariables(tempTokens, themeModeRef.current)
  }

  const applyThemeFull = (hex: string) => {
    const nextAccent = new TinyColor(hex).isValid ? new TinyColor(hex).toHexString() : DEFAULT_ACCENT_COLOR
    pendingAccentRef.current = nextAccent
    accentColorRef.current = nextAccent
    setAccentColor(nextAccent)
    localStorage.setItem('gymAccentColor', nextAccent)

    const nextTokens = generateTheme(nextAccent, themeModeRef.current)
    setTokens(nextTokens)
    setThemeVariables(nextTokens, themeModeRef.current)
  }

  const applyThemeMode = (mode: 'dark' | 'light') => {
    if (themeModeRef.current === mode && tokens) {
      setThemeVariables(generateTheme(accentColorRef.current, mode), mode)
      return
    }
    themeModeRef.current = mode
    setThemeMode(mode)
    localStorage.setItem('theme', mode)

    const nextTokens = generateTheme(accentColorRef.current, mode)
    setTokens(nextTokens)
    setThemeVariables(nextTokens, mode)
    setThemeKey((key) => key + 1)
  }

  const applyTheme = applyThemeFull

  const commitPending = () => {
    applyThemeFull(pendingAccentRef.current)
  }

  const toggleTheme = () => {
    applyThemeMode(themeModeRef.current === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    setThemeVariables(tokens, themeMode)
  }, [])

  return (
    <ThemeContext.Provider value={{
      tokens,
      accentColor,
      applyTheme,
      applyAccentFast,
      applyThemeFull,
      applyThemeMode,
      commitPending,
      themeKey,
      dark: themeMode === 'dark',
      toggleTheme
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
