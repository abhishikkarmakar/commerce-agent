import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    // Fetch products from Supabase
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, base_price_paisa, emoji')

    if (error || !products?.length) {
      return NextResponse.json({ success: false, error: 'No products found' })
    }

    const index = pinecone.index(process.env.PINECONE_INDEX_NAME ?? 'products')

    // Create embeddings for all products
    const vectors = await Promise.all(
      products.map(async (p) => {
        const text = `${p.name} ${p.emoji} food item priced at ${p.base_price_paisa / 100} rupees`
        const res = await openai.embeddings.create({
          model: 'text-embedding-3-large',
          input: [text],
          dimensions: 1024,
        })
        return {
          id: p.id,
          values: res.data[0].embedding,
          metadata: {
            name: p.name,
            base_price_paisa: p.base_price_paisa,
            emoji: p.emoji,
          }
        }
      })
    )

    // Upsert to Pinecone
    await index.upsert({
      records: vectors.map(v => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata
      }))
    } as Parameters<typeof index.upsert>[0])

    return NextResponse.json({
      success: true,
      message: `✅ Seeded ${vectors.length} products into Pinecone`
    })

  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ success: false, error: String(error) })
  }
}