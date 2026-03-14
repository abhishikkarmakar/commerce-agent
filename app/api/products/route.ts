import { NextRequest, NextResponse } from 'next/server'
import { products as defaultProducts } from '@/lib/products'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('No supabase')
    const { data, error } = await supabase.from('products').select('*')
    if (error) throw error
    if (!data || data.length === 0) return NextResponse.json({ products: defaultProducts })
    return NextResponse.json({ products: data })
  } catch (err) {
    console.warn('Products GET fallback to defaults', err)
    return NextResponse.json({ products: defaultProducts })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const products = body.products
    if (!products || !Array.isArray(products)) return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 })

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // No supabase configured: return success but do not persist
      return NextResponse.json({ success: true })
    }

    // upsert by id
    const { data, error } = await supabase.from('products').upsert(products)
    if (error) throw error
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Products POST error', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
