import type { ComponentType } from 'react'
import {
  AppstoreOutlined,
  CalendarOutlined,
  ShopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons'

export const MODULE_ICONS: Record<string, ComponentType<any>> = {
  finance: WalletOutlined,
  members: TeamOutlined,
  pt: ThunderboltOutlined,
  booking: CalendarOutlined,
  shop: ShopOutlined,
  system: AppstoreOutlined,
}
