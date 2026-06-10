export function getEstimatedDelivery(
  shopAddress?: { city?: string; district?: string } | null,
  userAddress?: { city?: string; district?: string } | null,
): string {
  const shopCity = shopAddress?.city?.trim()
  const userCity = userAddress?.city?.trim()

  if (!shopCity || !userCity) return 'Giao dự kiến: 2-4 ngày'
  if (shopCity.toLowerCase() === userCity.toLowerCase()) return 'Giao dự kiến: 1-2 ngày'
  return 'Giao dự kiến: 3-5 ngày'
}
