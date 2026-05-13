import { TinyColor } from '@ctrl/tinycolor'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ThemeTokens {
  bg: string
  card: string
  elevated: string
  border: string
  text: string
  muted: string
  placeholder: string
  inputBg: string
  accent: string
  safeAccent: string
  accentHover: string
  accentMuted: string
  accentBorder: string
  buttonText: string
}

interface ThemeContextType {
  tokens: ThemeTokens
  accentColor: string
  applyTheme: (hex: string) => void
  applyAccentFast: (hex: string) => void
  applyThemeFull: (hex: string) => void
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
]

const ThemeContext = createContext<ThemeContextType | null>(null)

const FIXED = {
  bg: '#09090b',
  card: '#111115',
  elevated: '#1a1a1f',
  border: 'rgba(255,255,255,0.08)',
  text: '#f2efe9',
  muted: 'rgba(242,239,232,0.5)',
  placeholder: 'rgba(242,239,232,0.3)',
  inputBg: '#1a1a1f',
}

export const generateTheme = (hex: string): ThemeTokens => {
  const accent = new TinyColor(hex)
  const lightness = accent.toHsl().l
  const safeAccent = lightness < 0.2
    ? accent.clone().lighten(30).toHexString()
    : lightness > 0.85
      ? accent.clone().darken(20).toHexString()
      : hex
  const safeAccentColor = new TinyColor(safeAccent)
  const buttonText = safeAccentColor.isLight() ? '#0a0a0a' : '#ffffff'
  const accentHover = safeAccentColor.clone().darken(10).toHexString()
  const accentMuted = safeAccentColor.clone().setAlpha(0.15).toRgbString()
  const accentBorder = safeAccentColor.clone().setAlpha(0.3).toRgbString()

  return {
    ...FIXED,
    accent: safeAccent,
    safeAccent,
    accentHover,
    buttonText,
    accentMuted,
    accentBorder,
  }
}

const setThemeVariables = (tokens: ThemeTokens) => {
  const r = document.documentElement.style
  r.setProperty('--theme-accent', tokens.accent)
  r.setProperty('--theme-safe-accent', tokens.safeAccent)
  r.setProperty('--theme-accent-hover', tokens.accentHover)
  r.setProperty('--theme-button-text', tokens.buttonText)
  r.setProperty('--theme-accent-muted', tokens.accentMuted)
  r.setProperty('--theme-accent-border', tokens.accentBorder)
  r.setProperty('--theme-bg', FIXED.bg)
  r.setProperty('--theme-card', FIXED.card)
  r.setProperty('--theme-elevated', FIXED.elevated)
  r.setProperty('--theme-border', FIXED.border)
  r.setProperty('--theme-border-strong', FIXED.border)
  r.setProperty('--theme-text', FIXED.text)
  r.setProperty('--theme-muted', FIXED.muted)
  r.setProperty('--theme-placeholder', FIXED.placeholder)
  r.setProperty('--theme-input-bg', FIXED.inputBg)
  r.setProperty('--gs-bg', FIXED.bg)
  r.setProperty('--gs-bg-elevated', FIXED.elevated)
  r.setProperty('--gs-bg-soft', FIXED.card)
  r.setProperty('--gs-panel', FIXED.card)
  r.setProperty('--gs-panel-strong', FIXED.elevated)
  r.setProperty('--gs-border', FIXED.border)
  r.setProperty('--gs-border-strong', FIXED.border)
  r.setProperty('--gs-text', FIXED.text)
  r.setProperty('--gs-text-muted', FIXED.muted)
  r.setProperty('--gs-text-soft', FIXED.muted)
  r.setProperty('--gs-accent', tokens.accent)
  document.body.style.backgroundColor = FIXED.bg
  document.body.style.color = FIXED.text
  document.getElementById('root')?.style.setProperty('background-color', FIXED.bg)
  document.getElementById('root')?.style.setProperty('color', FIXED.text)
}

const applyAccentVariablesFast = (hex: string) => {
  const accent = new TinyColor(hex)
  const lightness = accent.toHsl().l
  const safeHex = lightness < 0.2
    ? accent.clone().lighten(30).toHexString()
    : lightness > 0.85
      ? accent.clone().darken(20).toHexString()
      : hex
  const safeAccent = new TinyColor(safeHex)
  const buttonText = safeAccent.isLight() ? '#0a0a0a' : '#ffffff'
  const accentHover = safeAccent.clone().darken(10).toHexString()
  const accentMuted = safeAccent.clone().setAlpha(0.12).toRgbString()
  const accentBorder = safeAccent.clone().setAlpha(0.3).toRgbString()
  const r = document.documentElement.style

  r.setProperty('--theme-accent', safeHex)
  r.setProperty('--theme-safe-accent', safeHex)
  r.setProperty('--theme-accent-hover', accentHover)
  r.setProperty('--theme-button-text', buttonText)
  r.setProperty('--theme-accent-muted', accentMuted)
  r.setProperty('--theme-accent-border', accentBorder)
  r.setProperty('--gs-accent', safeHex)
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const saved = localStorage.getItem('gymAccentColor') || DEFAULT_ACCENT_COLOR
  const [accentColor, setAccentColor] = useState(saved)
  const [tokens, setTokens] = useState<ThemeTokens>(generateTheme(saved))
  const [themeKey] = useState(0)
  const pendingAccentRef = useRef(saved)
  const accentColorRef = useRef(saved)

  const applyAccentFast = (hex: string) => {
    pendingAccentRef.current = hex
    localStorage.setItem('gymAccentColor', hex)
    applyAccentVariablesFast(hex)
  }

  const applyThemeFull = (hex: string) => {
    const nextAccent = new TinyColor(hex).isValid ? new TinyColor(hex).toHexString() : DEFAULT_ACCENT_COLOR
    applyAccentFast(nextAccent)
    const nextTokens = generateTheme(nextAccent)
    setTokens(nextTokens)
    setAccentColor(nextAccent)
    accentColorRef.current = nextAccent
    localStorage.setItem('gymAccentColor', nextAccent)
    localStorage.setItem('theme', 'dark')
    setThemeVariables(nextTokens)
  }

  const applyTheme = applyThemeFull

  const commitPending = () => {
    const hex = pendingAccentRef.current
    if (hex === accentColorRef.current) return
    applyThemeFull(hex)
  }

  const toggleTheme = () => {
    applyTheme(accentColor === DEFAULT_ACCENT_COLOR ? '#3e3e3e' : DEFAULT_ACCENT_COLOR)
  }

  useEffect(() => {
    applyTheme(saved)
  }, [])

  return (
    <ThemeContext.Provider value={{ tokens, accentColor, applyTheme, applyAccentFast, applyThemeFull, commitPending, themeKey, dark: true, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
