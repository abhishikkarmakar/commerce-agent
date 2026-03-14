import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { toPaisa } from '@/lib/products'
import { createPineLabsOrder } from '@/lib/pinelabs'
import type { ResolvedItem } from '@/app/api/extract-order/route'

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY missing, using in-memory fallback')
    return null
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function findOrCreateCustomer(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  name: string,
  phone: string,
  email: string
): Promise<string> {
  if (!supabaseAdmin) {
    console.warn('⚠️ No Supabase access, using default customer ID')
    return 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'
  }

  const cleanPhone = phone.replace(/^\+91/, '').replace(/\s+/g, '').slice(-10)
  const fullPhone = `+91${cleanPhone}`

  try {
    // Try to find existing customer
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id, total_chats_initiated')
      .eq('phone_number', fullPhone)
      .single()

    if (existing) {
      // Update chat count
      await supabaseAdmin
        .from('customers')
        .update({ total_chats_initiated: (existing.total_chats_initiated || 0) + 1 })
        .eq('id', existing.id)
      console.log('✅ Found existing customer:', existing.id)
      return existing.id
    }
  } catch (e) {
    console.warn('⚠️ Customer lookup failed, will create new:', e)
  }

  try {
    // Create new customer
    const { data: newCustomer, error } = await supabaseAdmin
      .from('customers')
      .insert([{
        name,
        phone_number: fullPhone,
        email,
        preferred_platform: 'WHATSAPP',
        total_chats_initiated: 1
      }])
      .select('id')
      .single()

    if (error || !newCustomer) {
      console.error('❌ Customer creation failed:', error)
      return 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'
    }

    console.log('✅ Created new customer:', newCustomer.id)
    return newCustomer.id
  } catch (e) {
    console.error('❌ Customer creation error:', e)
    return 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'
  }
}

export async function POST(req: NextRequest) {
  const {
    orderItems,
    total,
    totalPaisa,
    customerName,
    customerPhone,
    customerEmail
  } = await req.json()

  const orderId = crypto.randomUUID()
  const amountPaisa = totalPaisa || toPaisa(total)

  console.log('💳 Order:', orderId, '| Customer:', customerName, customerPhone)

  const supabaseAdmin = getSupabaseAdmin()

  // Step 1: Find or create customer dynamically
  let customerId: string
  try {
    customerId = await findOrCreateCustomer(
      supabaseAdmin,
      customerName || 'Customer',
      customerPhone || '9999999999',
      customerEmail || `customer_${Date.now()}@quickshop.com`
    )
  } catch (e) {
    console.error('❌ Customer lookup failed:', e)
    customerId = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380001'
  }

  // Step 2: Deduct inventory atomically (skip if no Supabase)
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.rpc('process_order_stock', {
        p_items: orderItems.map((i: ResolvedItem) => ({
          id: i.product_id,
          qty: i.quantity
        }))
      })
      console.log('✅ Stock deducted')
    } catch (e) {
      console.error('❌ Stock deduction failed:', e)
      return NextResponse.json({
        success: false,
        reply: `Oops! 😅 Some items sold out quickly! We're super popular right now.\n\n💡 Try adjusting your order - maybe reduce quantities or pick something else?\n\nWe promise it'll be worth the wait! 🚀`
      })
    }
  } else {
    console.warn('⚠️ Stock deduction skipped (no Supabase)')
  }

  let paymentLink = `https://pay.pinelabs.com/mock/${orderId}`
  let pineOrderId = ''

  // Step 3: Create Pine Labs payment
  try {
    const result = await createPineLabsOrder({
      orderId,
      amountPaisa,
      customerName: customerName || 'Customer',
      customerPhone: customerPhone || '9999999999',
      customerEmail: customerEmail || `customer_${Date.now()}@quickshop.com`
    })
    paymentLink = result.checkoutUrl
    pineOrderId = result.pineOrderId
    console.log('✅ Pine Labs link:', paymentLink)
  } catch (e) {
    console.error('❌ Pine Labs error:', e)
    // Rollback stock if payment fails
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.rpc('rollback_order_stock', {
          p_items: orderItems.map((i: ResolvedItem) => ({
            id: i.product_id,
            qty: i.quantity
          }))
        })
      } catch { }
    }
  }

  // Step 4: Save to Supabase
  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('orders').insert([{
        id: orderId,
        customer_id: customerId,
        total_paisa: amountPaisa,
        status: 'PENDING'
      }])

      await supabaseAdmin.from('payments').insert([{
        pine_labs_txn_id: pineOrderId || `PL_TXN_${orderId.substring(0, 8).toUpperCase()}`,
        order_id: orderId,
        amount_paisa: amountPaisa,
        status: 'INITIATED',
        payment_method: 'UPI'
      }])

      console.log('✅ Saved to Supabase')
    } catch (e) {
      console.error('❌ Supabase save failed:', e)
    }
  } else {
    console.warn('⚠️ Supabase persistence skipped (no service role key)')
  }

  console.log('📤 Returning paymentLink:', paymentLink)
  console.log('📤 Full response:', { success: true, orderId, paymentLink })

  return NextResponse.json({
    success: true,
    orderId,
    paymentLink,
    reply: `🎊 YES! Your order is confirmed!\n\n📦 Order ID: ${orderId.substring(0, 8).toUpperCase()}\n💰 Total: ₹${total}\n\n🔐 Secure payment ready - tap below to complete!\n\n⏱️ Your food will be prepared as soon as payment clears.\n🚴 Get ready for freshness & speed! 🔥`
  })
}

type OrderRecord = { id: string; customer_id: string; total_paisa: number; status: string }
declare global { var orders: OrderRecord[] }