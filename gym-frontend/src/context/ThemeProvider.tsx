import { ConfigProvider, theme } from 'antd'
import { createContext, useContext, useState } from 'react'

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
          },
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}