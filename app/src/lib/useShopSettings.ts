import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { ShopSettings } from './types'

const DEFAULTS: ShopSettings = {
  id: true,
  shop_name: 'Red Solutions',
  address: '48303 115th Ave, Leigh NE 68643',
  labor_rate: 120,
  tax_rate: 0.055,
  low_stock_threshold: 3,
  notify_emails: [],
}

export function useShopSettings() {
  const [settings, setSettings] = useState<ShopSettings>(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('shop_settings')
      .select('*')
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setSettings(data as ShopSettings)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return settings
}
