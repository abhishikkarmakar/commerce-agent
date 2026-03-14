import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Pine Labs sends form-encoded data not JSON
    const contentType = req.headers.get('content-type') || ''
    console.log('📨 Webhook content-type:', contentType)

    let orderId = ''
    let status = ''
    let txnId = ''

    if (contentType.includes('application/json')) {
      const body = await req.json()
      console.log('📨 Webhook JSON:', body)
      orderId = body.order_id || body.merchant_order_reference
      status = body.status || body.order_status
      txnId = body.txn_id || body.pine_pg_transaction_id

    } else {
      // Form-encoded or query string format
      const text = await req.text()
      console.log('📨 Webhook raw body:', text)

      const params = new URLSearchParams(text)
      orderId = params.get('order_id') ||
        params.get('merchant_order_reference') ||
        params.get('merchant_order_id') || ''
      status = params.get('status') ||
        params.get('order_status') || ''
      txnId = params.get('txn_id') ||
        params.get('pine_pg_transaction_id') || ''
    }

    console.log('📨 Parsed webhook:', { orderId, status, txnId })

    if (!orderId) {
      console.warn('⚠️ No order_id in webhook')
      // Redirect back to chat if no order ID
      return NextResponse.redirect(new URL('/', req.url))
    }

    const orderStatus = ['COMPLETED', 'SUCCESS', 'CHARGED'].includes(status?.toUpperCase())
      ? 'SUCCESS' : 'FAILED'

    // Update order status in Supabase
    await supabaseAdmin
      .from('orders')
      .update({ status: orderStatus })
      .eq('id', orderId)

    // Update payment status
    await supabaseAdmin
      .from('payments')
      .update({ status: orderStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED' })
      .eq('order_id', orderId)

    console.log(`✅ Order ${orderId} → ${orderStatus}`)

    // Redirect user to payment status page
    const statusUrl = new URL('/payment-status', req.url)
    statusUrl.searchParams.set('orderId', orderId)
    statusUrl.searchParams.set('status', orderStatus)
    return NextResponse.redirect(statusUrl)

  } catch (e) {
    console.error('❌ Webhook error:', e)
    // Redirect back to chat on error
    return NextResponse.redirect(new URL('/', req.url))
  }
}
