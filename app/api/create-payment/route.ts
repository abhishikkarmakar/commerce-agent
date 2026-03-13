import { NextRequest, NextResponse } from 'next/server'
import { Order } from '@/lib/types'

export async function POST(req: NextRequest) {
  const { orderItems, total, customerName } = await req.json()

  // ---- MOCK payment link (replace with Pine Labs API on Friday) ----
  const orderId = `ORD-${Date.now()}`
  const mockPaymentLink = `https://pay.pinelabs.com/mock/${orderId}`
  // ------------------------------------------------------------------

  // Store order in memory (replace with DB later)
  const order: Order = {
    orderId,
    customerName: customerName || 'Customer',
    orderItems,
    total,
    paymentLink: mockPaymentLink,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  }

  // Save to global orders (temporary, works for demo)
  if (!global.orders) global.orders = []
  global.orders.push(order)

  return NextResponse.json({
    success: true,
    orderId,
    paymentLink: mockPaymentLink,
    reply: `✅ Order confirmed! Here's your secure payment link:\n\n🔗 ${mockPaymentLink}\n\nOrder ID: ${orderId}\nAmount: ₹${total}\n\nClick the link to complete your payment! 💳`
  })
}

// TypeScript fix for global
declare global {
  var orders: Order[]
}