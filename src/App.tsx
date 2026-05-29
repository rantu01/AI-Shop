import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import HomeView from "./components/HomeView";
import ProductDetailsView from "./components/ProductDetailsView";
import AdminDashboard from "./components/AdminDashboard";
import CustomerDashboard from "./components/CustomerDashboard";
import { customOnAuthStateChanged, customSignInWithEmail, customSignInWithGoogle } from "./lib/firebase";
import { Category, Product } from "./types";
import { Store, Key, AlertTriangle, Play, LogIn, Laptop, Globe, MessageSquare, Terminal } from "lucide-react";

export default function App() {
  // Navigation Routing States
  const [currentView, setCurrentView] = useState<'shop' | 'admin' | 'product-details' | 'dashboard'>('shop');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Firebase Auth user state
  const [user, setUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Database lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dbStatus, setDbStatus] = useState({ connected: false, mode: "In-Memory Sandbox DB" });
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 1. Initial Data Fetching Hydration
  useEffect(() => {
    fetchStorefrontData();

    // Subscribe to Firebase auth callback states
    const unsubscribe = customOnAuthStateChanged((currentUser: any) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const fetchStorefrontData = async () => {
    try {
      // 1. Fetch Health to see DB connection mode
      const statusRes = await fetch("/api/health");
      if (statusRes.ok) {
        const body = await statusRes.json();
        setDbStatus({
          connected: body.db.connected,
          mode: body.db.mode
        });
      }

      // 2. Fetch categories and products listing
      const [catsRes, prodsRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/products")
      ]);

      if (catsRes.ok) {
        const cats = await catsRes.json();
        setCategories(cats);
      }
      if (prodsRes.ok) {
        const prods = await prodsRes.json();
        setProducts(prods);
      }
    } catch (e) {
      console.warn("API fetches failed on loader. Using default memory list:", e);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleNavigate = (view: 'shop' | 'admin' | 'dashboard', payload?: any) => {
    setCurrentView(view);
    fetchStorefrontData();
    if (view === 'shop') {
      setSelectedProduct(null);
    }
    if (payload && payload.product) {
      setSelectedProduct(payload.product);
      setCurrentView('product-details');
    }
  };

  const handleAddToCart = (sku: string) => {
    // If user is not authenticated, we can optionally prompt authentication or allow guest cart items
    const guestCartKey = "storebot_cart_guest";
    const userCartKey = user?.email ? `storebot_cart_${user.email}` : guestCartKey;
    
    let currentCart: Array<{ sku: string; quantity: number }> = [];
    const stored = localStorage.getItem(userCartKey);
    if (stored) {
      try {
        currentCart = JSON.parse(stored);
      } catch (err) {
        console.error("Failed loading local cart items list", err);
      }
    }

    const existingIndex = currentCart.findIndex((item) => item.sku === sku);
    if (existingIndex !== -1) {
      currentCart[existingIndex].quantity += 1;
    } else {
      currentCart.push({ sku, quantity: 1 });
    }

    localStorage.setItem(userCartKey, JSON.stringify(currentCart));
  };

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setCurrentView('product-details');
  };

  // Auth Submit Action for the regular shopper sign in popup
  const handleClientAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr("");
    setAuthLoading(true);
    try {
      await customSignInWithEmail(authEmail, authPass);
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPass("");
    } catch (err: any) {
      setAuthErr(err.message || "Credential authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSimAuth = async () => {
    try {
      await customSignInWithGoogle();
      setAuthModalOpen(false);
    } catch (e: any) {
      setAuthErr(e.message || "Failed Google Auth.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
      
      {/* Dynamic Splash Screen on bootstrap */}
      {loadingInitial ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-white">
          <div className="flex flex-col items-center space-y-4">
            <Store className="h-12 w-12 text-indigo-400 animate-pulse" />
            <h1 className="font-display text-lg font-bold">Initializing E-commerce Server...</h1>
            <p className="text-xs text-slate-500 font-mono">Bypassing Node CORS & Hydrating Schema Models</p>
          </div>
        </div>
      ) : null}

      {/* Header Sticky Navigation */}
      {currentView !== 'dashboard' && (
        <Header
          currentView={currentView}
          onNavigate={handleNavigate}
          user={user}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dbStatus={dbStatus}
        />
      )}

      {/* Core Main Container Layout body */}
      <main className={`mx-auto w-full flex-1 ${currentView === 'dashboard' ? 'max-w-none px-0 py-0' : 'max-w-7xl px-4 py-8 sm:px-6 lg:px-8'}`}>
        {currentView === 'shop' && (
          <HomeView
            categories={categories}
            products={products}
            onSelectProduct={handleSelectProduct}
            searchQuery={searchQuery}
          />
        )}

        {currentView === 'product-details' && selectedProduct && (
          <ProductDetailsView
            product={selectedProduct}
            categories={categories}
            products={products}
            onBack={() => handleNavigate('shop')}
            onAddToCart={handleAddToCart}
            onSelectProduct={(p) => setSelectedProduct(p)}
          />
        )}

        {currentView === 'admin' && (
          <AdminDashboard
            categories={categories}
            products={products}
            onRefreshData={fetchStorefrontData}
            user={user}
            onOpenAuthModal={() => setAuthModalOpen(true)}
          />
        )}

        {currentView === 'dashboard' && (
          <CustomerDashboard
            user={user}
            onNavigateBack={() => handleNavigate('shop')}
            products={products}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onUserUpdated={setUser}
          />
        )}
      </main>

      {/* Modern Humble Minimal Footer */}
      {currentView !== 'dashboard' && (
        <footer className="border-t border-slate-200 bg-white py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-slate-300" />
              <span>&copy; 2026 Shera Sawda Inc. All Rights Reserved.</span>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleNavigate('admin')}
                className="text-slate-400 hover:text-indigo-600 font-medium transition-colors"
                id="footer-admin-login"
              >
                Admin Login
              </button>
              <span>|</span>
              <span>Server UTC Time: <strong>2026-05-29 04:23:55</strong></span>
              <span className="hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <Laptop className="h-3.5 w-3.5" />
                <span>Full-Stack Sandboxed Dev Node</span>
              </span>
            </div>
          </div>
        </footer>
      )}

      {/* SHOPIFY AUTH DIALOG PORTAL MODAL */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" id="auth-modal">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-display text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <Key className="h-4 w-4 text-indigo-600" />
                <span>Sign In Securely</span>
              </h3>
              <button 
                onClick={() => setAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
                id="close-auth-modal"
              >
                Close
              </button>
            </div>

            {authErr && (
              <div className="bg-red-50 text-red-600 p-2.5 rounded-lg text-xs leading-normal border border-red-100 flex items-start gap-1">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{authErr}</span>
              </div>
            )}

            <form onSubmit={handleClientAuthSubmit} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Coordinates</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. shopper@gmail.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  id="modal-email"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Passphrase Code</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={authPass}
                  onChange={(e) => setAuthPass(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  id="modal-password"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
                id="modal-submit-btn"
              >
                {authLoading ? "Authenticating..." : "Enter Storefront"}
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase font-bold tracking-widest">Or login via</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={handleGoogleSimAuth}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              id="modal-google-btn"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.83z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.32 14.24a7.16 7.16 0 0 1 0-4.48V6.61H1.21a11.94 11.94 0 0 0 0 10.78l4.11-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 6.61l4.11 3.15c.94-2.85 3.57-4.96 6.68-4.96z"
                />
              </svg>
              <span>Authenticating with Google Account</span>
            </button>

            <div className="bg-slate-50 rounded-xl p-3 border text-[10px] text-slate-500 text-center leading-normal">
              Admin users should sign in directly inside the main <strong>Admin Console tab</strong> using sample email <strong>admin@test.com</strong>.
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
