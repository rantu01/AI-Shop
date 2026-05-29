import React, { useState, useEffect, useRef } from "react";
import { Category, Product, WhatsAppLog, WhatsAppSession } from "../types";
import { 
  FolderOpen, Plus, Edit, Trash2, Smartphone, RefreshCw, Send, 
  Database, HelpCircle, Key, KeyRound, AlertTriangle, CheckCircle, 
  MessageSquare, User, Bot, WifiOff, Wifi, Play, Sparkles, LogIn, ChevronRight, CornerDownLeft
} from "lucide-react";
import { customSignInWithEmail, customSignInWithGoogle } from "../lib/firebase";
import ImageUpload from "./ImageUpload";

interface AdminDashboardProps {
  categories: Category[];
  products: Product[];
  onRefreshData: () => void;
  user: any;
  onOpenAuthModal: () => void;
}

export default function AdminDashboard({
  categories,
  products,
  onRefreshData,
  user,
  onOpenAuthModal
}: AdminDashboardProps) {
  
  // Tabs and general controls
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'automation'>('products');
  
  // Client Authentication
  const [emailInput, setEmailInput] = useState("admin@test.com");
  const [passInput, setPassInput] = useState("admin123");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Categories Form State
  const [catName, setCatName] = useState("");
  const [catImage, setCatImage] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Products Form State
  const [prodName, setProdName] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodImage, setProdImage] = useState("");
  const [prodCat, setProdCat] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [skuDuplicateWarning, setSkuDuplicateWarning] = useState<string | null>(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");

  // Auto-Generate SKU handler
  const handleGenerateSku = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generated = `SS-${rand}`;
    setProdSku(generated);
  };

  // Real-time SKU validation effect with debounce
  useEffect(() => {
    if (!prodSku.trim()) {
      setSkuDuplicateWarning(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const excludeId = editingProduct ? editingProduct._id : "";
        const res = await fetch(`/api/products/validate-sku?sku=${encodeURIComponent(prodSku)}&excludeId=${encodeURIComponent(excludeId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isDuplicate) {
            setSkuDuplicateWarning("This SKU already exists! Please use a unique code.");
          } else {
            setSkuDuplicateWarning(null);
          }
        }
      } catch (err) {
        console.error("SKU real-time check error:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [prodSku, editingProduct]);

  // WhatsApp Automation Console State
  const [session, setSession] = useState<WhatsAppSession>({ connected: false, status: 'disconnected' });
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [simPhoneNumber, setSimPhoneNumber] = useState("+1 (555) 728-1920");

  // Interactive Simulator chat console
  const [simCustomerMsg, setSimCustomerMsg] = useState("");
  const [simCustomerPhone, setSimCustomerPhone] = useState("+12345678");
  const [simulatorChat, setSimulatorChat] = useState<Array<{ sender: 'user' | 'bot' | 'system', text: string, timestamp: string }>>([
    { sender: 'system', text: "WhatsApp Chat simulator loaded. Connect WhatsApp to chat.", timestamp: new Date().toLocaleTimeString() }
  ]);
  const [chatSubmitting, setChatSubmitting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Polling variables
  useEffect(() => {
    if (user && user.isAdmin) {
      fetchSessionStatus();
      fetchLogs();
      const interval = setInterval(() => {
        fetchLogs();
        fetchSessionStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simulatorChat]);

  const fetchSessionStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      setSession(data);
    } catch (e) {
      console.error("Failed to fetch session", e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/whatsapp/logs");
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Failed to logs", e);
    }
  };

  // --- ACTIONS: AUTHENTICATION ---
  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await customSignInWithEmail(emailInput, passInput);
    } catch (err: any) {
      setAuthError(err.message || "Failed admin connection.");
    } finally {
      setAuthLoading(false);
    }
  };

  // --- ACTIONS: CATEGORIES ---
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCategorySubmitting(true);
    
    // Prepare data
    const payload = {
      name: catName,
      image: catImage || "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=600&q=80"
    };

    try {
      let res;
      if (editingCategory) {
        res = await fetch(`/api/categories/${editingCategory._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setCatName("");
        setCatImage("");
        setEditingCategory(null);
        onRefreshData();
      }
    } catch (err) {
      console.error("Category submission failed", err);
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatImage(cat.image);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Caution: Deleting this category will cascade delete all child products! Proceed?")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        onRefreshData();
        if (editingCategory?._id === id) {
          setEditingCategory(null);
          setCatName("");
          setCatImage("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- ACTIONS: PRODUCTS ---
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (skuDuplicateWarning) {
      alert("Please resolve the duplicate SKU warning before submitting.");
      return;
    }
    if (!prodName.trim() || !prodSku.trim() || !prodPrice || !prodStock) return;
    
    setProductSubmitting(true);
    const payload = {
      name: prodName,
      sku: prodSku.trim().toUpperCase(),
      price: Number(prodPrice),
      stock: Number(prodStock),
      description: prodDesc,
      category: prodCat || (categories[0]?._id),
      images: prodImage ? [prodImage] : undefined
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setProdName("");
        setProdSku("");
        setProdPrice("");
        setProdStock("");
        setProdDesc("");
        setProdImage("");
        setProdCat("");
        setEditingProduct(null);
        onRefreshData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to commit product");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdSku(prod.sku);
    setProdPrice(prod.price.toString());
    setProdStock(prod.stock.toString());
    setProdDesc(prod.description);
    setProdCat(prod.category);
    setProdImage(prod.images[0] || "");
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        onRefreshData();
        if (editingProduct?._id === id) {
          setEditingProduct(null);
          setProdName("");
          setProdSku("");
          setProdPrice("");
          setProdStock("");
          setProdDesc("");
          setProdImage("");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- ACTIONS: WHATSAPP BOT CONNECTIVITY MOCKUP ---
  const handleGenerateQR = async () => {
    setLoadingSession(true);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      setSession(data);
      fetchLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSimulateScan = async () => {
    try {
      const res = await fetch("/api/whatsapp/simulate-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: simPhoneNumber })
      });
      const data = await res.json();
      setSession(data);
      fetchLogs();
      setSimulatorChat([
        { sender: 'system', text: `Connected WhatsApp to ${simPhoneNumber}. Session listener live!`, timestamp: new Date().toLocaleTimeString() }
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    try {
      const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
      const data = await res.json();
      setSession(data);
      fetchLogs();
      setSimulatorChat([
        { sender: 'system', text: "Session closed by administrator action.", timestamp: new Date().toLocaleTimeString() }
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch("/api/whatsapp/logs/clear", { method: "POST" });
      fetchLogs();
    } catch (e) {
      console.error(e);
    }
  };

  // --- ACTION: SEND SIMULATED CHAT FROM MULTI-USER SIMULATOR ---
  const handleSendSimultedMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simCustomerMsg.trim() || chatSubmitting) return;

    const queryText = simCustomerMsg;
    setSimCustomerMsg("");
    setChatSubmitting(true);

    // Append raw customer message locally inside simulation panel
    setSimulatorChat(prev => [...prev, {
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      // Send webhook to Express server
      const res = await fetch("/api/whatsapp/simulate-incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: simCustomerPhone,
          message: queryText
        })
      });

      const data = await res.json();
      if (data.success || data.reply) {
        // Append Bot outgoing response
        setSimulatorChat(prev => [...prev, {
          sender: 'bot',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
      fetchLogs();
    } catch (e) {
      console.error(e);
    } finally {
      setChatSubmitting(false);
    }
  };

  // --- VIEW RENDER BLOCK FOR NON-ADMIN ---
  if (!user || !user.isAdmin) {
    return (
      <div className="mx-auto max-w-md my-12 bg-white rounded-3xl border border-slate-200 p-8 shadow-xl">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <LockIcon className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-extrabold text-slate-900">Admin Authentication Required</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Access to this module is strictly bound to authorized administrators. Connect via Firebase Auth console below.
          </p>
        </div>

        {authError && (
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAdminSignIn} className="mt-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Coordinates</label>
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs outline-none focus:border-indigo-500 focus:bg-white"
              id="admin-email"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Passphrase Code</label>
            <input
              type="password"
              required
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs outline-none focus:border-indigo-500 focus:bg-white"
              id="admin-password"
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/10 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            id="admin-login-submit"
          >
            {authLoading ? "Verifying coordinates..." : "Connect Firebase Authorized Admin"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Demo Quick Pass (Firebase Simulation)</p>
            <p className="text-xs text-slate-600 leading-normal">
              Enter email <span className="font-mono bg-white px-1 py-0.5 rounded border font-semibold">admin@test.com</span> with password <span className="font-mono bg-white px-1 py-0.5 rounded border font-semibold">admin123</span> to gain immediate simulated access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN ADMIN PANEL SHOWCASE VIEW ---
  return (
    <div className="space-y-8">
      
      {/* 1. SECTION HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Administrator Control Desk</h1>
          <p className="text-xs text-slate-500 mt-1">Configure categories, update physical inventory list, or deploy the conversational WhatsApp Gemini Bot.</p>
        </div>

        {/* Action Header Nav */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'products' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-600'}`}
            id="tab-products"
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === 'categories' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-indigo-600'}`}
            id="tab-categories"
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'automation' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-600 hover:text-indigo-600'
            }`}
            id="tab-automation"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>AI WhatsApp Bot</span>
          </button>
        </div>
      </div>

      {/* 2. PRODUCTS TAB CONTENT */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Product form creator (Span 4) */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 self-start">
            <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-1">
              <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
              <span>{editingProduct ? "Modify Product SKU" : "Register Product"}</span>
            </h3>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product Code (SKU)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. ELEC-003"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white text-slate-800"
                    id="prod-sku-input"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                    id="btn-auto-generate-sku"
                  >
                    Auto SKU
                  </button>
                </div>
                {skuDuplicateWarning && (
                  <p className="mt-1.5 text-[10px] text-red-600 font-bold leading-normal">
                    ⚠️ {skuDuplicateWarning}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ergonomic Office Chair"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  id="prod-name-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Retail Price ($)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="250"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                    id="prod-price-input"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stock Count</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="15"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                    id="prod-stock-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Catalog Category</label>
                <select
                  value={prodCat}
                  onChange={(e) => setProdCat(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  id="prod-category-select"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unsplash JPEG Image Link</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white mb-2"
                  id="prod-image-input"
                />
                <ImageUpload
                  label="Or Drag/Drop & Upload to Cloudinary"
                  currentImageUrl={prodImage || undefined}
                  onUploadComplete={(url) => setProdImage(url)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Details Sheet Description</label>
                <textarea
                  rows={3}
                  placeholder="Detailed layout specs, characteristics, features..."
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  id="prod-desc-input"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={productSubmitting}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
                  id="product-save-btn"
                >
                  {editingProduct ? "Save Changes" : "Create Product"}
                </button>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setProdName("");
                      setProdSku("");
                      setProdPrice("");
                      setProdStock("");
                      setProdDesc("");
                      setProdCat("");
                      setProdImage("");
                    }}
                    className="rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Product data grid (Span 8) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">Current Catalog Inventory</h3>
                <p className="text-xs text-slate-500">Total {products.length} registered products</p>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search by SKU / Name..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white text-slate-800"
                  id="admin-sku-search-input"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3">Item details</th>
                    <th className="py-3">Category</th>
                    <th className="py-3">SKU</th>
                    <th className="py-3">Price</th>
                    <th className="py-3">Inventory</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {products
                    .filter(prod => {
                      if (!adminSearchQuery.trim()) return true;
                      const q = adminSearchQuery.trim().toLowerCase();
                      return (prod.sku || "").toLowerCase().includes(q) || (prod.name || "").toLowerCase().includes(q);
                    })
                    .map((prod) => {
                    const parentCat = categories.find(c => c._id === prod.category);
                    return (
                      <tr key={prod._id} className="hover:bg-slate-50/50">
                        <td className="py-3 flex items-center gap-3">
                          <img
                            src={prod.images[0]}
                            alt={prod.name}
                            className="h-9 w-9 rounded-lg object-cover bg-slate-50 shrink-0"
                          />
                          <span className="font-bold text-slate-800 line-clamp-1">{prod.name}</span>
                        </td>
                        <td className="py-3 text-slate-600 font-medium">
                          {parentCat?.name || "Uncategorized"}
                        </td>
                        <td className="py-3 font-mono font-semibold text-indigo-600">
                          {prod.sku}
                        </td>
                        <td className="py-3 font-bold text-slate-800">
                          ${prod.price}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            prod.stock > 0 
                              ? "bg-emerald-50 text-emerald-800" 
                              : "bg-red-50 text-red-800"
                          }`}>
                            {prod.stock} units
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleEditProduct(prod)}
                              className="p-1 px-2 rounded hover:bg-slate-100 text-slate-600 hover:text-indigo-600"
                              title="Edit product info"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod._id)}
                              className="p-1 px-2 rounded hover:bg-slate-100 text-red-500 hover:text-red-700"
                              title="Delete product list"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* 3. CATEGORIES TAB CONTENT */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Create category card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4 self-start">
            <h3 className="font-display text-lg font-bold text-slate-900">
              {editingCategory ? "Change Category Details" : "Create New Catalog Category"}
            </h3>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Supplies"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  id="cat-name-input"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Banner Splash URL Image</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={catImage}
                  onChange={(e) => setCatImage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white mb-2"
                  id="cat-image-input"
                />
                <ImageUpload
                  label="Or Drag/Drop & Upload to Cloudinary"
                  currentImageUrl={catImage || undefined}
                  onUploadComplete={(url) => setCatImage(url)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={categorySubmitting}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
                >
                  {editingCategory ? "Update details" : "Register Category"}
                </button>
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategory(null);
                      setCatName("");
                      setCatImage("");
                    }}
                    className="rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List category index cards */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">Existing Categories</h3>
            
            <div className="space-y-3">
              {categories.map((cat) => (
                <div key={cat._id} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-2xl hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="h-10 w-16 object-cover rounded-xl bg-slate-50 shrink-0"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{cat.name}</h4>
                      <p className="text-[10px] font-mono text-slate-400">slug: {cat.slug}</p>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditCategory(cat)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-indigo-600"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat._id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. AI WHATSAPP BOT AUTOMATION TAB CONTENT */}
      {activeTab === 'automation' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Left Block UI: Connection Portal (Span 5) */}
          <div className="xl:col-span-5 flex flex-col gap-6">
            
            {/* Connection state control hub */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-indigo-500" />
                  <span>Baileys Gateway Console</span>
                </h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${
                  session.connected 
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                    : session.status === 'connecting' 
                      ? "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse" 
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}>
                  {session.connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  <span>
                    {session.connected 
                      ? "CONNECTED (AUTHENTICATED)" 
                      : session.status === 'connecting' 
                        ? "CONNECTING..." 
                        : "DISCONNECTED (SHOW QR CODE)"}
                  </span>
                </span>
              </div>

              {/* Status explanation */}
              <p className="text-xs text-slate-500 leading-normal">
                Generates a secure dynamic connection session. Scanning the QR code binds your WhatsApp device, allowing the Gemini Sales Agent to listen and respond using MongoDB.
              </p>

              {/* Sandbox Warning Notice */}
              <div className="bg-amber-50/80 border border-amber-200 text-amber-900 rounded-2xl p-4 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <span className="text-lg shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">WhatsApp Linked Device Guidelines:</h4>
                    <p className="text-[11px] text-amber-900/95 leading-relaxed mt-1 font-medium">
                      এই QR কোডটি এখন একটি <strong>লাইভ WhatsApp Web linking QR</strong>। আপনার মোবাইল WhatsApp এর <strong>Linked devices</strong> দিয়ে স্ক্যান করলে session connect হবে, invalid code দেখাবে না.
                    </p>
                    <p className="text-[11px] text-amber-900/95 leading-relaxed mt-2 font-medium">
                      <strong>✅ কীভাবে কানেক্ট করবেন (How to Connect):</strong> নিচের QR টি <strong>WhatsApp &gt; Linked devices &gt; Link a device</strong> দিয়ে স্ক্যান করুন। স্ক্যান সফল হলে session status <strong>"CONNECTED"</strong> হবে। Demo button শুধু sandbox fallback হিসেবে রাখা আছে.
                    </p>
                    <div className="border-t border-amber-200/50 pt-2 mt-2 text-[10px] text-amber-700 font-sans italic leading-normal">
                      Note: This QR is for linked-device login, not a normal WhatsApp chat link. Use the simulator only if you need to fake a connected session for testing.
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Presentation Panel */}
              {session.status === 'disconnected' && (
                <div className="flex flex-col items-center space-y-4 p-5 border border-slate-200 bg-slate-50 rounded-2xl">
                  <div className="text-center space-y-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 border border-rose-100 uppercase tracking-widest">
                      🔴 Disconnected (Show QR Code)
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">Scan Below or Initialize Connection</h4>
                    <p className="text-[10px] text-slate-400">Scan this QR directly to synchronize authenticated sessions.</p>
                  </div>

                  {/* Visual QR IMG code block shown immediately */}
                  <div className="p-4 bg-white rounded-xl shadow-md border border-slate-100 ring-4 ring-slate-100">
                    {session.qrCode && session.qrCode.startsWith("data:") ? (
                      <img 
                        src={session.qrCode} 
                        alt="WhatsApp QR Code" 
                        className="h-40 w-40 object-contain mx-auto block font-sans"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="160" height="160" className="mx-auto block" style={{ background: '#fff' }}>
                        <rect x="0" y="0" width="30" height="30" fill="#030712"/>
                        <rect x="5" y="5" width="20" height="20" fill="#fff"/>
                        <rect x="10" y="10" width="10" height="10" fill="#030712"/>
                        <rect x="70" y="0" width="30" height="30" fill="#030712"/>
                        <rect x="75" y="5" width="20" height="20" fill="#fff"/>
                        <rect x="80" y="10" width="10" height="10" fill="#030712"/>
                        <rect x="0" y="70" width="30" height="30" fill="#030712"/>
                        <rect x="5" y="75" width="20" height="20" fill="#fff"/>
                        <rect x="10" y="80" width="10" height="10" fill="#030712"/>
                        <rect x="40" y="40" width="20" height="20" fill="#030712"/>
                        <rect x="45" y="45" width="10" height="10" fill="#fff"/>
                        <rect x="75" y="40" width="15" height="15" fill="#030712"/>
                        <rect x="40" y="10" width="15" height="15" fill="#030712"/>
                        <rect x="15" y="45" width="15" height="15" fill="#030712"/>
                        <rect x="70" y="70" width="30" height="30" fill="#030712"/>
                        <rect x="75" y="75" width="20" height="20" fill="#fff"/>
                        <rect x="85" y="85" width="5" height="5" fill="#030712"/>
                      </svg>
                    )}
                  </div>

                  <div className="flex gap-2 w-full justify-center">
                    <button
                      onClick={handleGenerateQR}
                      disabled={loadingSession}
                      className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-900 transition-colors disabled:opacity-50"
                      id="generate-qr-btn"
                    >
                      {loadingSession ? "Generating Live Session..." : "Initialize WA Connection"}
                    </button>
                  </div>

                  {/* Scan Simulator nested right in state */}
                  <div className="border-t border-slate-200/60 pt-4 w-full flex flex-col gap-2">
                    <span className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest leading-none">Sandbox Scan Bind</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Sim Phone e.g. +8801814293906"
                        value={simPhoneNumber}
                        onChange={(e) => setSimPhoneNumber(e.target.value)}
                        className="rounded-lg border bg-white border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 text-center flex-1 font-mono font-bold"
                      />
                      <button
                        onClick={handleSimulateScan}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap transition-colors"
                        id="dev-scan-sim"
                      >
                        Simulate QR Scan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {session.status === 'connecting' && (
                <div className="flex flex-col items-center space-y-4 p-5 border border-indigo-150 bg-indigo-50/20 rounded-2xl">
                  <div className="text-center space-y-0.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-700 border border-amber-100 uppercase tracking-widest animate-pulse">
                      ⚡ Connecting...
                    </span>
                    <h4 className="text-xs font-bold text-slate-800">Scan Live Secure QR Code</h4>
                    <p className="text-[10px] text-slate-400">Device authorization token pending scanner handshake.</p>
                  </div>

                  {/* Visual QR Insertion */}
                  {session.qrCode ? (
                    <div className="p-4 bg-white rounded-xl shadow-md border border-slate-100 ring-4 ring-indigo-50">
                      {session.qrCode.startsWith("data:") ? (
                        <img 
                          src={session.qrCode} 
                          alt="WhatsApp QR Code" 
                          className="h-40 w-40 object-contain mx-auto block font-sans"
                          style={{ imageRendering: 'pixelated' }}
                        />
                      ) : (
                        <div 
                          dangerouslySetInnerHTML={{ __html: session.qrCode }}
                          className="mx-auto block"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="h-40 w-40 rounded-xl bg-white border border-slate-100 shadow flex items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                    </div>
                  )}

                  {/* Sandbox Scan simulator helper */}
                  <div className="border-t border-slate-200/60 pt-4 w-full flex flex-col gap-2">
                    <span className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest leading-none">Sandbox Scan Bind</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Sim Phone e.g. +8801814293906"
                        value={simPhoneNumber}
                        onChange={(e) => setSimPhoneNumber(e.target.value)}
                        className="rounded-lg border bg-white border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 text-center flex-1 font-mono font-bold"
                      />
                      <button
                        onClick={handleSimulateScan}
                        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap transition-colors"
                        id="dev-scan-sim-connecting"
                      >
                        Simulate QR Scan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {session.connected && (
                <div className="flex flex-col items-center justify-center border border-emerald-100 bg-emerald-50/10 rounded-2xl py-8 p-5 text-center space-y-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm animate-bounce">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[9px] font-extrabold text-emerald-800 uppercase tracking-widest mb-1.5">
                      ✓ Connected (Authenticated)
                    </span>
                    <h4 className="text-sm font-bold text-slate-800">Connection Standard Secured</h4>
                    <p className="text-xs text-slate-600 font-mono font-bold text-indigo-600 mt-1">{session.phoneNumber}</p>
                  </div>

                  <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                    AI agent is currently monitoring and responding live in-memory using actual Mongoose schemas. Take operations and send webhook logs!
                  </p>

                  <button
                    onClick={handleDisconnectWhatsApp}
                    className="rounded-xl border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50 hover:border-red-300 px-4 py-2 text-xs font-bold transition-all"
                  >
                    Disconnect Channel
                  </button>
                </div>
              )}

            </div>

            {/* Quick configuration specs sheet */}
            <div className="bg-slate-900 rounded-3xl p-5 text-white space-y-3.5 border border-slate-800">
              <h4 className="font-display text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
                <Database className="h-3.5 w-3.5" />
                <span>Integration Flow Guide</span>
              </h4>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Incoming users triggers `/api/whatsapp/simulate-incoming`.
              </p>
              <div className="text-[10px] space-y-2 border-t border-slate-800 pt-3 text-slate-400">
                <p className="flex items-start gap-1"><ChevronRight className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" /> <span><strong>Product SKU Lookup:</strong> Bot programmatically queries products to see if SKU pattern triggers.</span></p>
                <p className="flex items-start gap-1"><ChevronRight className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" /> <span><strong>Incorrect Code Reply:</strong> Strict fallback matches invalid attempted formatting to redirect visitors to website.</span></p>
                <p className="flex items-start gap-1"><ChevronRight className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" /> <span><strong>General Queries:</strong> If no code found, Gemini prompts nicely for Product Code and shows examples.</span></p>
              </div>
            </div>

          </div>

          {/* Right Block UI: Console (logs + live interactive chat simulator) (Span 7) */}
          <div className="xl:col-span-7 flex flex-col gap-6">
            
            {/* Interactive WhatsApp Multi-user Simulator Panel */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
              
              {/* Simulator Header */}
              <div className="bg-[#075e54] text-white p-4 rounded-t-3xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-900/15 flex items-center justify-center text-white text-xs font-extrabold shadow-sm">
                    {session.connected ? "WA" : "❌"}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-none flex items-center gap-2">
                      <span>Simulated Customer Chat Widget</span>
                      <span className="bg-[#128c7e] px-1.5 py-0.5 text-[8px] rounded">SIMULATOR</span>
                    </h4>
                    <p className="text-[10px] text-teal-100 mt-1">
                      {session.connected 
                        ? `Live Bridge: Connected via ${session.phoneNumber}` 
                        : "Connect WhatsApp gateway to test live chats!"
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-teal-100 font-bold hidden sm:inline">User Mobile:</label>
                  <input
                    type="text"
                    value={simCustomerPhone}
                    onChange={(e) => setSimCustomerPhone(e.target.value)}
                    className="bg-[#128c7e] border-none text-white rounded px-2 py-0.5 text-[10px] font-mono w-24 outline-none focus:ring-1 focus:ring-emerald-300"
                    title="Simulate customer phone number"
                  />
                </div>
              </div>

              {/* Chat Viewport Area */}
              <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] space-y-3 flex flex-col custom-scrollbar">
                {simulatorChat.map((msg, idx) => {
                  if (msg.sender === 'system') {
                    return (
                      <div key={idx} className="self-center bg-yellow-100/90 text-yellow-800 text-[10px] font-semibold rounded px-4 py-1 border border-yellow-200 text-center shadow-xs">
                        {msg.text}
                      </div>
                    );
                  }

                  const isBot = msg.sender === 'bot';
                  return (
                    <div 
                      key={idx} 
                      className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs shadow-sm leading-relaxed whitespace-pre-wrap ${
                        isBot 
                          ? "self-start bg-white text-slate-800 border-l-4 border-indigo-500 rounded-tl-none" 
                          : "self-end bg-[#dcf8c6] text-slate-800 rounded-tr-none"
                      }`}
                    >
                      {isBot && (
                        <div className="flex items-center gap-1 mb-1 text-slate-400 font-bold text-[9px] uppercase tracking-wide">
                          <Bot className="h-3 w-3 text-indigo-500" />
                          <span>Gemini Seller (AI)</span>
                        </div>
                      )}
                      <div>{msg.text}</div>
                      <p className="text-right text-[8px] text-slate-400 mt-1">{msg.timestamp}</p>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Area */}
              <form onSubmit={handleSendSimultedMsg} className="p-3 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled={!session.connected || chatSubmitting}
                    placeholder={session.connected ? "Type message as a customer... e.g. Do you sell Studio Headphones?" : "Activate WhatsApp session above to chat..."}
                    value={simCustomerMsg}
                    onChange={(e) => setSimCustomerMsg(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#075e54] disabled:bg-slate-100"
                    id="sim-chat-msg-input"
                  />
                  <button
                    type="submit"
                    disabled={!session.connected || !simCustomerMsg.trim() || chatSubmitting}
                    className="rounded-xl bg-[#075e54] text-white p-2.5 px-4 shadow hover:bg-[#128c7e] transition-all disabled:opacity-45"
                    id="sim-chat-msg-send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>

            </div>

            {/* Server reasoning scrolling Activity logs */}
            <div className="bg-slate-950 text-slate-300 rounded-3xl p-5 border border-slate-800 shadow-lg flex flex-col h-[320px]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3 shrink-0">
                <div>
                  <h4 className="font-display text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>Live AI Debug Reasoning Logs</span>
                  </h4>
                  <p className="text-[9px] text-slate-600 mt-0.5">Refreshed programmatically inside Cloud Container</p>
                </div>
                <button
                  onClick={handleClearLogs}
                  className="rounded bg-slate-800 hover:bg-slate-700 hover:text-white px-2.5 py-1 text-[9px] font-mono text-slate-400 transition-colors"
                >
                  Clear logs
                </button>
              </div>

              {/* Scroll viewport */}
              <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2.5 custom-scrollbar pr-2">
                {logs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleTimeString();
                  
                  return (
                    <div key={log.id} className="border-b border-slate-900/40 pb-2">
                      <div className="flex justify-between text-[8px] text-slate-600 font-semibold mb-0.5">
                        <span>STAMP: {dateStr}</span>
                        <span>SENDER: {log.from}</span>
                      </div>
                      <div className="flex gap-2">
                        {log.type === 'incoming' && (
                          <span className="text-amber-500 font-bold">▶ [INCOMING]</span>
                        )}
                        {log.type === 'outgoing' && (
                          <span className="text-emerald-500 font-bold">◀ [AI BOT]</span>
                        )}
                        {log.type === 'system' && (
                          <span className="text-indigo-400 font-bold">● [ENGINE]</span>
                        )}
                        <span className="text-slate-300 break-words whitespace-pre-wrap">{log.message}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

// Custom locked auth key lock icon
function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
