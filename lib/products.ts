// Helper functions for paise ↔ rupees conversion
export const toRupees = (paisa: number): number => Math.round(paisa / 100)
export const toPaisa = (rupees: number): number => Math.round(rupees * 100)

export const products = [
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Classic Burger', base_price_paisa: 12000, emoji: '🍔' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', name: 'Cheese Burger', base_price_paisa: 14500, emoji: '🧀' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', name: 'Double Patty Burger', base_price_paisa: 18000, emoji: '🍔' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', name: 'Farmhouse Pizza', base_price_paisa: 25000, emoji: '🍕' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', name: 'Margherita Pizza', base_price_paisa: 20000, emoji: '🍕' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', name: 'Pepperoni Pizza', base_price_paisa: 30000, emoji: '🍕' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', name: 'Coke 500ml', base_price_paisa: 4000, emoji: '🥤' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', name: 'Iced Coffee', base_price_paisa: 6500, emoji: '☕' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', name: 'Masala Chai', base_price_paisa: 3000, emoji: '☕' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', name: 'French Fries', base_price_paisa: 8000, emoji: '🍟' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', name: 'Peri Peri Fries', base_price_paisa: 9500, emoji: '🍟' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', name: 'Grilled Sandwich', base_price_paisa: 11000, emoji: '🥪' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', name: 'Office Chair', base_price_paisa: 450000, emoji: '🪑' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', name: 'Executive Desk', base_price_paisa: 850000, emoji: '🖥️' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', name: 'Wireless Mouse', base_price_paisa: 150000, emoji: '🖱️' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', name: 'Mechanical Keyboard', base_price_paisa: 450000, emoji: '⌨️' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', name: 'USB-C Cable', base_price_paisa: 80000, emoji: '🔌' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', name: 'Monitor Stand', base_price_paisa: 220000, emoji: '🖥️' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', name: 'LED Table Lamp', base_price_paisa: 180000, emoji: '💡' },
  { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', name: 'Notebook Set', base_price_paisa: 50000, emoji: '📓' },
]

export type Product = typeof products[0]