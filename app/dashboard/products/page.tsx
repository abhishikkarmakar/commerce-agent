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

export default function ProductsPage(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', price: '', emoji: '🛍️' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/products')
        const data = await res.json()
        setProducts(data?.products || DEFAULT_PRODUCTS)
      } catch (e) {
        const stored = localStorage.getItem('merchant_products')
        setProducts(stored ? JSON.parse(stored) : DEFAULT_PRODUCTS)
      }
    }
    load()
  }, [])

  const saveProducts = async (updated: Product[]) => {
    setProducts(updated)
    setSaved(true)
    try {
      await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: updated }) })
      localStorage.setItem('merchant_products', JSON.stringify(updated))
    } catch (e) {
      console.warn('Failed to save to API, saved locally', e)
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

  const deleteProduct = (id: number) => {
    saveProducts(products.filter(p => p.id !== id))
  }

  const updatePrice = (id: number, price: string) => {
    saveProducts(products.map(p => p.id === id ? { ...p, price: parseInt(price) || 0 } : p))
  }

  const EMOJI_OPTIONS = ['🍔','🍕','🥤','🍟','🥪','☕','🍜','🍱','🧁','🍰','🥗','🍗','🍖','🌮','🧆']

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🛍️ Product Catalog</h1>
          <p className="text-gray-500 mt-1">Add and manage your menu items</p>
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

      {/* Add New Product */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">➕ Add New Product</h2>
        <div className="flex gap-3 flex-wrap">
          
          {/* Emoji Picker */}
          <select
            value={newProduct.emoji}
            onChange={e => setNewProduct({ ...newProduct, emoji: e.target.value })}
            className="border rounded-lg px-3 py-2 text-xl w-20"
          >
            {EMOJI_OPTIONS.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>

          {/* Name */}
          <input
            type="text"
            placeholder="Product name"
            value={newProduct.name}
            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
            className="border rounded-lg px-4 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          {/* Price */}
          <input
            type="number"
            placeholder="Price (₹)"
            value={newProduct.price}
            onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
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

      {/* Product List */}
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
          💡 <strong>How it works:</strong> Products saved here are automatically used by the AI to understand customer orders and calculate bills. Try adding your own items then test them in the chat!
        </p>
      </div>

    </div>
  )
}
