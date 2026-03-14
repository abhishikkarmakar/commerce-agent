import { NextRequest, NextResponse } from 'next/server'

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

// Send message back to Telegram user
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

// Send typing indicator
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

// Store customer sessions in memory
interface Session {
  step: 'awaiting_info' | 'ordering'
  name?: string
  phone?: string
  email?: string
}

const sessions: Record<number, Session> = {}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('📱 Telegram update:', JSON.stringify(body, null, 2))

    const message = body.message || body.edited_message
    if (!message) return NextResponse.json({ ok: true })

    const chatId: number = message.chat.id
    const text: string = message.text || ''
    const firstName: string = message.from?.first_name || 'Customer'

    // Initialize session
    if (!sessions[chatId]) {
      sessions[chatId] = { step: 'awaiting_info' }
    }

    const session = sessions[chatId]

    // Handle /start command
    if (text === '/start') {
      sessions[chatId] = { step: 'awaiting_info' }
      await sendMessage(chatId,
        `👋 Welcome to <b>QuickShop</b>, ${firstName}!\n\n` +
        `🍕 I'm your AI-powered order assistant - let's get tasty! 😋\n\n` +
        `To get started, share your <b>name and phone number</b>.\n\n` +
        `<i>Example: Rahul, 9876543210</i>`
      )
      return NextResponse.json({ ok: true })
    }

    // Handle /menu command
    if (text === '/menu') {
      await sendTyping(chatId)
      try {
        const menuRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/products`)
        const menuData = await menuRes.json()
        const menuText = menuData.products
          ?.map((p: Record<string, unknown>) => {
            const name = p.name as string
            const emoji = p.emoji as string
            const price = p.base_price_paisa as number
            return `${emoji} <b>${name}</b> — ₹${Math.round(price / 100)}`
          })
          .join('\n') || 'Menu unavailable'

        await sendMessage(chatId, `🍽️ <b>Our Delicious Menu:</b>\n\n${menuText}\n\n😋 Just tell me what you'd like! Mix & match any combo!`)
      } catch (e) {
        console.error('❌ Menu fetch failed:', e)
        await sendMessage(chatId, '❌ Menu unavailable right now. Please try again! 😊')
      }
      return NextResponse.json({ ok: true })
    }

    // Handle /help command
    if (text === '/help') {
      await sendMessage(chatId,
        `<b>Available Commands:</b>\n\n` +
        `/start - Start fresh\n` +
        `/menu - View our menu\n` +
        `/help - Show this help\n\n` +
        `Or just type your order naturally!\n` +
        `Example: <i>"2 classic burgers and a coke"</i>`
      )
      return NextResponse.json({ ok: true })
    }

    // Step 1: Collect customer info
    if (session.step === 'awaiting_info') {
      const match = text.match(/([a-zA-Z\s]+)[,\s]+(\d{10})/)

      if (!match) {
        await sendMessage(chatId,
          `Please share your name and phone number.\n\n` +
          `<i>Example: Rahul, 9876543210</i> 😊`
        )
        return NextResponse.json({ ok: true })
      }

      const name = match[1].trim()
      const phone = match[2].trim()
      const email = `${name.toLowerCase().replace(/\s+/g, '.')}@telegram.quickshop.com`

      sessions[chatId] = {
        step: 'ordering',
        name,
        phone,
        email
      }

      await sendMessage(chatId,
        `✅ Got it, <b>${name}</b>! 🎉\n\n` +
        `What would you like to order today?\n\n` +
        `Type <b>/menu</b> to see what we have, or just tell me what you want!\n\n` +
        `<i>Example: "2 classic burgers and 1 coke"</i> 🛍️`
      )
      return NextResponse.json({ ok: true })
    }

    // Step 2: Process order
    if (session.step === 'ordering') {
      await sendTyping(chatId)

      try {
        // Extract order via AI
        const extractRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/extract-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        })
        const extractData = await extractRes.json()

        // Send order summary
        await sendMessage(chatId, extractData.reply)

        // If order found, create payment
        if (extractData.success) {
          await sendTyping(chatId)

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

          // Send payment link as clickable button
          if (payData.paymentLink) {
            await fetch(`${TELEGRAM_API}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ <b>Order Confirmed!</b>\n\n📦 Order ID: <code>${String(payData.orderId).substring(0, 8).toUpperCase()}</code>\n💰 Amount: ₹${extractData.total}`,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [[
                    {
                      text: '💳 Pay Now',
                      url: payData.paymentLink
                    }
                  ]]
                }
              })
            })
          }
        }
      } catch (e) {
        console.error('❌ Order processing failed:', e)
        await sendMessage(chatId, '❌ Something went wrong. Please try again! 😊')
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('❌ Telegram webhook error:', error)
    return NextResponse.json({ ok: true }) // Always return 200 to Telegram
  }
}
