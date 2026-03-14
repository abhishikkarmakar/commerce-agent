import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

function updateEnvFile(key: string, value: string) {
  let content = ''
  try { content = fs.readFileSync(ENV_PATH, 'utf-8') } catch { content = '' }
  const lines = content.split('\n').filter(l => !l.startsWith(`${key}=`))
  if (value) lines.push(`${key}=${value}`)
  fs.writeFileSync(ENV_PATH, lines.join('\n').trim() + '\n')
}

// GET → register webhook
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!token) return NextResponse.json({ success: false, error: 'No token' }, { status: 400 })
  if (!appUrl) return NextResponse.json({ success: false, error: 'Missing NEXT_PUBLIC_APP_URL' }, { status: 400 })

  const webhookUrl = `${appUrl}/api/telegram`
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'edited_message'] })
  })
  const data = await res.json()
  return NextResponse.json({ success: data.ok, webhook_url: webhookUrl, telegram_response: data })
}

// POST → save token
export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 400 })
  updateEnvFile('TELEGRAM_BOT_TOKEN', token)
  process.env.TELEGRAM_BOT_TOKEN = token
  return NextResponse.json({ ok: true })
}

// DELETE → remove token
export async function DELETE() {
  updateEnvFile('TELEGRAM_BOT_TOKEN', '')
  process.env.TELEGRAM_BOT_TOKEN = ''
  return NextResponse.json({ ok: true })
}
