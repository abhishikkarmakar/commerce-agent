import { NextResponse } from 'next/server'

export async function GET() {
  const orders = global.orders || []
  
  const stats = {
    total: orders.length,
    paid: orders.filter((o: any) => o.status === 'PAID').length,
    pending: orders.filter((o: any) => o.status === 'PENDING').length,
    revenue: orders
      .filter((o: any) => o.status === 'PAID')
      .reduce((sum: number, o: any) => sum + o.total, 0)
  }

  return NextResponse.json({ orders: orders.slice().reverse(), stats })
}
