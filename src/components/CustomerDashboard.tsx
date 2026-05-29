import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  History, 
  User as UserIcon, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  ArrowLeft, 
  BadgeCheck, 
  Calendar,
  Layers,
  Sparkles,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { customSignOut } from "../lib/firebase";
import ImageUpload from "./ImageUpload";

interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}

interface Order {
  _id: string;
  userEmail: string;
  items: OrderItem[];
  total: number;
  stripePaymentIntentId: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

interface CustomerDashboardProps {
  user: any;
  onNavigateBack: () => void;
  products: any[];
  onOpenAuthModal?: () => void;
  onUserUpdated?: (user: any) => void;
}

export default function CustomerDashboard({ 
  user, 
  onNavigateBack, 
  products, 
  onOpenAuthModal,
  onUserUpdated 
}: CustomerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'cart' | 'history' | 'profile'>('cart');
  
  // Cart state persisted via localStorage
  const [cart, setCart] = useState<Array<{ sku: string; quantity: number }>>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Billing Form for simulated / real Stripe processing
  const [cardHolder, setCardHolder] = useState(user?.displayName || "");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("392");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState<Order | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  // Customer Profile Settings states
  const [profName, setProfName] = useState("");
  const [profPhotoUrl, setProfPhotoUrl] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profAddress, setProfAddress] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load profile when user changes
  useEffect(() => {
    if (user?.email) {
      fetchUserProfile();
    }
  }, [user?.email]);

  const fetchUserProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/profile?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setProfName(data.name || user.displayName || "");
        setProfPhotoUrl(data.photoURL || user.photoURL || "");
        setProfPhone(data.phoneNumber || "");
        setProfAddress(data.shippingAddress || "");

