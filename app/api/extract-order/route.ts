import { NextRequest, NextResponse } from 'next/server'
import { products, Product } from '@/lib/products'

type OrderItem = Product & { quantity: number; subtotal: number }

export async function POST(req: NextRequest) {
  const { message, products: customProducts } = await req.json()
  const activeProducts = customProducts || products

  // ---- MOCK AI (replace with AWS Bedrock on Friday) ----
  const orderItems = extractOrderMock(message, activeProducts)
  // ------------------------------------------------------

  if (orderItems.length === 0) {
    return NextResponse.json({
      success: false,
      reply: "Sorry, I couldn't find any items in your order. Try saying something like '2 burgers and 1 coke' 😊"
    })
  }

  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

  const summary = orderItems
    .map(i => `${i.emoji} ${i.quantity}x ${i.name} = ₹${i.subtotal}`)
    .join('\n')

  return NextResponse.json({
    success: true,
    orderItems,
    total,
    reply: `Got it! Here's your order summary:\n\n${summary}\n\n💰 Total: ₹${total}\n\nGenerating your payment link...`
  })
}

// Mock order extractor - works without any API key!
// Mock order extractor - works without any API key!
function extractOrderMock(message: string, productList: Product[]): OrderItem[] {
  const lowerMsg = message.toLowerCase()
  const foundItems: OrderItem[] = []

  productList.forEach(product => {
    const productName = product.name.toLowerCase()
    
    // Match patterns like "2 burgers", "two pizzas", "a coke", "1 coffee"
    const numberWords: Record<string, number> = {
      'a ': 1, 'an ': 1, 'one ': 1, 'two ': 2, 'three ': 3,
      'four ': 4, 'five ': 5
    }

    let quantity = 0

    // Check for numeric quantities
    const numericMatch = lowerMsg.match(new RegExp(`(\\d+)\\s*${productName}`))
    if (numericMatch) {
      quantity = parseInt(numericMatch[1])
    }

    // Check for word quantities
    if (quantity === 0) {
      for (const [word, num] of Object.entries(numberWords)) {
        if (lowerMsg.includes(word + productName) || lowerMsg.includes(word + productName + 's')) {
          quantity = num
          break
        }
      }
    }

    // Just mentioned with no quantity = 1
    if (quantity === 0 && lowerMsg.includes(productName)) {
      quantity = 1
    }

    if (quantity > 0) {
      foundItems.push({
        ...product,
        quantity,
        subtotal: product.price * quantity
      })
    }
  })

  return foundItems
}