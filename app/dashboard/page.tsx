'use client'
import { useState, useEffect } from 'react'

interface Order {
  orderId: string
  customerName: string
  orderItems: { name: string; quantity: number; subtotal: number; emoji: string }[]
  total: number
  paymentLink: string
  status: 'PENDING' | 'PAID' | 'FAILED'
  createdAt: string
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, revenue: 0 })

  const fetchOrders = async () => {
    const res = await fetch('/api/orders')
    const data = await res.json()
    setOrders(data.orders || [])
    setStats(data.stats || { total: 0, paid: 0, pending: 0, revenue: 0 })
  }

  useEffect(() => {
    fetchOrders()
    // Auto refresh every 5 seconds - live updates!
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🏪 Merchant Dashboard</h1>
          <p className="text-gray-500 mt-1">Live order tracking — Powered by Pine Labs</p>
        </div>
        <div className="flex gap-3">
          <a href="/" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            💬 Open Chat
          </a>
          <button onClick={fetchOrders} className="bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-gray-500 text-sm">Total Orders</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-gray-500 text-sm">Paid</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.paid}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-gray-500 text-sm">Pending</p>
          <p className="text-3xl font-bold text-yellow-500 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-gray-500 text-sm">Revenue</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">₹{stats.revenue}</p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">📋 Live Orders</h2>
          <span className="text-xs text-gray-400">Auto-refreshes every 5s</span>
        </div>

        {orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-medium">No orders yet</p>
            <p className="text-sm mt-1">Orders will appear here instantly when customers chat</p>
            <a href="/" className="mt-4 inline-block text-green-600 underline text-sm">
              Try placing an order →
            </a>
          </div>
        ) : (
          <div className="divide-y">
            {orders.map(order => (
              <div key={order.orderId} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{order.orderId}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.status === 'PAID' 
                          ? 'bg-green-100 text-green-700' 
                          : order.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status === 'PAID' ? '✅ Paid' : order.status === 'FAILED' ? '❌ Failed' : '⏳ Pending'}
                      </span>
                    </div>
                    <p className="font-medium text-gray-800 mt-1">{order.customerName}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {order.orderItems.map(i => `${i.emoji} ${i.quantity}x ${i.name}`).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">₹{order.total}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