        // Sync with parent user details if they differs
        if (onUserUpdated && (data.name !== user.displayName || data.photoURL !== user.photoURL)) {
          onUserUpdated({
            ...user,
            displayName: data.name || user.displayName,
            photoURL: data.photoURL || user.photoURL
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch user profile info:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: profName,
          photoURL: profPhotoUrl,
          phoneNumber: profPhone,
          shippingAddress: profAddress
        })
      });

      if (!res.ok) {
        throw new Error("Could not preserve user settings.");
      }

      const body = await res.json();
      if (body.success) {
        setProfileMessage({ type: 'success', text: "Your settings and display coordinates have been saved successfully!" });
        
        // Update simulated credentials
        const savedSimulatedUser = localStorage.getItem("simulated_firebase_user");
        let updatedUser = { ...user, displayName: profName, photoURL: profPhotoUrl };
        if (savedSimulatedUser) {
          try {
            const parsed = JSON.parse(savedSimulatedUser);
            if (parsed.email === user.email) {
              const freshSimUser = { ...parsed, displayName: profName, photoURL: profPhotoUrl };
              localStorage.setItem("simulated_firebase_user", JSON.stringify(freshSimUser));
              updatedUser = freshSimUser;
            }
          } catch (e) {
            console.error(e);
          }
        }
        
        if (onUserUpdated) {
          onUserUpdated(updatedUser);
        }
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || "Failed to update profile coordinates." });
    } finally {
      setProfileSaving(false);
    }
  };

  // Load cart on component mount
  useEffect(() => {
    const activeCartKey = user?.email ? `storebot_cart_${user.email}` : "storebot_cart_guest";
    const stored = localStorage.getItem(activeCartKey);
    if (stored) {
      try {
        setCart(JSON.parse(stored));
      } catch (e) {
        console.error("Failed loading local cart state", e);
      }
    } else {
      setCart([]);
    }
    
    if (user?.email) {
      fetchOrderHistory();
    } else {
      setOrders([]);
    }
  }, [user]);

  // Sync cart helper
  const saveCart = (updatedCart: Array<{ sku: string; quantity: number }>) => {
    setCart(updatedCart);
    const activeCartKey = user?.email ? `storebot_cart_${user.email}` : "storebot_cart_guest";
    localStorage.setItem(activeCartKey, JSON.stringify(updatedCart));
  };

  const fetchOrderHistory = async () => {
    if (!user?.email) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error("Failed bringing up history of purchases", e);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Convert cart SKUs to rich product listings
  const enrichedCartItems = cart.map(item => {
    const prod = products.find(p => p.sku === item.sku);
    return {
      sku: item.sku,
      quantity: item.quantity,
      product: prod || {
        name: "Unknown Product SKU",
        price: 99,
        category: "Other",
        images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"]
      }
    };
  });

  const cartTotal = enrichedCartItems.reduce((acc, current) => {
    return acc + (current.product.price * current.quantity);
  }, 0);

  const handleUpdateQty = (sku: string, val: number) => {
    const targetItem = enrichedCartItems.find(i => i.sku === sku);
    if (!targetItem) return;
    
    let currentQty = targetItem.quantity + val;
    let maxStock = targetItem.product.stock !== undefined ? targetItem.product.stock : 99;

    if (currentQty <= 0) {
      // remove
      const updated = cart.filter(c => c.sku !== sku);
      saveCart(updated);
    } else {
      // cap at stock if stock exists
      if (currentQty > maxStock) {
        currentQty = maxStock;
      }
      const updated = cart.map(c => {
        if (c.sku === sku) {
          return { ...c, quantity: currentQty };
        }
        return c;
      });
      saveCart(updated);
    }
  };

  const handleRemoveFromCart = (sku: string) => {
    const updated = cart.filter(c => c.sku !== sku);
    saveCart(updated);
  };

  const handleCheckoutProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setCheckoutError("");
    setCheckoutSuccess(null);

    try {
      // Execute payment charge to server's endpoint
      const res = await fetch("/api/payment/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: user.email,
          items: cart
        })
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Payment transaction processing failed.");
      }

      if (body.success) {
        setCheckoutSuccess(body.order);
        // Clear active shopping cart state
        saveCart([]);
        // Sync history immediately
        fetchOrderHistory();
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Something went wrong during payment authorization.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-[750px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      
      {/* 1. LEFT SIDEBAR PANEL */}
      <aside className="w-64 border-r border-slate-100 bg-slate-50 p-6 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Identity Header */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">
              Client Portal
            </span>
            <h2 className="font-display font-bold text-lg text-slate-800 tracking-tight">Shopper Lounge</h2>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('cart'); setCheckoutSuccess(null); }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition-all ${
                activeTab === 'cart'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>My Shopping Cart</span>
              {cart.length > 0 && (
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${activeTab === 'cart' ? 'bg-white text-indigo-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {cart.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('history'); setCheckoutSuccess(null); }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition-all ${
                activeTab === 'history'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <History className="h-4 w-4" />
              <span>Purchase History</span>
              {orders.length > 0 && (
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${activeTab === 'history' ? 'bg-white text-indigo-600' : 'bg-slate-200 text-slate-700'}`}>
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('profile'); setCheckoutSuccess(null); }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition-all ${
                activeTab === 'profile'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <UserIcon className="h-4 w-4" />
              <span>My Account Settings</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-4 pt-6 border-t border-slate-200/60">
          <div className="rounded-xl bg-indigo-50 p-3 text-center border border-indigo-100">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-indigo-500">Stripe Integration</span>
            <span className="text-[10px] text-indigo-800 font-medium">Test Mode Enabled</span>
          </div>

          <button
            onClick={onNavigateBack}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Store</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT STREAM */}
      <div className="flex flex-1 flex-col bg-slate-50/50">
        
        {/* TOP BAR GRID */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {activeTab === 'cart' ? 'Summary Checkout Desk' : activeTab === 'history' ? 'Verified Log Files' : 'Registered Coordinates'}
            </span>
            <h1 className="font-display font-extrabold text-xl text-slate-900 leading-tight">
              {activeTab === 'cart' ? 'Active Digital Cart' : activeTab === 'history' ? 'Stripe Ledger Transactions' : 'Customer Parameters'}
            </h1>
          </div>

          {/* User Status Ribbon */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-xs font-bold text-slate-800">{user?.displayName || "Shopper"}</span>
              <span className="block text-[10px] text-slate-400 font-mono">{user?.email}</span>
            </div>
            <img
              src={user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
              alt="Avatar"
              className="h-10 w-10 rounded-2xl object-cover ring-2 ring-indigo-100 border border-white"
            />
          </div>
        </header>

        {/* CONTENT ENVELOPE */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* TAB 1: SHOPPING CART & STRIPE CHECKOUT */}
          {activeTab === 'cart' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              
              {/* Product item breakdown (Left 3 cols) */}
              <div className="lg:col-span-3 space-y-4">
                {checkoutSuccess ? (
                  /* PURCHASE SUCCESS VIEW */
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center space-y-6 animate-fadeIn">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <BadgeCheck className="h-8 w-8" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="font-display text-lg font-bold text-emerald-900">Payment Processed Successfully!</h3>
                      <p className="text-xs text-emerald-700">Thank you for your purchase. Stocks have been automatically updated.</p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-4 text-left space-y-2.5 shadow-sm">
                      <div className="flex justify-between text-xs text-slate-500 font-mono">
                        <span>Transaction reference ID:</span>
                        <span className="font-bold text-slate-800">{checkoutSuccess.stripePaymentIntentId}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Recipient Email:</span>
                        <span className="font-bold text-slate-800">{checkoutSuccess.userEmail}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-2.5 flex justify-between text-xs">
                        <span className="font-bold text-slate-700">Charged Amount:</span>
                        <span className="font-extrabold text-indigo-600">${checkoutSuccess.total.toFixed(2)} USD</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setCheckoutSuccess(null)}
                      className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                    >
                      Process Another Order
                    </button>
                  </div>
                ) : enrichedCartItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                      <ShoppingBag className="h-6 w-6" />
                    </div>
                    <p className="text-xs text-slate-500">Your shopping cart is currently empty.</p>
                    <button
                      onClick={onNavigateBack}
                      className="inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                    >
                      Explore Products
                    </button>
                  </div>
                ) : (
                  /* LIST OF CART ITEMS */
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Items in Order ({enrichedCartItems.length})</h3>
                    {enrichedCartItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                        <img
                          src={item.product?.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"}
                          alt={item.product.name}
                          className="h-14 w-14 rounded-xl object-cover border"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="truncate text-xs font-bold text-slate-800">{item.product.name}</h4>
                          <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-mono">
                            SKU / Code: {item.sku}
                          </span>
                          <span className="block text-xs font-extrabold text-indigo-600 font-mono">
                            ${(item.product.price || 0).toFixed(2)}
                          </span>
                        </div>
                        
                        {/* Quantity actions */}
                        <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1">
                          <button
                            onClick={() => handleUpdateQty(item.sku, -1)}
                            className="p-1 text-slate-500 hover:text-slate-800"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-extrabold text-slate-700">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQty(item.sku, 1)}
                            className="p-1 text-slate-500 hover:text-slate-800"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveFromCart(item.sku)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Secure Card Payment Desk (Right 2 cols) */}
              <div className="lg:col-span-2">
                {!checkoutSuccess && enrichedCartItems.length > 0 && (
                  <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md space-y-6">
                    <div className="space-y-1">
                      <h3 className="font-display font-extrabold text-sm text-slate-800">Secure Stripe Checkout</h3>
                      <p className="text-xs text-slate-400">Transaction fully encrypted and logged securely on Atlas DB.</p>
                    </div>

                    {checkoutError && (
                      <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 border border-red-100 flex items-start gap-1">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{checkoutError}</span>
                      </div>
                    )}

                    {/* Order summary calculations */}
                    <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-semibold">${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>State VAT Tax (0%):</span>
                        <span className="font-mono">$0.00</span>
                      </div>
                      <div className="border-t border-slate-200/60 pt-2.5 flex justify-between font-extrabold text-slate-800">
                        <span>Order absolute Total:</span>
                        <span className="font-mono text-indigo-600 text-sm">${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Interactive Mock/Stripe Credentials Form */}
                    {!user ? (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 text-center space-y-4">
                        <ShoppingBag className="mx-auto h-8 w-8 text-indigo-500 animate-pulse" />
                        <div className="space-y-1">
                          <h4 className="font-display font-extrabold text-xs text-indigo-950">Anonymous Cart Active</h4>
                          <p className="text-[10px] text-indigo-800 leading-relaxed">
                            Sign in to secure details and authorize your Stripe checkout order.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenAuthModal}
                          className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                        >
                          Sign In / Register now
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleCheckoutProcess} className="space-y-3">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Holder Coordinates</label>
                          <input
                            type="text"
                            required
                            value={cardHolder}
                            onChange={(e) => setCardHolder(e.target.value)}
                            placeholder="Cardholder Name"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stripe Credit Card digits</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              value={cardNumber}
                              onChange={(e) => setCardNumber(e.target.value)}
                              placeholder="4242 4242 4242 4242"
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:bg-white pr-10 font-mono"
                            />
                            <CreditCard className="absolute top-2.5 right-3 h-4 w-4 text-slate-400" />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expiry</label>
                            <input
                              type="text"
                              required
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Card Security Code</label>
                            <input
                              type="text"
                              required
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value)}
                              placeholder="CVC"
                              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:bg-white font-mono"
                            />
                          </div>
                        </div>

                        {/* Checkout Submit triggers payment API */}
                        <button
                          type="submit"
                          disabled={checkoutLoading}
                          className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                        >
                          {checkoutLoading ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                              <span>Authorizing Striped Payment...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4" />
                              <span>Authorize Payment - ${cartTotal.toFixed(2)}</span>
                            </>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: TRANSACTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Verified Stripe Payments Log</h3>
                <button
                  onClick={fetchOrderHistory}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 font-bold hover:bg-slate-50"
                >
                  Refresh Logs
                </button>
              </div>

              {loadingOrders ? (
                <div className="text-center py-12 text-xs text-slate-400 animate-pulse font-mono">
                  Querrying e-commerce transaction history database...
                </div>
              ) : orders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-16 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <History className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-slate-500">No historic payments or processed receipts found for {user?.email}.</p>
                </div>
              ) : (
                /* ORDERS TABLE GRID */
                <div className="space-y-4">
                  {orders.map((ord) => (
                    <div key={ord._id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-4">
                      {/* Order general header metadata */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                            Order Code Approved
                          </span>
                          <span className="font-mono text-xs text-slate-400">ID: {ord._id}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{new Date(ord.createdAt).toLocaleDateString()}</span>
                          </span>
                          <span className="font-bold text-slate-800">${ord.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Items loop */}
                      <div className="divide-y divide-slate-100">
                        {ord.items?.map((item, idy) => (
                          <div key={idy} className="flex items-center justify-between gap-4 py-3 text-xs">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-10 w-10 rounded-lg object-cover border"
                              />
                              <div>
                                <h4 className="font-bold text-slate-800">{item.name}</h4>
                                <span className="block text-[10px] text-slate-400 font-mono uppercase">
                                  SKU: {item.sku} &bull; Qty: {item.quantity}
                                </span>
                              </div>
                            </div>
                            <span className="font-bold text-slate-600 font-mono">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom row: payment details */}
                      <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-slate-300" />
                          <span>Stripe Intent Reference:</span>
                          <span className="font-bold text-indigo-600">{ord.stripePaymentIntentId}</span>
                        </div>
                        <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-[9px] font-extrabold text-emerald-800 uppercase tracking-widest">
                          Charged &amp; Fulfilled
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACCOUNT PROFILE */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl rounded-3xl border border-slate-100 bg-white p-6 shadow-md space-y-6">
              <div className="space-y-1">
                <h3 className="font-display font-extrabold text-slate-800 text-sm">My Account Settings</h3>
                <p className="text-xs text-slate-400">Update your shopper parameters and physical coordinates.</p>
              </div>

              {profileLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <span className="text-xs text-slate-500 font-mono">Synchronizing coordinates...</span>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-6 border-t border-slate-100 pt-6">
                  {profileMessage && (
                    <div className={`p-4 rounded-xl text-xs font-bold ${
                      profileMessage.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      {profileMessage.type === 'success' ? "✓ " : "⚠️ "} {profileMessage.text}
                    </div>
                  )}

                  {/* Profile Image Cloudinary Upload block */}
                  <div>
                    <ImageUpload
                      label="Upload Shopper Portrait (Cloudinary)"
                      onUploadComplete={(url) => setProfPhotoUrl(url)}
                      currentImageUrl={profPhotoUrl}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Primary Name Field (Mutable) */}
                    <div className="space-y-1.5Col">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={profName}
                        onChange={(e) => setProfName(e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                        placeholder="John Doe"
                      />
                    </div>

                    {/* Email Field (Strictly Read-Only/Disabled) */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Primary Login Email (Disabled)</label>
                      <input
                        type="email"
                        disabled
                        value={user?.email || "shopper@test.com"}
                        className="w-full text-xs font-semibold text-slate-400 rounded-xl border border-slate-200 px-3.5 py-2.5 bg-slate-100 cursor-not-allowed select-none"
                        title="Your primary email credential cannot be altered."
                      />
                    </div>

                    {/* Phone Number Field */}
                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={profPhone}
                        onChange={(e) => setProfPhone(e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                        placeholder="e.g. +1 (555) 019-2834"
                      />
                    </div>

                    {/* Shipping Address */}
                    <div className="space-y-1.5 col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Default Shipping Address</label>
                      <textarea
                        value={profAddress}
                        onChange={(e) => setProfAddress(e.target.value)}
                        className="w-full text-xs font-bold text-slate-800 rounded-xl border border-slate-200 px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white min-h-[80px]"
                        placeholder="Please type your complete door dispatch address here."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-4">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {profileSaving ? "Saving Settings..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
