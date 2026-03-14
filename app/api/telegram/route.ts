import { NextRequest, NextResponse } from 'next/server'
import { Product, toRupees } from '@/lib/products'

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup || undefined
      })
    })
  } catch (e) {
    console.error('❌ Failed to send message:', e)
  }
}

async function sendTyping(chatId: number) {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' })
    })
  } catch (e) {
    console.error('❌ Failed to send typing:', e)
  }
}

// ── Session store ──────────────────────────────────────────────────────────
interface Session {
  step: 'awaiting_info' | 'ordering' | 'awaiting_choice'
  name?: string
  phone?: string
  email?: string
  // For ambiguity resolution
  pendingCategory?: string
  pendingMatches?: Product[]
  pendingQuantity?: number
}

const sessions: Record<number, Session> = {}

// ── Order history per chat ─────────────────────────────────────────────────
interface OrderRecord {
  orderId: string
  items: string
  total: number
  createdAt: string
}
const orderHistory: Record<number, OrderRecord[]> = {}

// ── Keywords that mean "show my orders" ───────────────────────────────────
const ORDER_HISTORY_KEYWORDS = [
  'my orders', 'order history', 'past orders', 'previous orders',
  'what did i order', 'show orders', 'order list', 'my purchases',
  'what have i ordered', 'order tell', 'orders'
]

