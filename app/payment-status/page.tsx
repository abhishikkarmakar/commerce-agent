'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function PaymentStatusContent() {
    const searchParams = useSearchParams()
    const orderId = searchParams.get('order_id')
    const urlStatus = searchParams.get('status')
    const [status, setStatus] = useState<'loading' | 'SUCCESS' | 'PENDING' | 'FAILED'>('loading')
    const [checkCount, setCheckCount] = useState(0)

    useEffect(() => {
        // If URL says failed, show failed immediately
        if (urlStatus === 'failed') {
            setStatus('FAILED')
            return
        }

        if (!orderId) {
            setStatus('FAILED')
            return
        }

        const check = async () => {
            try {
                const res = await fetch(`/api/orders/status?order_id=${orderId}`)
                const data = await res.json()
                const s = data.status?.toUpperCase()
                if (s === 'SUCCESS' || s === 'PAID') {
                    setStatus('SUCCESS')
                } else if (s === 'FAILED') {
                    setStatus('FAILED')
                } else {
                    setStatus('PENDING')
                    setCheckCount(c => c + 1)
                }
            } catch {
                setStatus('PENDING')
            }
        }

        check()
        const interval = setInterval(check, 3000)
        return () => clearInterval(interval)
    }, [orderId, urlStatus])

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">

                {/* Loading */}
                {status === 'loading' && (
                    <>
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-700">Checking payment...</h1>
                        <p className="text-gray-400 text-sm mt-2">Please wait a moment</p>
                    </>
                )}

                {/* Success */}
                {status === 'SUCCESS' && (
                    <>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
                            <span className="text-5xl">✅</span>
                        </div>
                        <h1 className="text-3xl font-bold text-green-600 mb-2">Payment Done!</h1>
                        <p className="text-gray-500 mb-6">Your order has been confirmed 🎉</p>

                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-500 text-sm">Order ID</span>
                                <span className="font-mono text-xs font-bold text-gray-700">
                                    {orderId?.substring(0, 8).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-500 text-sm">Status</span>
                                <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                                    PAID ✓
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500 text-sm">Powered by</span>
                                <span className="text-xs font-bold text-gray-600">Pine Labs 🌲</span>
                            </div>
                        </div>

                        <Link href="/"
                            className="block w-full bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors">
                            Order Again 🛍️
                        </Link>
                    </>
                )}

                {/* Pending */}
                {status === 'PENDING' && (
                    <>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-yellow-100 flex items-center justify-center">
                            <span className="text-5xl">⏳</span>
                        </div>
                        <h1 className="text-2xl font-bold text-yellow-600 mb-2">Processing...</h1>
                        <p className="text-gray-500 mb-2">Your payment is being confirmed</p>
                        <p className="text-gray-400 text-xs mb-6">
                            Checking {checkCount} time{checkCount !== 1 ? 's' : ''}...
                        </p>

                        <div className="bg-yellow-50 rounded-2xl p-4 mb-6">
                            <p className="text-yellow-700 text-sm">
                                This usually takes a few seconds. Don&apos;t close this page!
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Link href="/"
                                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors text-sm">
                                Back to Shop
                            </Link>
                        </div>
                    </>
                )}

                {/* Failed */}
                {status === 'FAILED' && (
                    <>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="text-5xl">❌</span>
                        </div>
                        <h1 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h1>
                        <p className="text-gray-500 mb-6">Something went wrong with your payment</p>

                        <div className="bg-red-50 rounded-2xl p-4 mb-6">
                            <p className="text-red-600 text-sm">
                                Don&apos;t worry — no money was deducted. Please try again.
                            </p>
                        </div>

                        <Link href="/"
                            className="block w-full bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors">
                            Try Again 🔄
                        </Link>
                    </>
                )}

                {/* Pine Labs branding */}
                <p className="text-xs text-gray-300 mt-6">
                    Secured by Pine Labs Online 🔒
                </p>
            </div>
        </div>
    )
}

export default function PaymentStatus() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <PaymentStatusContent />
        </Suspense>
    )
}
