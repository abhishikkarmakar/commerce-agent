export const products = [
  { id: 1, name: "Burger", price: 120, emoji: "🍔" },
  { id: 2, name: "Pizza", price: 250, emoji: "🍕" },
  { id: 3, name: "Coke", price: 40, emoji: "🥤" },
  { id: 4, name: "Fries", price: 80, emoji: "🍟" },
  { id: 5, name: "Sandwich", price: 100, emoji: "🥪" },
  { id: 6, name: "Coffee", price: 60, emoji: "☕" },
]

export type Product = typeof products[0]