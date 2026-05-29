import { Category, Product } from "../types";

export const initialCategories: Category[] = [
  {
    _id: "cat-1",
    name: "Electronics",
    slug: "electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80"
  },
  {
    _id: "cat-2",
    name: "Fashion & Apparel",
    slug: "fashion-apparel",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80"
  },
  {
    _id: "cat-3",
    name: "Office & Stationery",
    slug: "office-stationery",
    image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80"
  }
];

export const initialProducts: Product[] = [
  {
    _id: "prod-1",
    name: "Studio Headphones Pro",
    slug: "studio-headphones-pro",
    description: "Professional grade over-ear headphones with active noise cancelling, premium leather ear cups, and 40 hrs of playtime. Perfect for music production and audiophiles.",
    price: 299,
    stock: 12,
    sku: "ELEC-001",
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80"],
    category: "cat-1"
  },
  {
    _id: "prod-2",
    name: "Mechanical Keyboard 75%",
    slug: "mechanical-keyboard-75",
    description: "Hot-swappable mechanical keyboard featuring solid CNC aluminum housing, pre-lubed linear switches, custom RGB, and double-shot PBT keycaps.",
    price: 159,
    stock: 8,
    sku: "ELEC-002",
    images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80"],
    category: "cat-1"
  },
  {
    _id: "prod-3",
    name: "Leather Satchel Bag",
    slug: "leather-satchel-bag",
    description: "Handcrafted full-grain Italian leather briefcase satchel with bronze hardware accessories, custom laptop sleeve, and adjustable shoulder strap.",
    price: 189,
    stock: 15,
    sku: "FASH-001",
    images: ["https://images.unsplash.com/photo-1473187983305-f615310e7daa?auto=format&fit=crop&w=600&q=80"],
    category: "cat-2"
  },
  {
    _id: "prod-4",
    name: "Minimalist Brass Pen",
    slug: "minimalist-brass-pen",
    description: "Precisely machined solid brass ballpoint writer. Takes standard Parker G2 refills. Develops an exquisite custom patina with daily creative use.",
    price: 49,
    stock: 35,
    sku: "STAT-001",
    images: ["https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=600&q=80"],
    category: "cat-3"
  },
  {
    _id: "prod-5",
    name: "Premium Linen Notebook",
    slug: "premium-linen-notebook",
    description: "A5 hardbound notebook with premium 120GSM Swiss thread-bound pages, custom ribbon bookmarks, and structured dot-grid layout sheets.",
    price: 24,
    stock: 50,
    sku: "STAT-002",
    images: ["https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=600&q=80"],
    category: "cat-3"
  }
];
