import { NextResponse } from 'next/server'
import { Order } from '@/lib/types'

export async function GET() {
  const orders: Order[] = global.orders || []
  
  const stats = {
    total: orders.length,
    paid: orders.filter((o: Order) => o.status === 'PAID').length,
    pending: orders.filter((o: Order) => o.status === 'PENDING').length,
    revenue: orders
      .filter((o: Order) => o.status === 'PAID')
      .reduce((sum: number, o: Order) => sum + o.total, 0)
  }

  return NextResponse.json({ orders: orders.slice().reverse(), stats })
}
