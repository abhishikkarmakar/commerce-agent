'use client'
import { useState, useEffect } from 'react'

interface Product {
  id: number
  name: string
  price: number
  emoji: string
}

const DEFAULT_PRODUCTS: Product[] = [
  { id: 1, name: "Burger", price: 120, emoji: "🍔" },
  { id: 2, name: "Pizza", price: 250, emoji: "🍕" },
  { id: 3, name: "Coke", price: 40, emoji: "🥤" },
  { id: 4, name: "Fries", price: 80, emoji: "🍟" },
  { id: 5, name: "Sandwich", price: 100, emoji: "🥪" },
  { id: 6, name: "Coffee", price: 60, emoji: "☕" },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', price: '', emoji: '🛍️' })
  const [saved, setSaved] = useState(false)

  // ── Telegram state ────────────────────────────────────────────────────────
  const [botToken, setBotToken] = useState('')
  const [botStatus, setBotStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const [botError, setBotError] = useState<string | null>(null)

  // ── Load products ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/products')
        const data = await res.json()
        const mapped = (data?.products || DEFAULT_PRODUCTS).map((p: {
          id: number | string
          name: string
          emoji: string
          price?: number
          base_price_paisa?: number
        }) => ({
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          price: p.price ?? Math.round((p.base_price_paisa ?? 0) / 100)
        }))
        setProducts(mapped)
      } catch {
        const stored = localStorage.getItem('merchant_products')
        setProducts(stored ? JSON.parse(stored) : DEFAULT_PRODUCTS)
      }
    }
    load()

    // Check if bot already connected
    const savedUsername = localStorage.getItem('telegram_bot_username')
    const savedToken = localStorage.getItem('telegram_bot_token_hint')
    if (savedUsername) {
      setBotStatus('connected')
      setBotUsername(savedUsername)
      if (savedToken) setBotToken(savedToken)
    }
  }, [])

  // ── Telegram connect ──────────────────────────────────────────────────────
  const connectBot = async () => {
    if (!botToken.trim()) return
    setBotStatus('connecting')
    setBotError(null)

    try {
      // Step 1: Verify token with Telegram
      const verifyRes = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/getMe`
      )
      const verifyData = await verifyRes.json()

      if (!verifyData.ok) {
        setBotError('❌ Invalid token. Please check and try again.')
        setBotStatus('error')
        return
      }

      const username = verifyData.result.username

      // Step 2: Save token to backend
      await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken.trim() })
      })

      // Step 3: Register webhook
      const webhookRes = await fetch('/api/telegram/setup')
      const webhookData = await webhookRes.json()

      if (!webhookData.success) {
        setBotError(`⚠️ Token saved but webhook failed: ${webhookData.error}`)
        setBotStatus('error')
        return
      }

      // Step 4: Save to localStorage
      localStorage.setItem('telegram_bot_username', username)
      localStorage.setItem('telegram_bot_token_hint',
        botToken.trim().substring(0, 10) + '...'
      )

      setBotUsername(username)
      setBotStatus('connected')
    } catch (e) {
      setBotError('❌ Connection failed. Is ngrok running?')
      setBotStatus('error')
      console.error(e)
    }
  }

  const disconnectBot = async () => {
    try {
      await fetch('/api/telegram/setup', { method: 'DELETE' })
    } catch { /* ignore */ }
    localStorage.removeItem('telegram_bot_username')
    localStorage.removeItem('telegram_bot_token_hint')
    setBotStatus('idle')
    setBotUsername(null)
    setBotToken('')
    setBotError(null)
  }

  // ── Products helpers ──────────────────────────────────────────────────────
  const saveProducts = async (updated: Product[]) => {
    setProducts(updated)
    setSaved(true)
    try {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: updated })
      })
      localStorage.setItem('merchant_products', JSON.stringify(updated))
    } catch {
      localStorage.setItem('merchant_products', JSON.stringify(updated))
    }
    setTimeout(() => setSaved(false), 2000)
  }

  const addProduct = () => {
    if (!newProduct.name || !newProduct.price) return
    const product: Product = {
      id: Date.now(),
      name: newProduct.name,
      price: parseInt(newProduct.price),
      emoji: newProduct.emoji
    }
    saveProducts([...products, product])
    setNewProduct({ name: '', price: '', emoji: '🛍️' })
  }

  const deleteProduct = (id: number) => saveProducts(products.filter(p => p.id !== id))

  const EMOJI_OPTIONS = ['🍔', '🍕', '🥤', '🍟', '🥪', '☕', '🍜', '🍱', '🧁', '🎂', '🥗', '🍗', '🍖', '🌮', '🧆']

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🛍️ Product Catalog</h1>
          <p className="text-gray-500 mt-1">Manage your menu and connect your Telegram bot</p>
        </div>
        <div className="flex gap-3 items-center">
          {saved && <span className="text-green-600 text-sm font-medium">✅ Saved!</span>}
          <a href="/dashboard" className="bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            ← Dashboard
          </a>
          <a href="/" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            💬 Chat
          </a>
        </div>
      </div>

      {/* ── Telegram Bot Section ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤖</span>
          <h2 className="font-semibold text-gray-800 text-lg">Telegram Bot</h2>
          {botStatus === 'connected' && (
            <span className="ml-auto flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-medium px-3 py-1 rounded-full border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </span>
          )}
          {botStatus === 'error' && (
            <span className="ml-auto bg-red-50 text-red-600 text-xs font-medium px-3 py-1 rounded-full border border-red-200">
              ⚠️ Error
            </span>
          )}
        </div>

        {botStatus === 'connected' && botUsername ? (
          /* ── Connected State ── */
          <div>
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <p className="font-semibold text-green-800">@{botUsername}</p>
                  <p className="text-green-600 text-xs">Webhook active • Receiving orders</p>
                </div>
              </div>
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Open Bot →
              </a>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const res = await fetch('/api/telegram/setup')
                  const data = await res.json()
                  alert(data.success ? '✅ Webhook refreshed!' : '❌ Failed: ' + data.error)
                }}
                className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-600"
              >
                🔄 Refresh Webhook
              </button>
              <button
                onClick={disconnectBot}
                className="text-sm border border-red-200 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50"
              >
                🔌 Disconnect Bot
              </button>
            </div>
          </div>
        ) : (
          /* ── Connect State ── */
          <div>
            <p className="text-gray-500 text-sm mb-4">
              Paste your bot token from{' '}
              <a href="https://t.me/BotFather" target="_blank" className="text-blue-500 underline">
                @BotFather
              </a>{' '}
              — we handle the rest automatically.
            </p>

            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Paste bot token e.g. 123456:ABC-DEF..."
                value={botToken}
                onChange={e => { setBotToken(e.target.value); setBotError(null) }}
                onKeyDown={e => e.key === 'Enter' && connectBot()}
                className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                onClick={connectBot}
                disabled={!botToken.trim() || botStatus === 'connecting'}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 min-w-32"
              >
                {botStatus === 'connecting' ? '⏳ Connecting...' : '🔗 Connect Bot'}
              </button>
            </div>

            {/* Error message */}
            {botError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-4">
                {botError}
              </div>
            )}

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
              <p className="font-medium text-gray-700 mb-2">How to get a token:</p>
              <ol className="space-y-1 list-decimal list-inside">
                <li>Open Telegram and message <code className="bg-gray-200 px-1 rounded">@BotFather</code></li>
                <li>Send <code className="bg-gray-200 px-1 rounded">/newbot</code></li>
                <li>Choose a name and username for your bot</li>
                <li>Copy the token and paste it above</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* ── Add New Product ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">➕ Add New Product</h2>
        <div className="flex gap-3 flex-wrap">
          <select
            value={newProduct.emoji}
            onChange={e => setNewProduct({ ...newProduct, emoji: e.target.value })}
            className="border rounded-lg px-3 py-2 text-xl w-20"
          >
            {EMOJI_OPTIONS.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Product name"
            value={newProduct.name}
            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addProduct()}
            className="border rounded-lg px-4 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <input
            type="number"
            placeholder="Price (₹)"
            value={newProduct.price}
            onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addProduct()}
            className="border rounded-lg px-4 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={addProduct}
            disabled={!newProduct.name || !newProduct.price}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            Add Product
          </button>
        </div>
      </div>

      {/* ── Product List ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">📋 Your Menu ({products.length} items)</h2>
        </div>
        {products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🍽️</p>
            <p>No products yet — add your first item above!</p>
          </div>
        ) : (
          <div className="divide-y">
            {products.map(product => (
              <div key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{product.emoji}</span>
                  <span className="font-medium text-gray-800">{product.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800 bg-green-50 border border-green-200 px-3 py-1 rounded-lg text-sm">
                    ₹{product.price}
                  </span>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-blue-700 text-sm">
          💡 <strong>How it works:</strong> Products saved here are automatically used by the AI to understand customer orders. Connect your Telegram bot above so customers can order directly on Telegram!
        </p>
      </div>
    </div>
  )
}
