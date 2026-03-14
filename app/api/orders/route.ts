import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toRupees } from '@/lib/products'

interface OrderRow {
  id: string
  customer_id: string
  total_paisa: number
  status: string
  created_at: string
  customers: { name: string } | null
  payments: Array<{ pine_labs_txn_id: string; status: string }> | null
}

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('No Supabase')

    // Query orders with joined customer and payment data
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        customer_id,
        total_paisa,
        status,
        created_at,
        customers(name),
        payments(pine_labs_txn_id, status)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform response with toRupees conversion
    const orders = ((data as unknown) as OrderRow[] || []).map((o) => ({
      id: o.id,
      customer_id: o.customer_id,
      customer_name: o.customers?.name || 'Guest',
      total_paisa: o.total_paisa,
      total: toRupees(o.total_paisa),
      status: o.status,
      txn_id: o.payments?.[0]?.pine_labs_txn_id || null,
      payment_status: o.payments?.[0]?.status || null,
      created_at: o.created_at
    }))

    const stats = {
      total: orders.length,
      paid: orders.filter(o => o.status === 'COMPLETED').length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      revenue: orders
        .filter(o => o.status === 'COMPLETED')
        .reduce((s, o) => s + toRupees(o.total_paisa), 0)
    }

    return NextResponse.json({ orders, stats })

  } catch (e) {
    console.error('❌ Supabase fetch failed:', e)
  }

  // Fallback to memory
  type OrderRec = { id: string; customer_id: string; total_paisa: number; status: string; created_at: string }
  const orders = (global.orders as OrderRec[] || []).map((o) => ({
    id: o.id,
    customer_id: o.customer_id,
    customer_name: 'Guest',
    total_paisa: o.total_paisa,
    total: toRupees(o.total_paisa),
    status: o.status,
    created_at: o.created_at
  }))

  const stats = {
    total: orders.length,
    paid: orders.filter(o => o.status === 'COMPLETED').length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    revenue: orders
      .filter(o => o.status === 'COMPLETED')
      .reduce((s, o) => s + o.total, 0)
  }

  return NextResponse.json({ orders: orders.slice().reverse(), stats })
}
