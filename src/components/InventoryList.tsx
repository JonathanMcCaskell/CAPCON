/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Grid,
  List as ListIcon,
  Tag,
  DollarSign,
  Package,
  Calendar,
  AlertCircle,
  Image as ImageIcon,
  Filter,
  ChevronDown,
  ArrowRight,
  Download,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { InventoryItem } from "../types";
import { getCategoryIcon } from "../App";

interface InventoryListProps {
  items: InventoryItem[];
  onUpdateQuantity: (id: string, newQty: number) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onExportExcel: () => void;
  onSelectItem: (item: InventoryItem) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  isQuickOverview?: boolean;
  onViewFullCatalogue?: () => void;
  totalItemsCount?: number;
}

const CATEGORIES = [
  "All",
  "Electronics",
  "Tools",
  "Books",
  "Apparel",
  "Home Decor",
  "Kitchenware",
  "Office Supplies",
  "Sports & Outdoors",
  "Toys & Games",
  "Collectibles",
  "Miscellaneous"
];

export default function InventoryList({
  items,
  onUpdateQuantity,
  onDeleteItem,
  onExportExcel,
  onSelectItem,
  selectedCategory,
  onSelectCategory,
  isQuickOverview = false,
  onViewFullCatalogue,
  totalItemsCount
}: InventoryListProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever search or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  // Filtering items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const ITEMS_PER_PAGE = 10;
  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(totalFiltered, startIndex + ITEMS_PER_PAGE);

  const displayItems = isQuickOverview
    ? filteredItems.slice(0, 8)
    : filteredItems.slice(startIndex, endIndex);

  const totalCount = totalItemsCount ?? items.length;

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const ledgerElem = document.getElementById("input-ledger-search") || document.getElementById("tab-btn-catalogue");
    if (ledgerElem) {
      ledgerElem.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleQtyAdjust = async (e: React.MouseEvent, item: InventoryItem, delta: number) => {
    e.stopPropagation(); // Prevent opening detail modal
    const newQty = Math.max(0, item.quantity + delta);
    await onUpdateQuantity(item.id, newQty);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent opening detail modal
    setDeleteConfirmId(id);
  };

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-xs p-3.5 sm:p-6 flex flex-col h-full">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 sm:pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              {isQuickOverview ? "Recent Additions Overview" : "Ledger Catalogue"}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {isQuickOverview
              ? "Displaying the 8 most recent items added to your inventory. Switch tabs for full catalogue."
              : "Search, filter, and edit your visual inventory."}
          </p>
        </div>
        
        {/* Export, Catalogue Link & View Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isQuickOverview && onViewFullCatalogue && (
            <button
              type="button"
              id="btn-open-full-catalogue-header"
              onClick={onViewFullCatalogue}
              className="px-3.5 min-h-[40px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <span>Full Catalogue ({totalCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            id="btn-export-excel-catalogue"
            onClick={onExportExcel}
            className="px-3 min-h-[40px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
            title="Export Excel Spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Export Excel</span>
          </button>

          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/50">
            <button
              type="button"
              id="btn-view-grid"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              id="btn-view-list"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "list" ? "bg-white text-slate-800 shadow-xs" : "text-slate-400 hover:text-slate-600"
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Unified Search & Category Filter Toolbar */}
      {!isQuickOverview && (
        <div className="py-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="input-ledger-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items by name, model, description..."
                className="w-full min-h-[42px] pl-10.5 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <div className="relative w-full sm:w-auto">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center space-x-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <select
                  id="select-ledger-category"
                  value={selectedCategory}
                  onChange={(e) => onSelectCategory(e.target.value)}
                  className="w-full sm:w-auto min-h-[42px] pl-8 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 appearance-none cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === "All" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {selectedCategory !== "All" && (
                <button
                  type="button"
                  onClick={() => onSelectCategory("All")}
                  className="px-2.5 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Clear category filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid or List list output */}
      <div className="flex-1 lg:h-0 lg:min-h-0 min-h-[400px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-200">
        {displayItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/80">
            <AlertCircle className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">No catalog items match criteria</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
              Try clearing search, changing category, or taking a photo to catalog a new physical item.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {displayItems.map((item) => (
              <div
                key={item.id}
                id={`ledger-card-${item.id}`}
                onClick={() => onSelectItem(item)}
                className="group border border-slate-100 bg-slate-50/20 hover:bg-white hover:border-slate-200 hover:shadow-md rounded-2xl p-3 flex flex-col transition-all duration-200 cursor-pointer relative"
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] w-full bg-slate-100 rounded-xl overflow-hidden mb-3 relative">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform group-hover:scale-102 duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  {/* Category Tag overlay */}
                  <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs text-slate-700 border border-slate-100 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1.5">
                    {(() => {
                      const Icon = getCategoryIcon(item.category);
                      return <Icon className="w-3 h-3 text-indigo-600" />;
                    })()}
                    {item.category}
                  </span>

                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight truncate group-hover:text-indigo-600 transition-colors">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 h-8 leading-4">
                      {item.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-3.5 pt-3.5 border-t border-slate-100/80 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                        Online Price (CAD)
                      </p>
                      <div className="flex items-baseline space-x-1.5">
                        <p className="text-xs font-bold text-indigo-600">
                          C${item.averagePriceOnline?.toFixed(2)}
                        </p>
                        {item.originalPrice !== undefined && item.originalPrice > item.averagePriceOnline && (
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            C${item.originalPrice.toFixed(2)}
                          </span>
                        )}
                        {item.discountPercent !== undefined && (
                          <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            -{item.discountPercent}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Qty Control */}
                    <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200/50 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleQtyAdjust(e, item, -1)}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-md transition-all cursor-pointer"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-slate-700 px-1 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleQtyAdjust(e, item, 1)}
                        className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-md transition-all cursor-pointer"
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Delete Button (Desktop only on hover) */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteClick(e, item.id)}
                  className="hidden sm:block absolute top-2.5 right-2.5 opacity-0 sm:group-hover:opacity-100 p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg shadow-2xs transition-all duration-200 cursor-pointer z-10"
                  title="Delete item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Custom Deletion Overlay */}
                {deleteConfirmId === item.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()} // Prevent opening details modal when confirming delete
                    className="absolute inset-0 bg-rose-900/95 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 z-30"
                  >
                    <Trash2 className="w-8 h-8 text-white mb-2 animate-bounce" />
                    <p className="text-white text-xs font-bold mb-3 text-center">Permanently delete item?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeleteItem(item.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-3 py-1.5 bg-white text-rose-700 text-[10px] font-bold rounded-lg hover:bg-rose-50 cursor-pointer transition-all shadow-xs"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="px-3 py-1.5 bg-rose-800 text-rose-100 text-[10px] font-bold rounded-lg hover:bg-rose-750 border border-rose-750 cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {displayItems.map((item) => (
              <div
                key={item.id}
                id={`ledger-list-item-${item.id}`}
                onClick={() => onSelectItem(item)}
                className="group border border-slate-100 hover:border-slate-200 hover:shadow-sm bg-slate-50/10 hover:bg-white rounded-xl p-3 flex items-center transition-all cursor-pointer relative overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 bg-slate-100 rounded-lg overflow-hidden shrink-0 mr-4 relative">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <div className="md:col-span-4 min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-600">
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {item.description || "No description"}
                    </p>
                  </div>

                  <div className="md:col-span-2 hidden md:block space-y-1">
                    <div className="block">
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 border border-slate-200/50 rounded-md text-[10px] font-semibold text-slate-600 gap-1.5">
                        {(() => {
                          const Icon = getCategoryIcon(item.category);
                          return <Icon className="w-3 h-3 text-indigo-600" />;
                        })()}
                        {item.category}
                      </span>
                    </div>

                  </div>

                  <div className="md:col-span-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase md:hidden">Price (CAD)</p>
                    <div className="flex flex-col">
                      <div className="flex items-baseline space-x-1.5">
                        <p className="text-xs font-bold text-indigo-600">C${item.averagePriceOnline?.toFixed(2)}</p>
                        {item.originalPrice !== undefined && item.originalPrice > item.averagePriceOnline && (
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            C${item.originalPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {item.discountPercent !== undefined && (
                        <span className="inline-block mt-0.5 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 w-max">
                          -{item.discountPercent}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity and value */}
                  <div className="md:col-span-3 flex items-center justify-between md:justify-start gap-4">
                    {/* Qty Control */}
                    <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200/50 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleQtyAdjust(e, item, -1)}
                        className="p-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-md transition-all cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-700 px-1 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleQtyAdjust(e, item, 1)}
                        className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-md transition-all cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right md:text-left min-w-[70px]">
                      <p className="text-[10px] text-slate-400 font-bold uppercase md:hidden">Total (CAD)</p>
                      <p className="text-xs font-bold text-slate-700">
                        C${((item.quantity || 0) * (item.averagePriceOnline || 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex md:col-span-1 justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, item.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-lg transition-all cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Custom Deletion Overlay (List View) */}
                {deleteConfirmId === item.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 bg-rose-900/95 backdrop-blur-xs rounded-xl flex items-center justify-between px-6 z-35 animate-fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-white animate-pulse" />
                      <p className="text-white text-xs font-bold">Permanently delete "{item.name}"?</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await onDeleteItem(item.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-3 py-1.5 bg-white text-rose-700 text-[10px] font-bold rounded-lg hover:bg-rose-50 cursor-pointer transition-all shadow-xs"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(null);
                        }}
                        className="px-3 py-1.5 bg-rose-800 text-rose-100 text-[10px] font-bold rounded-lg hover:bg-rose-750 border border-rose-750 cursor-pointer transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Catalogue Pagination Bar */}
      {!isQuickOverview && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {totalFiltered > 0 ? (
              <span>
                Showing <strong className="text-slate-800">{startIndex + 1}</strong>–<strong className="text-slate-800">{endIndex}</strong> of <strong className="text-slate-800">{totalFiltered}</strong> items
                {totalFiltered !== items.length && (
                  <span className="text-slate-400"> (filtered from {items.length} total)</span>
                )}
              </span>
            ) : (
              <span>No items match selection</span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-2">
              <button
                type="button"
                id="btn-page-prev"
                onClick={() => handlePageChange(safePage - 1)}
                disabled={safePage === 1}
                className="px-3 py-1.5 min-h-[34px] bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-1 cursor-pointer shadow-xs disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    totalPages > 7 &&
                    pageNum !== 1 &&
                    pageNum !== totalPages &&
                    Math.abs(pageNum - safePage) > 1
                  ) {
                    if (
                      (pageNum === 2 && safePage > 3) ||
                      (pageNum === totalPages - 1 && safePage < totalPages - 2)
                    ) {
                      return (
                        <span key={pageNum} className="px-1 text-slate-400 text-xs font-bold select-none">
                          ..
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      id={`btn-page-num-${pageNum}`}
                      onClick={() => handlePageChange(pageNum)}
                      className={`min-w-[34px] h-[34px] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                        safePage === pageNum
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                id="btn-page-next"
                onClick={() => handlePageChange(safePage + 1)}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 min-h-[34px] bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center space-x-1 cursor-pointer shadow-xs disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Overview Bottom Banner */}
      {isQuickOverview && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/60 shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <Package className="w-4 h-4 text-indigo-600" />
            <span>
              Showing <strong>{Math.min(8, displayItems.length)}</strong> of <strong>{totalCount}</strong> total items in ledger.
            </span>
          </div>
          {onViewFullCatalogue && (
            <button
              type="button"
              id="btn-open-full-catalogue-bottom"
              onClick={onViewFullCatalogue}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs shrink-0"
            >
              <span>View Full Catalogue Page</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
