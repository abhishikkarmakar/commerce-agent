'use client'
import { useState } from 'react'

interface Message {
  role: 'customer' | 'agent'
  content: string
  timestamp: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      content: '👋 Hi! Welcome to QuickShop. What would you like to order today?',
      timestamp: new Date().toLocaleTimeString().toLowerCase()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return
    
    const userMessage: Message = {
      role: 'customer',
      content: input,
      timestamp: new Date().toLocaleTimeString().toLowerCase()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // Step 1: Extract order
    const extractRes = await fetch('/api/extract-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input })
    })
    const extractData = await extractRes.json()

    const orderReply: Message = {
      role: 'agent',
      content: extractData.reply,
      timestamp: new Date().toLocaleTimeString().toLowerCase()
    }
    setMessages(prev => [...prev, orderReply])

    // Step 2: If order found, generate payment link
    if (extractData.success) {
      const payRes = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItems: extractData.orderItems,
          total: extractData.total
        })
      })
      const payData = await payRes.json()

      const payReply: Message = {
        role: 'agent',
        content: payData.reply,
        timestamp: new Date().toLocaleTimeString().toLowerCase()
      }
      setMessages(prev => [...prev, payReply])
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-green-600 p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 font-bold text-lg">Q</div>
            <div>
              <h1 className="font-bold text-lg">QuickShop Assistant</h1>
              <p className="text-green-100 text-sm">● Online — Powered by Pine Labs</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                msg.role === 'customer' 
                  ? 'bg-green-600 text-white rounded-br-none' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-none'
              }`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'customer' ? 'text-green-200' : 'text-gray-800'}`}>
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-none">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type your order... e.g. 2 burgers and 1 coke"
            className="flex-1 border rounded-full px-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-green-700 disabled:opacity-50"
          >
            ➤
          </button>
        </div>

      </div>
    </div>
  )
}