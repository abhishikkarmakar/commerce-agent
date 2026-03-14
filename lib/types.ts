export type Product = {
  id: string          // UUID
  name: string
  base_price_paisa: number   // price in paise (divide by 100 for rupees)
  emoji: string
}

export type Customer = {
  id: string
  name: string
  phone_number: string
  email?: string
  preferred_platform: 'WHATSAPP' | 'TELEGRAM'
  total_chats_initiated: number
}

export type Order = {
  id: string
  customer_id: string
  total_paisa: number
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  created_at: string
}

export type Payment = {
  id: string
  pine_labs_txn_id: string
  order_id: string
  amount_paisa: number
  status: 'INITIATED' | 'SUCCESS' | 'FAILED'
  payment_method: 'UPI' | 'CARD' | 'NETBANKING'
  created_at: string
}

export type OrderItem = {
  name: string
  quantity: number
  emoji: string
  price_paisa: number
  subtotal_paisa: number
}