function isOrderHistoryRequest(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return ORDER_HISTORY_KEYWORDS.some(k => lower.includes(k))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📱 Telegram update:', JSON.stringify(body, null, 2))

    const message = body.message || body.edited_message
    if (!message) return NextResponse.json({ ok: true })

    const chatId: number = message.chat.id
    const text: string = message.text || ''
    const firstName: string = message.from?.first_name || 'Customer'

    if (!sessions[chatId]) {
      sessions[chatId] = { step: 'awaiting_info' }
    }

    const session = sessions[chatId]

    // ── /start ──────────────────────────────────────────────────────────────
    if (text === '/start') {
      sessions[chatId] = { step: 'awaiting_info' }
      await sendMessage(chatId,
        `🍽️ Hey there! 👋 Welcome to <b>QuickShop</b>, ${firstName}!\n\n` +
        `🛍️ Your AI-powered food ordering buddy is here!\n\n` +
        `Before we start, what's your <b>name and phone number</b>?\n\n` +
        `<i>Example: "John, 9876543210"</i>`
      )
      return NextResponse.json({ ok: true })
    }

    // ── /menu ───────────────────────────────────────────────────────────────
    if (text === '/menu') {
      await sendTyping(chatId)
      try {
        const menuRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/products`)
        const menuData = await menuRes.json()
        const menuText = menuData.products
          ?.map((p: Product) => `${p.emoji} <b>${p.name}</b> — ₹${toRupees(p.base_price_paisa)}`)
          .join('\n') || 'Menu unavailable'
        await sendMessage(chatId,
          `🍽️ <b>Our Menu:</b>\n\n${menuText}\n\n` +
          `😋 Just tell me what you'd like!`
        )
      } catch {
        await sendMessage(chatId, '❌ Menu unavailable right now. Please try again!')
      }
      return NextResponse.json({ ok: true })
    }

    // ── /orders ─────────────────────────────────────────────────────────────
    if (text === '/orders' || isOrderHistoryRequest(text)) {
      const history = orderHistory[chatId] || []
      if (!history.length) {
        await sendMessage(chatId,
          `📋 You haven't placed any orders yet!\n\n` +
          `Just tell me what you'd like to order 😊`
        )
      } else {
        const lines = history.map((o, i) =>
          `${i + 1}. 📦 <code>${o.orderId}</code>\n` +
          `   🛍️ ${o.items}\n` +
          `   💰 ₹${o.total} • 🕐 ${o.createdAt}`
        ).join('\n\n')
        await sendMessage(chatId,
          `📋 <b>Your Order History (${history.length} orders):</b>\n\n${lines}`
        )
      }
      return NextResponse.json({ ok: true })
    }

    // ── /help ───────────────────────────────────────────────────────────────
    if (text === '/help') {
      await sendMessage(chatId,
        `<b>Available Commands:</b>\n\n` +
        `/start - Start fresh\n` +
        `/menu - View our menu\n` +
        `/orders - View your order history\n` +
        `/help - Show this help\n\n` +
        `Or just type your order naturally!\n` +
        `<i>Example: "2 classic burgers and a coke"</i>`
      )
      return NextResponse.json({ ok: true })
    }

    // ── Step 1: Collect customer info ───────────────────────────────────────
    if (session.step === 'awaiting_info') {
      const match = text.match(/([a-zA-Z\s]+)[,\s]+(\d{10,})/)
      if (!match) {
        await sendMessage(chatId,
          `Please share your name and phone number.\n\n` +
          `<i>Example: Rahul, 9876543210</i> 😊`
        )
        return NextResponse.json({ ok: true })
      }

      const name = match[1].trim()
      const phone = match[2].trim()
      sessions[chatId] = {
        step: 'ordering',
        name,
        phone,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@telegram.quickshop.com`
      }

      await sendMessage(chatId,
        `🎉 Perfect! Great to meet you <b>${name}</b>!\n\n` +
        `What would you like to order today? 😋\n\n` +
        `<i>Example: "2 classic burgers and 1 coke"</i>`
      )
      return NextResponse.json({ ok: true })
    }

    // ── Step 2b: Handle ambiguous choice reply ──────────────────────────────
    if (session.step === 'awaiting_choice' && session.pendingMatches) {
      const matches = session.pendingMatches
      const qty = session.pendingQuantity ?? 1
      let chosen: Product | null = null

      // Try number selection (e.g. "1", "2", "3")
      const numChoice = parseInt(text.trim())
      if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= matches.length) {
        chosen = matches[numChoice - 1]
      } else {
        // Try name match
        const lower = text.toLowerCase()
        chosen = matches.find(p => p.name.toLowerCase().includes(lower)) ?? null
      }

      if (!chosen) {
        const options = matches
          .map((p, i) => `${i + 1}. ${p.emoji} ${p.name}`)
          .join('\n')
        await sendMessage(chatId,
          `Please pick a number or type the name:\n\n${options}`
        )
        return NextResponse.json({ ok: true })
      }

      // Reset session step
      sessions[chatId] = { ...session, step: 'ordering', pendingMatches: undefined, pendingCategory: undefined }

      // Process as a direct order
      await sendTyping(chatId)
      await processOrder(chatId, session, `${qty} ${chosen.name}`)
      return NextResponse.json({ ok: true })
    }

    // ── Step 2: Process order ───────────────────────────────────────────────
    if (session.step === 'ordering') {
      await sendTyping(chatId)
      await processOrder(chatId, session, text)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('❌ Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

// ── Process order helper ───────────────────────────────────────────────────
async function processOrder(chatId: number, session: Session, text: string) {
  try {
    const extractRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/extract-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
    const extractData = await extractRes.json()

    // ── Handle ambiguous category (e.g. user said "pizza") ─────────────────
    if (extractData.ambiguous && extractData.matches) {
      sessions[chatId] = {
        ...session,
        step: 'awaiting_choice',
        pendingMatches: extractData.matches,
        pendingCategory: extractData.category,
        pendingQuantity: 1
      }
      await sendMessage(chatId, extractData.reply)
      return
    }

    // ── Send order summary ──────────────────────────────────────────────────
    await sendMessage(chatId, extractData.reply)

    if (!extractData.success) return

    // ── Create payment ──────────────────────────────────────────────────────
    const payRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderItems: extractData.orderItems,
        total: extractData.total,
        totalPaisa: extractData.totalPaisa,
        customerName: session.name,
        customerPhone: session.phone,
        customerEmail: session.email
      })
    })
    const payData = await payRes.json()

    if (payData.orderId) {
      // ── Save to local order history ───────────────────────────────────────
      if (!orderHistory[chatId]) orderHistory[chatId] = []
      orderHistory[chatId].push({
        orderId: String(payData.orderId).substring(0, 8).toUpperCase(),
        items: extractData.orderItems
          .map((i: { emoji: string; quantity: number; name: string }) =>
            `${i.emoji}${i.quantity}× ${i.name}`)
          .join(', '),
        total: extractData.total,
        createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      })
    }

    // ── Send payment button with order summary ────────────────────────────
    if (payData.paymentLink) {
      const summaryLines = extractData.orderItems
        .map((i: { emoji: string; quantity: number; name: string; subtotal_rupees: number }) =>
          `${i.emoji} ${i.quantity}× ${i.name} — ₹${i.subtotal_rupees}`)
        .join('\n')

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            `🧾 <b>Order Summary</b>\n\n` +
            `${summaryLines}\n` +
            `━━━━━━━━━━━━━━━━━\n` +
            `💰 <b>Total: ₹${extractData.total}</b>\n\n` +
            `📦 Order ID: <code>${String(payData.orderId).substring(0, 8).toUpperCase()}</code>\n\n` +
            `🔐 Tap below to pay securely!`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: `💳 Pay Now — ₹${extractData.total}`, url: payData.paymentLink }
            ]]
          }
        })
      })
    }
  } catch (e) {
    console.error('❌ Order processing failed:', e)
    await sendMessage(chatId, '❌ Something went wrong. Please try again! 😊')
  }
}
