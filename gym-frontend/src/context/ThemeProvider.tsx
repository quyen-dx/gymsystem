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
          algorithm: theme.darkAlgorithm,
          token: {
            colorBgBase: dark ? '#0f0f0f' : '#3e3e3e',
            colorBgContainer: dark ? '#171717' : '#484848',
            colorBgElevated: dark ? '#202020' : '#525252',
            colorBgLayout: dark ? '#0f0f0f' : '#3e3e3e',
            colorBorder: dark ? 'rgba(255,255,255,0.08)' : '#5a5a5a',
            colorBorderSecondary: dark ? 'rgba(255,255,255,0.14)' : '#525252',
            colorText: dark ? '#f3efe8' : '#edebe6',
            colorTextSecondary: dark ? '#b8afa3' : 'rgba(237,235,230,0.55)',
            colorTextTertiary: dark ? '#8f877d' : 'rgba(237,235,230,0.35)',
            colorTextPlaceholder: dark ? 'rgba(243,239,232,0.3)' : 'rgba(237,235,230,0.3)',
            colorPrimary: dark ? '#b6462f' : '#e05a30',
            colorPrimaryHover: dark ? '#8f3423' : '#c94d26',
            borderRadius: dark ? 12 : 8,
          },
          components: dark ? undefined : ({
            Card: {
              colorBgContainer: '#484848',
              colorBorderSecondary: '#525252',
            },
            Input: {
              colorBgContainer: '#525252',
              colorBorder: '#5a5a5a',
              colorText: '#edebe6',
              colorTextPlaceholder: 'rgba(237,235,230,0.3)',
            },
            Select: {
              colorBgContainer: '#525252',
              colorBorder: '#5a5a5a',
              colorText: '#edebe6',
              optionSelectedBg: 'rgba(224,90,48,0.15)',
            },
            Modal: {
              colorBgElevated: '#484848',
              colorBorder: '#525252',
            },
            Table: {
              colorBgContainer: '#484848',
              headerBg: '#525252',
              rowHoverBg: '#505050',
              colorBorderSecondary: '#5a5a5a',
            },
            Menu: {
              colorBgContainer: '#3e3e3e',
              itemBg: '#3e3e3e',
              itemSelectedBg: 'rgba(224,90,48,0.15)',
              itemSelectedColor: '#e05a30',
              itemHoverBg: '#484848',
              colorText: '#edebe6',
            },
            Button: {
              colorBgContainer: '#525252',
              colorBorder: '#5a5a5a',
              colorText: '#edebe6',
              primaryColor: '#ffffff',
            },
            Tabs: {
              inkBarColor: '#e05a30',
              itemSelectedColor: '#e05a30',
              itemHoverColor: '#edebe6',
              colorBorderSecondary: '#525252',
            },
            Tag: {
              colorBgContainer: '#525252',
              colorBorder: '#5a5a5a',
              colorText: '#edebe6',
            },
            Dropdown: {
              colorBgElevated: '#484848',
              colorBorder: '#525252',
            },
            DatePicker: {
              colorBgContainer: '#525252',
              colorBorder: '#5a5a5a',
              colorText: '#edebe6',
            },
            Drawer: {
              colorBgElevated: '#484848',
            },
            Layout: {
              colorBgHeader: '#3e3e3e',
              colorBgBody: '#3e3e3e',
              colorBgSider: '#3e3e3e',
            },
          } as any),
        }}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
