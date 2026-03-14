import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!token || token === 'your_bot_token_here') {
    return NextResponse.json({ 
      error: 'Missing or placeholder TELEGRAM_BOT_TOKEN in .env.local' 
    }, { status: 400 })
  }

  if (!appUrl) {
    return NextResponse.json({ 
      error: 'Missing NEXT_PUBLIC_APP_URL' 
    }, { status: 400 })
  }

  const webhookUrl = `${appUrl}/api/telegram`

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'edited_message']
        })
      }
    )

    const data = await res.json()
    console.log('📱 Webhook setup:', data)

    return NextResponse.json({
      success: data.ok,
      webhook_url: webhookUrl,
      telegram_response: data
    })
  } catch (e) {
    console.error('❌ Webhook setup failed:', e)
    return NextResponse.json({ 
      error: 'Failed to set webhook',
      details: String(e)
    }, { status: 500 })
  }
}
