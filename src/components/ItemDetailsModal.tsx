/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { X, Save, Trash2, Calendar, Package, Tag, DollarSign, Edit, HelpCircle, ExternalLink, Globe, ShoppingBag, Store, ChevronDown, ChevronUp, Plus, Percent, BadgePercent, Maximize2 } from "lucide-react";
import { InventoryItem, PriceSource } from "../types";
import { getCategoryIcon } from "../App";

interface ItemDetailsModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSave: (updatedItem: InventoryItem) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const CATEGORIES = [
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

export function getDefaultPriceSources(item: InventoryItem): PriceSource[] {
  if (item.priceSources && item.priceSources.length > 0) {
    return item.priceSources;
  }

  const basePrice = Number(item.averagePriceOnline) || 0;
  const encodedName = encodeURIComponent(item.name || "Item");
  const cat = (item.category || "").toLowerCase();

  let secondaryRetailer = "Walmart Canada";
  let secondaryUrl = `https://www.walmart.ca/en/search?q=${encodedName}`;
  let secondaryBadge = "Department Retailer";
  let secondaryMultiplier = 1.02;

  if (cat.includes("electronic") || cat.includes("office")) {
    secondaryRetailer = "Best Buy Canada";
    secondaryUrl = `https://www.bestbuy.ca/en-ca/search?search=${encodedName}`;
    secondaryBadge = "Tech Retailer";
    secondaryMultiplier = 1.05;
  } else if (cat.includes("tool") || cat.includes("home") || cat.includes("kitchen")) {
    secondaryRetailer = "Canadian Tire";
    secondaryUrl = `https://www.canadiantire.ca/en/search-results.html?q=${encodedName}`;
    secondaryBadge = "Hardware Store";
    secondaryMultiplier = 1.03;
  } else if (cat.includes("book")) {
    secondaryRetailer = "Indigo Chapters CA";
    secondaryUrl = `https://www.indigo.ca/en-ca/search?q=${encodedName}`;
    secondaryBadge = "Bookstore";
    secondaryMultiplier = 1.00;
  }

  return [
    {
      name: "Amazon Canada",
      price: basePrice,
      url: `https://www.amazon.ca/s?k=${encodedName}`,
      badge: "Primary Marketplace"
    },
    {
      name: secondaryRetailer,
      price: Math.round(basePrice * secondaryMultiplier * 100) / 100,
      url: secondaryUrl,
      badge: secondaryBadge
    },
    {
      name: "eBay Canada",
      price: Math.max(1, Math.round(basePrice * 0.91 * 100) / 100),
      url: `https://www.ebay.ca/sch/i.html?_nkw=${encodedName}`,
      badge: "Secondary Market"
    },
    {
      name: "Google Shopping CA",
      price: Math.round(basePrice * 0.98 * 100) / 100,
      url: `https://www.google.ca/search?tbm=shop&q=${encodedName}`,
      badge: "Aggregated Search"
    }
  ];
}

export default function ItemDetailsModal({ item, onClose, onSave, onDelete }: ItemDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState<number | string>(1);
  const [price, setPrice] = useState<number | string>(0);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeImage, setActiveImage] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState("all");
  const [priceSources, setPriceSources] = useState<PriceSource[]>([]);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [isAlternativesOpen, setIsAlternativesOpen] = useState(false);
  const [applyDiscount, setApplyDiscount] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number | string>(0);
  const [originalPrice, setOriginalPrice] = useState<number | string>(0);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
      setQuantity(item.quantity);
      setPrice(item.averagePriceOnline);
      setDescription(item.description);
      setActiveImage(item.imageUrl || "");
      setIsEditing(false); // Reset to view mode initially
      setShowDeleteConfirm(false); // Reset confirmation state
      setSelectedSourceFilter("all");
      setIsSourcesOpen(false);
      setIsAlternativesOpen(false);

      const hasDisc = (item.discountPercent || 0) > 0 || (item.originalPrice !== undefined && item.originalPrice > item.averagePriceOnline);
      setApplyDiscount(hasDisc);
      setDiscountPercent(item.discountPercent || 0);
      const baseOrig = item.originalPrice !== undefined ? item.originalPrice : item.averagePriceOnline || 0;
      setOriginalPrice(baseOrig);

      const defaultSources = getDefaultPriceSources(item);
      setPriceSources(defaultSources);
    }
  }, [item]);

  if (!item) return null;

  const applyPresetDiscount = (pct: number) => {
    setApplyDiscount(pct > 0);
    setDiscountPercent(pct);
    const orig = Number(originalPrice) || Number(price) || 0;
    if (orig <= 0) return;
    if (pct > 0) {
      const calcPrice = Number((orig * (1 - pct / 100)).toFixed(2));
      setPrice(calcPrice);
    } else {
      setPrice(orig);
    }
  };

  const handleDiscountPercentChange = (val: string) => {
    const pct = val === "" ? "" : Math.min(100, Math.max(0, Number(val)));
    setDiscountPercent(pct);
    const numericPct = Number(pct) || 0;
    const orig = Number(originalPrice) || Number(price) || 0;
    if (numericPct > 0 && orig > 0) {
      const calcPrice = Number((orig * (1 - numericPct / 100)).toFixed(2));
      setPrice(calcPrice);
    }
  };

  const handleOriginalPriceChange = (val: string) => {
    setOriginalPrice(val);
    const orig = Number(val) || 0;
    const numericPct = Number(discountPercent) || 0;
    if (applyDiscount && numericPct > 0 && orig > 0) {
      const calcPrice = Number((orig * (1 - numericPct / 100)).toFixed(2));
      setPrice(calcPrice);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let finalPrice = Number(price) || 0;
      let finalOriginalPrice: number | undefined = undefined;
      let finalDiscountPercent: number | undefined = undefined;

      if (applyDiscount) {
        const orig = Number(originalPrice) > 0 ? Number(originalPrice) : finalPrice;
        const disc = Number(discountPercent) || 0;

        if (disc > 0 && orig > 0) {
          finalOriginalPrice = orig;
          finalDiscountPercent = disc;
          finalPrice = Number((orig * (1 - disc / 100)).toFixed(2));
        } else if (orig > finalPrice && finalPrice > 0) {
          finalOriginalPrice = orig;
          finalDiscountPercent = Math.round(((orig - finalPrice) / orig) * 100);
        }
      }

      await onSave({
        ...item,
        name,
        category,
        quantity: Number(quantity),
        averagePriceOnline: finalPrice,
        originalPrice: finalOriginalPrice,
        discountPercent: finalDiscountPercent,
        description,
        priceSources
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Error saving updates:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPriceSource = () => {
    const newSource: PriceSource = {
      name: "Custom Retailer",
      price: Number(price) || 0,
      url: `https://www.google.ca/search?q=${encodeURIComponent(name || "item")}`,
      badge: "Custom Link"
    };
    setPriceSources([...priceSources, newSource]);
  };

  const handleUpdatePriceSource = (index: number, updated: Partial<PriceSource>) => {
    const list = [...priceSources];
    list[index] = { ...list[index], ...updated };
    setPriceSources(list);
  };

  const handleRemovePriceSource = (index: number) => {
    setPriceSources(priceSources.filter((_, i) => i !== index));
  };

  const handleDeleteConfirmClick = async () => {
    await onDelete(item.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const displayedSources = priceSources.filter(src => {
    if (selectedSourceFilter === "all") return true;
    return src.name === selectedSourceFilter;
  });

  const renderSourcesAndAlternatives = () => (
    <div className="space-y-3">
      {/* Collapsible Price Valuation Sources Section */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden transition-all shadow-2xs">
        {/* Header button to toggle collapse */}
        <button
          type="button"
          onClick={() => setIsSourcesOpen(!isSourcesOpen)}
          className="w-full p-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-800">
                  Price Valuation Sources
                </span>
                <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                  {priceSources.length} Sources
                </span>
              </div>
              <span className="block text-[10px] text-slate-500">
                {isSourcesOpen ? "Click to hide Canadian retail links" : "Click to view Canadian retail sources & links"}
              </span>
            </div>
          </div>
          <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            {isSourcesOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {/* Collapsed content body */}
        {isSourcesOpen && (
          <div className="p-3.5 pt-0 border-t border-slate-200/60 space-y-3 animate-fade-in">
            <div className="pt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600">Filter:</span>
              <div className="relative flex-1 max-w-[200px]">
                <select
                  value={selectedSourceFilter}
                  onChange={(e) => setSelectedSourceFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-1 pl-2 pr-6 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none cursor-pointer shadow-2xs"
                >
                  <option value="all">All Sources ({priceSources.length})</option>
                  {priceSources.map((src, idx) => (
                    <option key={idx} value={src.name}>
                      {src.name} — C${src.price.toFixed(2)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="grid gap-2">
              {displayedSources.map((source, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-slate-150 p-2.5 rounded-xl flex items-center justify-between gap-2 hover:border-indigo-200 hover:shadow-2xs transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                      <span className="text-xs font-bold text-slate-800 tracking-tight truncate">
                        {source.name}
                      </span>
                      {source.badge && (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full shrink-0">
                          {source.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono font-extrabold text-emerald-600 mt-0.5">
                      C${source.price.toFixed(2)}
                    </p>
                  </div>

                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95"
                      title={`Visit ${source.name} product page / search`}
                    >
                      <span>Visit Site</span>
                      <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic text-center pt-0.5">
              💡 Click "Visit Site" on any retailer to view live listings in CAD.
            </p>
          </div>
        )}
      </div>

      {/* Collapsible Alternative Possibilities Section */}
      {item.otherPossibilities && item.otherPossibilities.length > 0 && (
        <div className="bg-indigo-50/40 border border-indigo-150/60 rounded-2xl overflow-hidden transition-all shadow-2xs">
          <button
            type="button"
            onClick={() => setIsAlternativesOpen(!isAlternativesOpen)}
            className="w-full p-3.5 flex items-center justify-between bg-indigo-50/60 hover:bg-indigo-100/60 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800">
                    Alternative Possibilities
                  </span>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100/80 border border-indigo-200 px-1.5 py-0.5 rounded-full">
                    {item.otherPossibilities.length} Matches
                  </span>
                </div>
                <span className="block text-[10px] text-slate-500">
                  {isAlternativesOpen ? "Click to hide alternative identifications" : "Click to view AI appraisal alternative possibilities"}
                </span>
              </div>
            </div>
            <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
              {isAlternativesOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {isAlternativesOpen && (
            <div className="p-3.5 pt-0 border-t border-indigo-150/60 space-y-2 animate-fade-in mt-2">
              <div className="grid gap-2">
                {item.otherPossibilities.map((alt, idx) => (
                  <div key={idx} className="bg-white border border-indigo-100/80 p-2.5 rounded-xl flex flex-col space-y-1 shadow-2xs">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[11px] font-bold text-slate-800 leading-tight">
                        {alt.name}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shrink-0">
                        C${alt.estimatedPrice.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      {alt.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2.5 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-slide-up">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">
              {isEditing ? "Edit Item Properties" : "Catalogued Item Details"}
            </h3>
            {!isEditing && (
              <span className="text-[10px] bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full border border-slate-150 hidden xs:inline">
                Firestore Persisted
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column: Picture */}
            <div className="space-y-4">
              <div className="aspect-[4/3] w-full bg-slate-50 border border-slate-150 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center relative group">
                {activeImage ? (
                  <>
                    <img
                      src={activeImage}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover animate-fade-in cursor-pointer"
                      onClick={() => setLightboxImage(activeImage)}
                      title="Click to enlarge photo"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxImage(activeImage)}
                      className="absolute top-3 right-3 bg-slate-900/80 hover:bg-indigo-600 text-white p-2 rounded-xl border border-white/20 shadow-md backdrop-blur-xs transition-all opacity-90 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer flex items-center space-x-1.5 text-xs font-semibold"
                      title="Enlarge photo"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Enlarge</span>
                    </button>
                  </>
                ) : (
                  <div className="text-slate-300 flex flex-col items-center">
                    <Package className="w-12 h-12 stroke-1" />
                    <span className="text-xs text-slate-400 mt-2 font-medium">No photo available</span>
                  </div>
                )}
              </div>

              {/* Gallery Thumbnails */}
              {item.imageUrls && item.imageUrls.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
                  {item.imageUrls.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActiveImage(url);
                        setLightboxImage(url);
                      }}
                      className={`relative w-14 h-10 rounded-lg border overflow-hidden shrink-0 transition-all ${
                        activeImage === url ? "ring-2 ring-indigo-500 border-indigo-550 scale-95" : "border-slate-200 hover:border-slate-400"
                      }`}
                      title={`Select & Enlarge Photo ${idx + 1}`}
                    >
                      <img src={url} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}

              {/* Desktop View: Price Valuation Sources, Alternative Possibilities & UID Info */}
              <div className="hidden md:block space-y-3">
                {renderSourcesAndAlternatives()}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs text-slate-500 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">UID:</span>
                    <span className="font-mono text-[10px] select-all bg-white px-2 py-0.5 rounded border border-slate-200">{item.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Date Added:</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Properties Form or Details */}
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                      onFocus={(e) => e.target.select()}
                      className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Price & Discount Section */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      {applyDiscount ? "Effective Sale / Discounted Price (CAD)" : "Average Online Price (CAD)"}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">C$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full min-h-[40px] pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Discount / Markdown Option Card */}
                  <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={applyDiscount}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setApplyDiscount(checked);
                            if (checked) {
                              if (!originalPrice || Number(originalPrice) === 0) {
                                setOriginalPrice(price || 0);
                              }
                              if (!discountPercent || Number(discountPercent) === 0) {
                                setDiscountPercent(15); // Default preset 15%
                                const orig = Number(originalPrice) || Number(price) || 0;
                                if (orig > 0) {
                                  setPrice(Number((orig * 0.85).toFixed(2)));
                                }
                              }
                            } else {
                              if (originalPrice && Number(originalPrice) > 0) {
                                setPrice(originalPrice);
                              }
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <BadgePercent className="w-4 h-4 text-emerald-600" />
                          <span>Apply Inventory Discount / Markdown</span>
                        </span>
                      </label>
                      {applyDiscount && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          -{Number(discountPercent) || 0}% OFF
                        </span>
                      )}
                    </div>

                    {applyDiscount && (
                      <div className="space-y-3 pt-1 border-t border-emerald-200/60 animate-fade-in">
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Original List Price (CAD)
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">C$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={originalPrice}
                                onChange={(e) => handleOriginalPriceChange(e.target.value)}
                                placeholder="Original price"
                                className="w-full p-2 pl-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-hidden focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                              Discount (%)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={discountPercent}
                                onChange={(e) => handleDiscountPercentChange(e.target.value)}
                                placeholder="%"
                                className="w-full p-2 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-emerald-500"
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Preset Discount Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-semibold mr-1">Quick Presets:</span>
                          {[10, 20, 30, 40, 50].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => applyPresetDiscount(pct)}
                              className={`px-2 py-0.5 text-[10px] font-extrabold rounded-lg border transition-all cursor-pointer ${
                                Number(discountPercent) === pct
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300"
                              }`}
                            >
                              {pct}% OFF
                            </button>
                          ))}
                        </div>

                        {/* Calculation summary pill */}
                        {Number(originalPrice) > 0 && Number(discountPercent) > 0 && (
                          <div className="bg-white/80 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-xs">
                            <span className="text-slate-500 text-[11px]">
                              Original <span className="line-through font-mono">C${Number(originalPrice).toFixed(2)}</span>
                            </span>
                            <span className="font-extrabold text-emerald-700 font-mono">
                              Save C${(Number(originalPrice) * (Number(discountPercent) / 100)).toFixed(2)} → C${Number(price).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Edit Price Sources */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Price Sources & Links (CAD)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPriceSource}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Source</span>
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {priceSources.map((src, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Retailer Name"
                            value={src.name}
                            onChange={(e) => handleUpdatePriceSource(idx, { name: e.target.value })}
                            className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold"
                          />
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">C$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Price (CAD)"
                              value={src.price}
                              onChange={(e) => handleUpdatePriceSource(idx, { price: Number(e.target.value) })}
                              className="p-1.5 pl-7 border border-slate-200 rounded-lg bg-slate-50 text-xs w-full font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="Site Search URL (https://...)"
                            value={src.url || ""}
                            onChange={(e) => handleUpdatePriceSource(idx, { url: e.target.value })}
                            className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-xs flex-1 font-mono text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePriceSource(idx)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-slate-200 cursor-pointer"
                            title="Remove source"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 min-h-[40px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Details view */}
                <div>
                  <h4 className="text-xl font-extrabold text-slate-800 tracking-tight">{item.name}</h4>
                  <span className="inline-flex items-center px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold rounded-lg mt-2">
                    {(() => {
                      const CategoryIcon = getCategoryIcon(item.category);
                      return <CategoryIcon className="w-3 h-3 mr-1.5 shrink-0" />;
                    })()}
                    {item.category}
                  </span>
                </div>

                <hr className="border-slate-100" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150/60">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Stock</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5 flex items-center">
                      <Package className="w-4 h-4 text-slate-500 mr-2" />
                      {item.quantity} units
                    </p>
                  </div>
                  <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/50">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Est. Online Price (CAD)</p>
                    <div className="flex items-baseline space-x-1.5 mt-0.5">
                      <p className="text-lg font-extrabold text-indigo-600 flex items-center">
                        <span className="text-indigo-500 font-bold text-sm mr-1 shrink-0">C$</span>
                        {item.averagePriceOnline?.toFixed(2)}
                      </p>
                      {item.originalPrice !== undefined && item.originalPrice > item.averagePriceOnline && (
                        <span className="text-xs text-slate-400 line-through font-mono">
                          C${item.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {item.discountPercent !== undefined && (
                      <span className="inline-block mt-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-200">
                        {item.discountPercent}% Markdown Applied
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150/60">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Item Valuations (CAD)</p>
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Est. Total Asset Value:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      C${((item.quantity || 0) * (item.averagePriceOnline || 0)).toLocaleString("en-CA", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>



                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    {item.description || "No description provided."}
                  </p>
                </div>

                {/* Mobile View: Price Valuation Sources & Alternative Possibilities below description */}
                <div className="block md:hidden">
                  {renderSourcesAndAlternatives()}
                </div>

                <div className="md:hidden bg-slate-50 p-3 rounded-xl border border-slate-150 text-xs text-slate-500 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">UID:</span>
                    <span className="font-mono text-[10px] select-all bg-white px-2 py-0.5 rounded border border-slate-200">{item.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">Date Added:</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                  {showDeleteConfirm ? (
                    <div className="flex-1 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between animate-fade-in">
                      <div className="flex items-center space-x-2">
                        <Trash2 className="w-4 h-4 text-rose-500 animate-pulse" />
                        <span className="text-xs font-bold text-rose-700">Confirm deletion?</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={handleDeleteConfirmClick}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-750 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-xs"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex-1 min-h-[40px] bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-1.5"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit Properties</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-xl transition-all flex items-center justify-center"
                        title="Delete item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal for Enlarged Photo */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="relative max-w-full max-h-[85vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md transition-all cursor-pointer flex items-center justify-center"
              title="Close enlarged photo"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage}
              alt="Enlarged item photo"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10 select-none"
            />
            {item.imageUrls && item.imageUrls.length > 1 && (
              <div className="flex gap-2.5 mt-4 overflow-x-auto max-w-full px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/15">
                {item.imageUrls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveImage(url);
                      setLightboxImage(url);
                    }}
                    className={`w-12 h-12 rounded-lg border overflow-hidden shrink-0 transition-all ${
                      lightboxImage === url ? "ring-2 ring-indigo-400 border-white scale-105" : "border-white/20 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
