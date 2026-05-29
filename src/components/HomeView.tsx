import React, { useState, useEffect, useRef } from "react";
import { Category, Product } from "../types";
import { ArrowRight, Tag, HelpCircle, Inbox, Send, ChevronRight, ChevronLeft, SlidersHorizontal, ShoppingBag } from "lucide-react";

function CategoryMarquee({
  products,
  onSelectProduct,
}: {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || products.length < 2) {
      return;
    }

    let animationFrame = 0;
    const speed = 0.45;

    const step = () => {
      if (track && !paused) {
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          track.scrollLeft += speed;
          if (track.scrollLeft >= halfWidth) {
            track.scrollLeft = 0;
          }
        }
      }
      animationFrame = window.requestAnimationFrame(step);
    };

    animationFrame = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [paused, products.length]);

  const marqueeItems = [...products, ...products];

  return (
    <div
      ref={trackRef}
      className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-hide snap-x scroll-smooth"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {marqueeItems.map((prod, index) => {
        const isAvailable = prod.stock > 0;
        const isDuplicate = index >= products.length;

        return (
          <div
            key={`${prod._id}-${index}`}
            onClick={() => onSelectProduct(prod)}
            className="group/item w-36 shrink-0 snap-start select-none cursor-pointer rounded-xl border border-slate-100 bg-slate-50 p-2 border-dashed transition-all hover:bg-white hover:border-slate-300 hover:shadow-md"
            id={`marquee-prod-${prod.sku}-${index}`}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white mb-2 border border-slate-100">
              <img
                src={prod.images[0]}
                alt={prod.name}
                className="h-full w-full object-cover transition-transform group-hover/item:scale-105"
              />
              <div className="absolute top-1 right-1">
                <span className={`inline-flex items-center rounded-full px-1 py-0.5 text-[7px] font-extrabold shadow-sm ${isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}>
                  {isAvailable ? "In Stock" : "Sold Out"}
                </span>
              </div>
              {isDuplicate && (
                <div className="absolute bottom-1 left-1 rounded-full bg-slate-950/75 px-1.5 py-0.5 text-[7px] font-bold text-slate-200">
                  loop
                </div>
              )}
            </div>
            <div>
              <h3 className="line-clamp-1 text-[10px] font-bold text-slate-800 transition-colors group-hover/item:text-indigo-600">
                {prod.name}
              </h3>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] font-extrabold text-slate-900">${prod.price}</p>
                <span className="text-[8px] font-bold text-indigo-600">View</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HomeViewProps {
  categories: Category[];
  products: Product[];
  onSelectProduct: (product: Product) => void;
  searchQuery: string;
}

export default function HomeView({
  categories,
  products,
  onSelectProduct,
  searchQuery,
}: HomeViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Reset to page 1 state when filters mutate
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  // Filter products by category and search string
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory ? prod.category === selectedCategory : true;
    const matchesSearch = searchQuery
      ? (prod.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  // Paginated Slices matching layout cells
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-12 pb-16">

      {/* 1. HERO BANNER */}


      {/* 2. CATEGORY REGISTRY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">Explore by Category</h2>
            <p className="text-xs text-slate-500">Filter your catalog browsing instantly</p>
          </div>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              id="clear-filter"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
          {/* Default 'All' Category */}
          <button
            onClick={() => setSelectedCategory(null)}
            className={`group relative h-28 overflow-hidden rounded-2xl text-left transition-all ${selectedCategory === null
                ? "ring-2 ring-indigo-600 ring-offset-2 shadow-lg"
                : "border border-slate-200 bg-white hover:border-slate-300 shadow-sm"
              }`}
            id="cat-tab-all"
          >
            {/* Background Image */}
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxXTa5_USOBp7QoSxqsdrPVScjUMQL6NDKLw&s"
              alt="All Products Background"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />

            {/* Dark Tint Overlay (Image overlay overlay) */}
            <div className="absolute inset-0 bg-slate-950/40 transition-colors duration-300 group-hover:bg-slate-950/50"></div>

            {/* Smooth Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>

            {/* Content */}
            <div className="absolute bottom-4 left-4 z-10">
              <h3 className="text-sm font-bold text-white tracking-wide group-hover:translate-x-0.5 transition-transform">
                All Products
              </h3>
            </div>
          </button>

          {categories.map((cat, i) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`group relative h-28 overflow-hidden rounded-2xl text-left transition-all ${selectedCategory === cat._id
                ? "ring-2 ring-indigo-600 ring-offset-2"
                : "border border-slate-200 bg-white hover:border-slate-300"
                }`}
              id={`cat-tab-${cat.slug}`}
            >
              <img
                src={cat.image}
                alt={cat.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/10 to-transparent"></div>
              <div className="absolute bottom-4 left-4">
                <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">0{i + 1}</span>
                <h3 className="text-sm font-bold text-white">{cat.name}</h3>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2.5 CATEGORY PRODUCT SLIDING MARQUEE */}
      <section className="space-y-4 shadow-xs" id="category-scrolling-marquee">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Featured Collections</h2>
          <p className="text-xs text-slate-500">Explore product carousels across our active catalogues</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => {
            const catProds = products.filter(p => p.category === cat._id);
            if (catProds.length === 0) return null;
            return (
              <div key={cat._id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs" id={`marquee-shelf-${cat._id}`}>
                <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-indigo-600 animate-pulse" />
                    {cat.name}
                  </span>
                  <span className="text-[10px] font-mono font-medium rounded bg-indigo-50 text-indigo-600 px-1.5 py-0.5">
                    {catProds.length} items
                  </span>
                </div>

                {/* Left & Right scrolling block */}
                <div className="relative group">
                  <CategoryMarquee products={catProds} onSelectProduct={onSelectProduct} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. FEATURED PRODUCTS GRID */}
      <section className="space-y-6" id="shop-catalog">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-slate-900">Featured Products</h2>
            <p className="text-xs text-slate-500">Handpicked premium items sourced for durability</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 font-mono">
            {filteredProducts.length} items
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
            <Inbox className="h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-sm font-bold text-slate-800">No products found</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-xs px-4">
              Try adjusting your spelling or clear active category filters to see more results!
            </p>
            {(selectedCategory || searchQuery) && (
              <button
                onClick={() => { setSelectedCategory(null); }}
                className="mt-4 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
              >
                Reset Store Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
              {paginatedProducts.map((prod) => {
                const categoryObj = categories.find(c => c._id === prod.category);
                const isAvailable = prod.stock > 0;

                return (
                  <div
                    key={prod._id}
                    onClick={() => onSelectProduct(prod)}
                    className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg cursor-pointer"
                    id={`product-card-${prod.sku}`}
                  >

                    {/* Product Image Aspect-Square for compactness */}
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-50">
                      <img
                        src={prod.images[0]}
                        alt={prod.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 animate-fade-in"
                        referrerPolicy="no-referrer"
                      />

                      {/* Floating Badge (Stock) */}
                      <div className="absolute top-1.5 right-1.5">
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[8px] font-extrabold shadow-sm ${isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                          {isAvailable ? `${prod.stock} In Stock` : "Sold Out"}
                        </span>
                      </div>

                      {/* Code Overlay bottom-left */}
                      <div className="absolute bottom-1.5 left-1.5 bg-slate-950/80 backdrop-blur-sm rounded px-1.5 py-0.5 border border-slate-800 text-[8px] font-mono text-slate-300">
                        Code: <span className="font-bold text-indigo-300">{prod.sku}</span>
                      </div>
                    </div>

                    {/* Compact Card Body */}
                    <div className="flex flex-1 flex-col pt-3 justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">
                          {categoryObj?.name || "Premium Goods"}
                        </span>
                        <h3 className="line-clamp-2 text-xs font-bold text-slate-800 group-hover:text-indigo-600 leading-tight tracking-tight transition-colors">
                          {prod.name}
                        </h3>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-50 bg-white">
                        <p className="text-xs font-black text-slate-950">
                          ${prod.price}
                        </p>
                        <span className="flex items-center text-[10px] font-bold text-indigo-600 transition-all hover:translate-x-0.5">
                          <span>View</span>
                          <ChevronRight className="h-3 w-3 ml-0.5" />
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6 border-t border-slate-100" id="shop-pagination-controls">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
                  id="pagination-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pNum = idx + 1;
                    return (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition-all ${currentPage === pNum
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        id={`pagination-page-${pNum}`}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
                  id="pagination-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
}
