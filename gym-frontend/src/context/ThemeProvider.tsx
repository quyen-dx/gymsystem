import { ConfigProvider, theme } from 'antd'
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext<any>(null)

export const useTheme = () => useContext(ThemeContext)

export default function ThemeProvider({ children }: any) {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    if (saved !== null) return saved === 'dark'
    return true // mặc định dark
  })

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      <ConfigProvider
        theme={{
          algorithm: dark
            ? theme.darkAlgorithm
            : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#b6462f',
            borderRadius: 12,
            colorBgLayout: dark ? '#0f0f0f' : '#f6f2ec',
            colorBgContainer: dark ? '#171717' : '#fffaf4',
            colorText: dark ? '#f3efe8' : '#241b16',
            colorTextSecondary: dark ? '#b8afa3' : '#6f6258',
            colorBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(89,55,38,0.14)',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
