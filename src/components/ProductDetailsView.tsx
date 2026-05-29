import React, { useState, useEffect } from "react";
import { Product, Category } from "../types";
import { MessageSquare, ArrowLeft, ShieldCheck, ShoppingCart, Truck, AlertTriangle, ArrowUpRight } from "lucide-react";

interface ProductDetailsViewProps {
  product: Product;
  categories: Category[];
  products: Product[];
  onBack: () => void;
  onAddToCart?: (sku: string) => void;
  onSelectProduct?: (product: Product) => void;
}

export default function ProductDetailsView({
  product,
  categories,
  products,
  onBack,
  onAddToCart,
  onSelectProduct,
}: ProductDetailsViewProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [customPhone] = useState("8801814293906"); // Hardcoded store WhatsApp number

  // Scroll to top when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [product]);

  const categoryObj = categories.find(c => c._id === product.category);
  const isAvailable = product.stock > 0;

  // Build the prefilled WhatsApp URL according to strict requirements
  const prefilledTemplate = `Hi, I am interested in ${product.name} (Code: ${product.sku}). Is it available?`;
  const whatsappUrl = `https://wa.me/8801814293906?text=${encodeURIComponent(prefilledTemplate)}`;

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Find related products in same category first
  const relatedList = (products || [])
    .filter((p) => p._id !== product._id)
    .sort((a, b) => {
      // Prioritize same category
      if (a.category === product.category && b.category !== product.category) return -1;
      if (a.category !== product.category && b.category === product.category) return 1;
      return 0;
    })
    .slice(0, 4);


  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
        id="back-to-shop-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Storefront</span>
      </button>

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
        
        {/* Left column: Image Gallery (Span 5) */}
        <div className="md:col-span-5 space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-slate-50 aspect-square border border-slate-100">
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover"
            />
            
            {/* Stock Level Pill */}
            <span className={`absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold leading-none shadow-md ${
              isAvailable 
                ? "bg-emerald-500 text-white" 
                : "bg-red-500 text-white"
            }`}>
              {isAvailable ? "In Stock" : "Unavailable"}
            </span>

            {/* Code overlay */}
            <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-sm rounded-lg px-3 py-1 border border-slate-800">
              <span className="text-xs font-mono text-slate-400">
                Code: <span className="font-bold text-indigo-400">{product.sku}</span>
              </span>
            </div>
          </div>

          {/* Side informational card */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 flex items-start gap-3">
            <Truck className="h-5 w-5 text-indigo-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-800">Direct Express Delivery</h4>
              <p className="text-[10px] text-slate-500">Secured drop ship orders fulfilled under 48 hours.</p>
            </div>
          </div>
        </div>

        {/* Right column: Specs Sheet (Span 7) */}
        <div className="md:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Meta Tags */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 uppercase tracking-widest">
                {categoryObj?.name || "Refined Category"}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono text-slate-500">
                SKU: {product.sku}
              </span>
            </div>

            {/* Title & Price */}
            <div className="border-b border-slate-100 pb-4">
              <h1 className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {product.name}
              </h1>
              <p className="mt-3 font-display text-4xl font-extrabold text-slate-900">
                ${product.price}
              </p>
            </div>

            {/* Description Sheet */}
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Product Description
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 text-balance">
                {product.description}
              </p>
            </div>

            {/* Technical Specifications */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-200">Specifications Table</h3>
              <div className="grid grid-cols-2 gap-y-2 pt-2.5 text-xs">
                <span className="text-slate-500 font-medium">Product Code / SKU</span>
                <span className="font-mono text-slate-800 font-bold text-indigo-600">{product.sku}</span>
                
                <span className="text-slate-500 font-medium">Inventory Stock status</span>
                <span className="text-slate-800">
                  {isAvailable ? (
                    <span className="text-emerald-600 font-semibold">Active ({product.stock} units)</span>
                  ) : (
                    <span className="text-red-500 font-semibold">Restocking soon</span>
                  )}
                </span>
                
                <span className="text-slate-500 font-medium">Categorization</span>
                <span className="text-slate-800">{categoryObj?.name || "General Goods"}</span>
              </div>
            </div>
          </div>

          {/* 3. WHATSAPP DIRECT BUTTON & ACTION FORM */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            
            {/* Hardcoded WhatsApp contact details */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Merchant Number: +8801814293906 (Bangladesh)
              </span>
            </div>

            {/* Final Action Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {isAvailable && onAddToCart && (
                <button
                  onClick={() => {
                    onAddToCart(product.sku);
                    setAddedToCart(true);
                    setTimeout(() => setAddedToCart(false), 2000);
                  }}
                  className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-indigo-100 focus:ring-4 focus:ring-indigo-100"
                  id="add-to-cart-btn"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>{addedToCart ? "Added to Cart!" : "Add to Shopping Cart"}</span>
                </button>
              )}

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-[#20ba59] hover:shadow-[#25D366]/20 focus:ring-4 focus:ring-green-100"
                id="whatsapp-direct-btn"
              >
                <MessageSquare className="h-5 w-5 fill-white text-[#25D366]" />
                <span>Chat on WhatsApp</span>
              </a>

              <button
                onClick={handleShareLink}
                className="flex items-center justify-center gap-1.5 rounded-full border border-slate-200 px-6 py-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                id="share-product-btn"
              >
                {copiedLink ? "Link Copied!" : "Copy Share Link"}
              </button>
            </div>

            {/* Interactive display showing what text gets dispatched */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
              <div className="flex gap-2 items-start">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-emerald-800">
                    Pre-filled Message Template
                  </p>
                  <p className="text-[10px] font-mono text-emerald-700 italic">
                    "{prefilledTemplate}"
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Related Products Section */}
      {relatedList.length > 0 && (
        <div className="space-y-6 border-t border-slate-200 pt-10 animate-fade-in" id="related-products-section">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Related Products</h2>
            <p className="text-xs text-slate-500">You might also be interested in these handpicked suggestions</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relatedList.map((prod) => {
              const catObj = categories.find((c) => c._id === prod.category);
              const isProdAvailable = prod.stock > 0;
              return (
                <div
                  key={prod._id}
                  onClick={() => onSelectProduct && onSelectProduct(prod)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg cursor-pointer"
                  id={`related-product-${prod.sku}`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-50 mb-3">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute top-1.5 right-1.5">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${
                        isProdAvailable ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}>
                        {isProdAvailable ? "In Stock" : "Sold Out"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest block mb-1">
                        {catObj?.name || "Premium Goods"}
                      </span>
                      <h3 className="line-clamp-1 text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900">${prod.price}</p>
                      <span className="flex items-center text-[10px] font-semibold text-indigo-600">
                        <span>View</span>
                        <ArrowUpRight className="h-3 w-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
