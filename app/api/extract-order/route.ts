import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { createClient } from '@supabase/supabase-js'
import { products as defaultProducts, Product, toRupees } from '@/lib/products'

// ── Clients ──────────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY missing, some features disabled')
    return null
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CHAT_MODEL = 'gpt-4o-mini'
const EMBED_MODEL = 'text-embedding-3-large'
const EMBED_DIMS = 1024
const SIMILARITY_THRESHOLD = 0.50
const TOP_K = 3

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedItem {
  raw_name: string
  quantity: number
}

export interface ResolvedItem {
  product_id: string
  name: string
  emoji: string
  quantity: number
  unit_price_paisa: number
  subtotal_paisa: number
  subtotal_rupees: number
  score: number
}

interface PineconeMatch {
  id: string
  score: number
  metadata: {
    name: string
    base_price_paisa: number
    emoji: string
  }
}


// ── Step 1: Extract items via GPT with json_object format ─────────────────────
async function extractItems(message: string): Promise<ParsedItem[]> {
  const resp = await openai.chat.completions.create({
    model: CHAT_MODEL,
    max_tokens: 512,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You extract order items from a customer message.
Return ONLY a JSON object: {"items": [{"raw_name": string, "quantity": number}]}
Rules:
- quantity >= 1, default to 1 if not mentioned
- normalise: "a"/"an"/"one"=1, "two"=2, "three"=3, "four"=4, "five"=5
- strip filler: "please", "want", "give me", "I'd like"
- if nothing looks like an order return {"items": []}
Example: "2 cheese burgers and a coke" → {"items":[{"raw_name":"cheese burger","quantity":2},{"raw_name":"coke","quantity":1}]}`
      },
      { role: 'user', content: message }
    ]
  })

  const text = resp.choices[0]?.message?.content ?? '{"items":[]}'
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    return []
  }
}

// ── Step 2: Embed text ────────────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: [text],
    dimensions: EMBED_DIMS,
  })
  return res.data[0].embedding
}

// ── Step 3: Search Pinecone ───────────────────────────────────────────────────
async function searchPinecone(vector: number[]): Promise<PineconeMatch[]> {
  const index = pinecone.Index(process.env.PINECONE_INDEX_NAME ?? 'products')
  const result = await index.query({
    vector,
    topK: TOP_K,
    includeMetadata: true,
  })
  return (result.matches ?? []) as unknown as PineconeMatch[]
}

// ── Step 4: Check inventory + get live price ──────────────────────────────────
async function checkInventory(
  productId: string,
  requestedQty: number
): Promise<number | null> {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    console.warn('⚠️ Inventory check unavailable')
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('current_price_paisa, stock_quantity')
    .eq('product_id', productId)
    .single()

  console.log('🏪 Inventory check:', { productId, data, error })

  if (error || !data) return null
  if ((data.stock_quantity as number ?? 0) < requestedQty) return null
  return data.current_price_paisa as number
}

// ── Step 5: Pairing recommendation ───────────────────────────────────────────
async function getPairingRecommendation(
  orderedNames: string[],
  allProducts: Product[]
): Promise<string> {
  const otherItems = allProducts
    .filter(p => !orderedNames.includes(p.name))
    .slice(0, 4)
    .map(p => `${p.emoji} ${p.name}`)
    .join(', ')

  if (!otherItems) return ''

  try {
    const resp = await openai.chat.completions.create({
      model: CHAT_MODEL,
      max_tokens: 60,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `Customer ordered: ${orderedNames.join(', ')}. Other available: ${otherItems}. Suggest 1 pairing in 1 friendly sentence. Return empty string if no good pairing.`
      }]
    })
    return resp.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return ''
  }
}

// ── Fallback: local keyword parser ───────────────────────────────────────────
function localParse(msg: string, productList: Product[]): ParsedItem[] {
  const lower = msg.toLowerCase()
  const numberWords: Record<string, number> = {
    'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5
  }
  const found: ParsedItem[] = []

  for (const p of productList) {
    const name = p.name.toLowerCase()
    let qty = 0
    const numMatch = lower.match(new RegExp(`(\\d+)\\s*${name}`))
    if (numMatch) qty = parseInt(numMatch[1])
    if (!qty) {
      for (const [w, n] of Object.entries(numberWords)) {
        if (lower.includes(`${w} ${name}`)) { qty = n; break }
      }
    }
    if (!qty && lower.includes(name)) qty = 1
    if (qty) found.push({ raw_name: p.name, quantity: qty })
  }
  return found
}

// ── Fetch products from Supabase ──────────────────────────────────────────────
async function fetchProducts(): Promise<Product[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    if (!supabaseAdmin) throw new Error('No Supabase')

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, name, base_price_paisa, emoji')
    if (error || !data?.length) throw new Error('Empty')

    // Auto-detect if prices are stored as rupees instead of paisa
    // Fallback products have values like 12000 (paisa), but Supabase may have 120 (rupees)
    const maxPrice = Math.max(...data.map(p => p.base_price_paisa))
    if (maxPrice < 100000) {
      // Prices look like rupees, convert to paisa
      console.warn('⚠️ Supabase prices appear to be in rupees, converting to paisa (×100)')
      return data.map(p => ({
        ...p,
        base_price_paisa: p.base_price_paisa * 100
      }))
    }

    return data
  } catch {
    console.warn('⚠️ Using default products fallback')
    return defaultProducts
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({
        success: false,
        reply: '🍽️ Hey there! 👋 I\'m here to help you order. What sounds good to you today?\n\nTry saying something like: "2 burgers and a coke" 😊'
      })
    }

    console.log('📨 Message:', message)

    // Load products from Supabase
    const allProducts = await fetchProducts()
    console.log('📦 Products loaded:', allProducts.length)

    // Step 1: Extract items via GPT
    let parsedItems: ParsedItem[] = []
    try {
      parsedItems = await extractItems(message)
      console.log('🤖 GPT extracted:', parsedItems)
    } catch {
      console.warn('⚠️ GPT extraction failed, using local parser')
    }

    // Fallback to local parser
    if (!parsedItems.length) {
      parsedItems = localParse(message, allProducts)
      console.log('🔍 Local parser found:', parsedItems)
    }

    if (!parsedItems.length) {
      const menuDisplay = allProducts
        .map(p => `${p.emoji} ${p.name} — ₹${toRupees(p.base_price_paisa)}`)
        .join('\n')
      return NextResponse.json({
        success: false,
        reply: `Hmm, I didn't quite catch that! 👂\n\n✨ Here's what we've got:\n\n${menuDisplay}\n\nFeel free to order any combo! Example: "1 cheese burger, 2 fries, 1 coke" 🤤`
      })
    }

    // Steps 2+3+4: Embed → Pinecone → Inventory check
    const resolvedItems: ResolvedItem[] = []
    const suggestions: string[] = []

    for (const parsed of parsedItems) {
      console.log('🔍 Processing:', parsed.raw_name)

      let bestMatch: PineconeMatch | null = null

      // Try Pinecone semantic search
      try {
        const vector = await embed(parsed.raw_name)
        const matches = await searchPinecone(vector)
        console.log('📍 Pinecone matches:', matches.map(m => `${m.metadata.name}(${m.score.toFixed(2)})`))

        if (matches[0]?.score >= SIMILARITY_THRESHOLD) {
          bestMatch = matches[0]
        } else if (matches.length > 0) {
          // Weak match — suggest alternatives
          const alts = matches
            .slice(0, 3)
            .map(m => `${m.metadata.emoji} ${m.metadata.name}`)
            .join(', ')
          suggestions.push(`"${parsed.raw_name}" not found — did you mean: ${alts}?`)
          continue
        }
      } catch {
        console.warn('⚠️ Pinecone failed, falling back to direct match')
      }

      // Fallback: direct name match from Supabase products
      if (!bestMatch) {
        const directMatch = allProducts.find(p =>
          p.name.toLowerCase().includes(parsed.raw_name.toLowerCase()) ||
          parsed.raw_name.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])
        )
        if (directMatch) {
          bestMatch = {
            id: directMatch.id,
            score: 1.0,
            metadata: {
              name: directMatch.name,
              base_price_paisa: directMatch.base_price_paisa,
              emoji: directMatch.emoji
            }
          }
        }
      }

      if (!bestMatch) {
        suggestions.push(`"${parsed.raw_name}" not found on our menu`)
        continue
      }

      // Check inventory + get live price
      const livePrice = await checkInventory(bestMatch.id, parsed.quantity)
      if (livePrice === null) {
        // Fall back to product base price if inventory check fails
        const fallbackPrice = bestMatch.metadata.base_price_paisa
        console.warn(`⚠️ Inventory check failed for ${bestMatch.metadata.name}, using base price`)
        resolvedItems.push({
          product_id: bestMatch.id,
          name: bestMatch.metadata.name,
          emoji: bestMatch.metadata.emoji,
          quantity: parsed.quantity,
          unit_price_paisa: fallbackPrice,
          subtotal_paisa: fallbackPrice * parsed.quantity,
          subtotal_rupees: toRupees(fallbackPrice * parsed.quantity),
          score: bestMatch.score
        })
        continue
      }

      resolvedItems.push({
        product_id: bestMatch.id,
        name: bestMatch.metadata.name,
        emoji: bestMatch.metadata.emoji,
        quantity: parsed.quantity,
        unit_price_paisa: livePrice,
        subtotal_paisa: livePrice * parsed.quantity,
        subtotal_rupees: toRupees(livePrice * parsed.quantity),
        score: bestMatch.score
      })
    }

    // Surface suggestions if any items couldn't be resolved
    if (resolvedItems.length === 0 && suggestions.length > 0) {
      const suggestionsFormatted = suggestions
        .map(s => `  • ${s}`)
        .join('\n')
      return NextResponse.json({
        success: false,
        reply: `I couldn't find some items you mentioned:\n\n${suggestionsFormatted}\n\n💡 Go ahead and pick from our menu - we've got tasty options for you! 🍕🍔🥤`
      })
    }

    // Partial order — show what we found + what we couldn't
    const totalPaisa = resolvedItems.reduce((s, i) => s + i.subtotal_paisa, 0)
    const totalRupees = toRupees(totalPaisa)

    const summary = resolvedItems
      .map(i => `${i.emoji} ${i.quantity}x ${i.name} = ₹${i.subtotal_rupees}`)
      .join('\n')

    // Get pairing recommendation
    const pairingText = await getPairingRecommendation(
      resolvedItems.map(i => i.name),
      allProducts
    )

    const suggestionsText = suggestions.length > 0
      ? `\n\n💬 Heads up: We couldn't find: ${suggestions.join(', ')}. But hey, you can still enjoy these delicious items! 😋`
      : ''

    return NextResponse.json({
      success: true,
      orderItems: resolvedItems,
      totalPaisa,
      total: totalRupees,
      reply: `🎉 Perfect! Here's your delicious order:\n\n${summary}\n\n💰 Total: ₹${totalRupees}${pairingText ? '\n\n' + pairingText : ''}${suggestionsText}\n\n✨ Setting up your payment now...`
    })

  } catch (err: unknown) {
    const error = err as { message?: string }
    console.error('❌ extract-order error:', err)
    return NextResponse.json({
      success: false,
      reply: error.message ?? 'Something went wrong. Please try again! 😊'
    }, { status: 500 })
  }
}