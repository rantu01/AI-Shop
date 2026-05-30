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
  const [geminiTestMessage, setGeminiTestMessage] = useState("");
  const [geminiTestReply, setGeminiTestReply] = useState("");
  const [geminiReplyLimit, setGeminiReplyLimit] = useState(4);
  const [botSettingsLoading, setBotSettingsLoading] = useState(false);
  const [botSettingsSaving, setBotSettingsSaving] = useState(false);

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
      fetchBotSettings();
      const interval = setInterval(() => {
        fetchLogs();
        fetchSessionStatus();
        fetchBotSettings();
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
      setSession((prev) => {
        if (data?.connected) {
          return data;
        }

        const shouldPreserveQr = Boolean(prev.qrCode) && prev.status === 'connecting' && (data?.status === 'disconnected' || data?.status === 'connecting');
        const nextSession = {
          ...prev,
          ...data,
          qrCode: shouldPreserveQr ? prev.qrCode : (data?.qrCode ?? prev.qrCode),
          phoneNumber: data?.phoneNumber ?? prev.phoneNumber,
          status: shouldPreserveQr ? 'connecting' : (data?.status ?? prev.status)
        };

        return nextSession;
      });
    } catch (e) {
      console.error("Failed to fetch session", e);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/whatsapp/logs");
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Failed to logs", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchBotSettings = async () => {
    setBotSettingsLoading(true);
    try {
      const res = await fetch("/api/whatsapp/bot-settings");
      const data = await res.json();
      if (typeof data?.geminiReplyLimit === "number") {
        setGeminiReplyLimit(data.geminiReplyLimit);
      }
    } catch (e) {
      console.error("Failed to fetch bot settings", e);
    } finally {
      setBotSettingsLoading(false);
    }
  };

  const handleSaveBotSettings = async () => {
    setBotSettingsSaving(true);
    try {
      const res = await fetch("/api/whatsapp/bot-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiReplyLimit: Number(geminiReplyLimit) })
      });

      if (res.ok) {
        await fetchLogs();
      }
    } catch (e) {
      console.error("Failed to save bot settings", e);
    } finally {
      setBotSettingsSaving(false);
    }
  };

  const handleTestGemini = async () => {
    if (!geminiTestMessage.trim()) return;

    try {
      const res = await fetch("/api/whatsapp/test-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: geminiTestMessage })
      });
      const data = await res.json();
      setGeminiTestReply(data.reply || data.error || "No response returned.");
      fetchLogs();
    } catch (e) {
      console.error("Failed Gemini test", e);
      setGeminiTestReply("Gemini test failed.");
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
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-indigo-500" />
                  <span>WhatsApp Linking</span>
                </h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold ${
                  session.connected
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : session.status === 'connecting'
                      ? "bg-amber-50 text-amber-800 border border-amber-200 animate-pulse"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}>
                  {session.connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  <span>{session.connected ? "CONNECTED" : session.status === 'connecting' ? "CONNECTING" : "DISCONNECTED"}</span>
                </span>
              </div>

              <div className="mt-6 flex flex-col items-center gap-5">
                <div className="min-h-40 flex items-center justify-center">
                  {session.connected ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <CheckCircle className="h-10 w-10 text-emerald-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">WhatsApp connected</p>
                        <p className="mt-1 text-xs font-mono text-slate-500">
                          {session.phoneNumber ? session.phoneNumber : "Connected number not reported yet"}
                        </p>
                      </div>
                    </div>
                  ) : session.qrCode && session.qrCode.startsWith("data:") ? (
                    <img
                      src={session.qrCode}
                      alt="WhatsApp QR Code"
                      className="h-48 w-48 object-contain block"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  ) : (
                    <div className="h-48 w-48 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    </div>
                  )}
                </div>

                <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Connected number</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-900 break-all">
                      {session.phoneNumber || "Not connected"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reply mode</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Gemini replies first, then product catalog fallback
                    </p>
                  </div>
                </div>

                {!session.connected ? (
                  <button
                    onClick={handleGenerateQR}
                    disabled={loadingSession}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-black transition-colors disabled:opacity-50"
                    id="generate-qr-btn"
                  >
                    {loadingSession ? "Generating..." : "Initialize WA Connection"}
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnectWhatsApp}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  <span>Gemini Controls</span>
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {botSettingsLoading ? "Loading settings..." : "Live settings"}
                </span>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Gemini reply limit before catalog fallback
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={geminiReplyLimit}
                    onChange={(e) => setGeminiReplyLimit(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-white focus:bg-white text-slate-800"
                    id="gemini-reply-limit-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveBotSettings}
                  disabled={botSettingsSaving}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  id="save-bot-settings-btn"
                >
                  {botSettingsSaving ? "Saving..." : "Save Gemini Limit"}
                </button>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MessageSquare className="h-4 w-4 text-indigo-500" />
                  <span>Test Gemini</span>
                </div>
                <textarea
                  rows={4}
                  value={geminiTestMessage}
                  onChange={(e) => setGeminiTestMessage(e.target.value)}
                  placeholder="Type a product question to test the Gemini response directly..."
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                  id="gemini-test-input"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleTestGemini}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-black transition-colors"
                    id="gemini-test-submit"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Test
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGeminiTestMessage("");
                      setGeminiTestReply("");
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="rounded-2xl bg-slate-950 p-4 text-xs text-slate-100 min-h-24">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Latest Gemini reply</p>
                  <p className="whitespace-pre-wrap leading-6">{geminiTestReply || "No Gemini test has been run yet."}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">Live WhatsApp Logs</h3>
                  <p className="text-xs text-slate-500">Shows every inbound message, reply decision, and connected number.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchLogs}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Current connected WhatsApp number: <span className="font-mono font-bold text-slate-900">{session.phoneNumber || "Not connected"}</span>
              </div>

              <div className="max-h-[34rem] overflow-y-auto space-y-3 pr-1">
                {loadingLogs ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">Loading logs...</div>
                ) : logs.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">No live logs yet.</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{log.from}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              log.type === 'incoming'
                                ? 'bg-amber-50 text-amber-800'
                                : log.type === 'outgoing'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              {log.type}
                            </span>
                            {log.action && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                {log.action}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-700">{log.message}</p>
                          {log.response && (
                            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
                              Reply to: <span className="font-medium text-slate-900">{log.response}</span>
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-[10px] font-medium text-slate-400">
                          <p>{log.timestamp}</p>
                          {log.connectedNumber && (
                            <p className="mt-1 font-mono text-slate-500">Connected: {log.connectedNumber}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                  <Send className="h-4.5 w-4.5 text-indigo-500" />
                  <span>Incoming Message Simulator</span>
                </h3>
                <p className="text-xs text-slate-500">Use this to simulate a customer phone number and watch the logged reply decision.</p>
              </div>

              <form onSubmit={handleSendSimultedMsg} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer phone number</label>
                  <input
                    type="text"
                    value={simCustomerPhone}
                    onChange={(e) => setSimCustomerPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                    id="sim-customer-phone-input"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer message</label>
                  <textarea
                    rows={4}
                    value={simCustomerMsg}
                    onChange={(e) => setSimCustomerMsg(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white"
                    id="sim-customer-message-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={chatSubmitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {chatSubmitting ? "Sending..." : "Send Simulated Message"}
                </button>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 max-h-[24rem] overflow-y-auto space-y-3">
                {simulatorChat.map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className={`rounded-2xl p-3 text-xs leading-6 ${
                      entry.sender === 'user'
                        ? 'ml-8 bg-indigo-600 text-white'
                        : entry.sender === 'bot'
                          ? 'mr-8 bg-white text-slate-800 border border-slate-200'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-70">{entry.sender}</p>
                    <p className="whitespace-pre-wrap">{entry.text}</p>
                    <p className="mt-2 text-[10px] opacity-60">{entry.timestamp}</p>
                  </div>
                ))}
                <div ref={chatEndRef} />
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
