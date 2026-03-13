export type OrderItem = {
  name: string
  quantity: number
  subtotal: number
  emoji: string
}

export type Order = {
  orderId: string
  customerName: string
  orderItems: OrderItem[]
  total: number
  paymentLink: string
  status: 'PENDING' | 'PAID' | 'FAILED'
  createdAt: string
}
