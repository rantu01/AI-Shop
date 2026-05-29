import React, { useState } from "react";
import { Store, Shield, User, LogOut, Search, LogIn, ExternalLink, ShoppingBag, X } from "lucide-react";
import { customSignOut, isRealFirebase } from "../lib/firebase";

interface HeaderProps {
  currentView: 'shop' | 'admin' | 'product-details' | 'dashboard';
  onNavigate: (view: 'shop' | 'admin' | 'dashboard', payload?: any) => void;
  user: any;
  onOpenAuthModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  dbStatus: { connected: boolean; mode: string };
}

export default function Header({
  currentView,
  onNavigate,
  user,
  onOpenAuthModal,
  searchQuery,
  onSearchChange,
  dbStatus,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await customSignOut();
      setDropdownOpen(false);
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('shop')}
              className="flex items-center gap-2 font-display text-xl font-bold text-slate-900 transition-opacity hover:opacity-90"
              id="logo-button"
            >
              <Store className="h-6 w-6 text-indigo-600" />
              <span>Shera<span className="text-indigo-600">Sawda</span></span>
            </button>

            {/* Database Status Tag */}
            {/* <div className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-mono font-medium text-slate-600 sm:flex">
              <span className={`h-2.5 w-2.5 rounded-full ${dbStatus.connected ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
              <span>{dbStatus.mode}</span>
            </div> */}
          </div>

          <div className="relative mx-4 flex max-w-md flex-1 items-center">
            {currentView === 'shop' && (
              <>
                <div className="relative hidden w-full md:block">
                  <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search products by brand, code, name..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pr-4 pl-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100/50"
                    id="search-input"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSearchModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-600 shadow-sm transition-colors hover:bg-slate-100 md:hidden"
                  aria-label="Open search"
                  id="mobile-search-open"
                >
                  <Search className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('shop')}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                currentView === 'shop' || currentView === 'product-details'
                  ? "text-indigo-600"
                  : "text-slate-600 hover:text-indigo-600"
              }`}
              id="nav-shop"
            >
              Storefront
            </button>

            <button
              onClick={() => onNavigate('dashboard')}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                currentView === 'dashboard'
                  ? "text-indigo-600"
                  : "text-slate-600 hover:text-indigo-600"
              }`}
              id="nav-dashboard"
            >
              <ShoppingBag className="h-4 w-4 text-slate-400" />
              <span>My Cart</span>
            </button>

            {user && user.isAdmin && (
              <button
                onClick={() => onNavigate('admin')}
                className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  currentView === 'admin'
                    ? "text-indigo-600"
                    : "text-slate-600 hover:text-indigo-600"
                }`}
                id="nav-admin"
              >
                <Shield className="h-4 w-4 text-slate-400" />
                <span className="hidden sm:inline">Admin Console</span>
              </button>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 p-1.5 px-3 hover:bg-slate-50 transition-colors"
                  id="profile-dropdown-btn"
                >
                  <img
                    src={user.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                    alt={user.displayName}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span className="hidden max-w-[100px] truncate text-xs font-semibold text-slate-700 sm:inline">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-100 bg-white py-1 shadow-lg ring-1 ring-black/5">
                    <div className="border-b border-slate-100 p-3">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {user.displayName || "E-commerce User"}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">{user.email}</p>
                      {user.isAdmin && (
                        <span className="mt-1 inline-block rounded bg-red-50 px-1 py-0.5 text-[9px] font-bold text-red-600">
                          Admin Access
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        onNavigate('dashboard');
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                      My Cart & Orders
                    </button>
                    {user.isAdmin && (
                      <button
                        onClick={() => {
                          onNavigate('admin');
                          setDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <Shield className="h-3.5 w-3.5 text-slate-400" />
                        Manage Store
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                      id="logout-button"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-all shadow-md hover:bg-indigo-700 hover:shadow-lg focus:ring-2 focus:ring-indigo-200/50"
                id="login-button-header"
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {searchModalOpen && currentView === 'shop' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 pt-20 backdrop-blur-sm md:hidden">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Search catalog</p>
                <p className="text-xs text-slate-500">Search by name, SKU, or description</p>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close search"
                id="mobile-search-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search products..."
                autoFocus
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-4 pl-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100/50"
                id="mobile-search-input"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  setSearchModalOpen(false);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                id="mobile-search-clear"
              >
                Clear search
              </button>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
