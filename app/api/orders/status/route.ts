import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    try {
        const orderId = req.nextUrl.searchParams.get('order_id')

        if (!orderId) {
            return NextResponse.json({ status: 'FAILED', error: 'No order_id' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('status')
            .eq('id', orderId)
            .single()

        if (error || !data) {
            console.warn(`⚠️ Order ${orderId} not found:`, error)
            return NextResponse.json({ status: 'PENDING' })
        }

        return NextResponse.json({ status: data.status })

    } catch (e) {
        console.error('❌ Order status check error:', e)
        return NextResponse.json({ status: 'PENDING' })
    }
}
