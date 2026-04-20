import { theme as antdTheme } from 'antd'

export const getThemeConfig = (dark: boolean) => ({
  algorithm: dark
    ? antdTheme.darkAlgorithm
    : antdTheme.defaultAlgorithm,

  token: {
    colorPrimary: '#b6462f',
    borderRadius: 12,
  },
})