import { theme as antdTheme } from 'antd'

export const getThemeConfig = (dark: boolean) => ({
  algorithm: antdTheme.darkAlgorithm,

  token: {
    colorPrimary: dark ? '#b6462f' : '#e05a30',
    colorPrimaryHover: dark ? '#8f3423' : '#c94d26',
    borderRadius: dark ? 12 : 8,
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
  },
})
