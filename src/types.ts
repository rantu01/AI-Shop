export interface Category {
  _id: string;
  name: string;
  slug: string;
  image: string;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  sku: string; // SKU / Product Code
  images: string[];
  category: string; // Category ID
}

export interface WhatsAppLog {
  id: string;
  timestamp: string;
  from: string;
  message: string;
  response?: string;
  type: 'incoming' | 'outgoing' | 'system';
}

export interface WhatsAppSession {
  connected: boolean;
  qrCode?: string;
  phoneNumber?: string;
  status: 'disconnected' | 'connecting' | 'connected';
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  _id: string;
  userEmail: string;
  items: OrderItem[];
  total: number;
  stripePaymentIntentId: string;
  status: 'pending' | 'completed' | 'failed' | 'canceled';
  paymentMethod?: 'stripe' | 'method2';
  validationAttempts?: number;
  trxId?: string;
  createdAt: string;
}

export interface UserProfile {
  email: string;
  name: string;
  photoURL: string;
  phoneNumber: string;
  shippingAddress: string;
}

