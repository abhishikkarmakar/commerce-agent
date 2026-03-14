// Pine Labs payment integration
const BASE_URL = 'https://pluraluat.v2.pinepg.in'  // UAT/Test environment

export async function getPineLabsToken(): Promise<string> {
  console.log('🔑 Pine Labs token request...')
  console.log('  CLIENT_ID:', process.env.PINELABS_CLIENT_ID ? `✅ (${process.env.PINELABS_CLIENT_ID?.substring(0,8)}...)` : '❌ MISSING')
  console.log('  CLIENT_SECRET:', process.env.PINELABS_CLIENT_SECRET ? '✅ Set' : '❌ MISSING')

  const res = await fetch(`${BASE_URL}/api/auth/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'Request-ID': crypto.randomUUID(),
      'Request-Timestamp': new Date().toISOString()
    },
    body: JSON.stringify({
      client_id: process.env.PINELABS_CLIENT_ID,
      client_secret: process.env.PINELABS_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  })

  const data = await res.json()
  console.log('🔑 Token response:', res.status, JSON.stringify(data))

  if (!res.ok || !data.access_token) {
    throw new Error(`Token failed: ${JSON.stringify(data)}`)
  }

  console.log('✅ Token received!')
  return data.access_token
}

export async function createPineLabsOrder(options: {
  orderId: string
  amountPaisa: number
  customerName: string
  customerPhone: string
  customerEmail: string
}): Promise<{ checkoutUrl: string; pineOrderId: string }> {
  const { orderId, amountPaisa, customerName, customerPhone, customerEmail } = options

  const token = await getPineLabsToken()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const nameParts = customerName.trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ') || firstName

  const cleanPhone = customerPhone
    .replace(/^\+91/, '')
    .replace(/^\+/, '')
    .replace(/\s+/g, '')
    .slice(-10)

  const body = {
    merchant_order_reference: orderId,
    order_amount: {
      value: amountPaisa,
      currency: 'INR'
    },
    pre_auth: false,
    allowed_payment_methods: ['CARD', 'UPI', 'NETBANKING', 'WALLET'],
    notes: `QuickShop order by ${customerName}`,
    callback_url: `${appUrl}/api/webhook/pine-labs`,
    failure_callback_url: `${appUrl}/payment-status?order_id=${orderId}&status=failed`,
    purchase_details: {
      customer: {
        email_id: customerEmail,
        first_name: firstName,
        last_name: lastName,
        customer_id: cleanPhone,
        mobile_number: cleanPhone,
        country_code: '91',
        billing_address: {
          address1: 'India',
          address2: '',
          address3: '',
          pincode: '560001',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          full_name: customerName,
          adddress_type: 'Home',
          address_category: 'billing'
        },
        shipping_address: {
          address1: 'India',
          address2: '',
          address3: '',
          pincode: '560001',
          city: 'Bengaluru',
          state: 'Karnataka',
          country: 'India',
          full_name: customerName,
          adddress_type: 'Home',
          address_category: 'shipping'
        }
      },
      merchant_metadata: {
        key1: orderId,
        key2: process.env.PINELABS_MID || '121500'
      }
    }
  }

  console.log('💳 Creating Pine Labs order:', orderId, amountPaisa, 'paise')

  const res = await fetch(`${BASE_URL}/api/checkout/v1/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'Request-ID': crypto.randomUUID(),
      'Request-Timestamp': new Date().toISOString()
    },
    body: JSON.stringify(body)
  })

  const data = await res.json()
  console.log('🌲 Pine Labs order response:', JSON.stringify(data, null, 2))

  if (!res.ok) throw new Error(`Pine Labs order failed: ${JSON.stringify(data)}`)

  const checkoutUrl = data.redirect_url || data.checkout_url
  if (!checkoutUrl) throw new Error(`No redirect_url in response: ${JSON.stringify(data)}`)

  return {
    checkoutUrl,
    pineOrderId: data.order_id || orderId
  }
}