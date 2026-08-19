/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  PackagePlus,
  Info,
  Check,
  RefreshCw,
  Layers,
  HelpCircle,
  FileSpreadsheet,
  Download,
  Camera,
  Database,
  Tag,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Wrench,
  BookOpen,
  Shirt,
  Sofa,
  Utensils,
  Briefcase,
  Trophy,
  Gamepad2,
  Crown,
  Package,
  Percent,
  History
} from "lucide-react";
import * as XLSX from "xlsx";

import { db } from "./lib/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "firebase/firestore";

import { InventoryItem, AnalyzeResponse, AlternativePossibility, HistoryLog, HistoryChange } from "./types";
import CameraCapture from "./components/CameraCapture";
import StatsPanel from "./components/StatsPanel";
import InventoryList from "./components/InventoryList";
import ItemDetailsModal from "./components/ItemDetailsModal";
import LocalExcelSync from "./components/LocalExcelSync";
import HistoryLogTab from "./components/HistoryLogTab";
import logoImage from "./assets/images/robot_box_logo_1784400025181.jpg";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getCategoryIcon(catName: string) {
  switch (catName) {
    case "Electronics":
      return Cpu;
    case "Tools":
      return Wrench;
    case "Books":
      return BookOpen;
    case "Apparel":
      return Shirt;
    case "Home Decor":
      return Sofa;
    case "Kitchenware":
      return Utensils;
    case "Office Supplies":
      return Briefcase;
    case "Sports & Outdoors":
      return Trophy;
    case "Toys & Games":
      return Gamepad2;
    case "Collectibles":
      return Crown;
    case "Miscellaneous":
    default:
      return Package;
  }
}

export default function App() {
  // DB Items State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);

  // Form Capture States
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [rawImages, setRawImages] = useState<{ data: string; mimeType: string }[]>([]);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [otherPossibilities, setOtherPossibilities] = useState<AlternativePossibility[]>([]);
  
  const [nameHint, setNameHint] = useState("");
  const [quantity, setQuantity] = useState<number | string>(1);
  const [category, setCategory] = useState("Miscellaneous");
  const [estimatedPrice, setEstimatedPrice] = useState<number | string>(0);
  const [description, setDescription] = useState("");

  // Discount / Markdown State
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number | string>(20);

  // UI Flow States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showFullFormInCamera, setShowFullFormInCamera] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiAnalysisComplete, setAiAnalysisComplete] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState<"intake" | "catalogue" | "excel" | "history">("intake");
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const mainContainerRef = useRef<HTMLElement>(null);

  // Helper to remove any undefined fields before writing to Firestore
  const sanitizeFirestorePayload = <T,>(obj: T): T => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeFirestorePayload(item)) as unknown as T;
    }
    if (typeof obj === "object" && !(obj instanceof Date)) {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = sanitizeFirestorePayload(value);
        }
      }
      return cleaned as T;
    }
    return obj;
  };

  // Firestore History Logger Helper
  const logHistoryEntry = async (entry: Omit<HistoryLog, "id">) => {
    try {
      const cleanEntry = sanitizeFirestorePayload(entry);
      await addDoc(collection(db, "history_logs"), cleanEntry);
    } catch (err) {
      console.error("Failed to log history entry:", err);
      handleFirestoreError(err, OperationType.CREATE, "history_logs");
    }
  };

  const handleClearHistory = async () => {
    try {
      const promises = historyLogs.map((log) => deleteDoc(doc(db, "history_logs", log.id)));
      await Promise.all(promises);
      showToast("success", "Audit history log cleared successfully.");
    } catch (err) {
      console.error("Failed to clear history log:", err);
      showToast("error", "Failed to clear history log.");
      handleFirestoreError(err, OperationType.DELETE, "history_logs");
    }
  };

  const scrollToTopCatalogue = () => {
    if (mainContainerRef.current) {
      mainContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOpenCatalogue = () => {
    setActiveTab("catalogue");
    setTimeout(() => {
      scrollToTopCatalogue();
    }, 20);
  };

  useEffect(() => {
    if (activeTab === "catalogue") {
      scrollToTopCatalogue();
    }
  }, [activeTab]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    return saved === "true";
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const SIDEBAR_CATEGORIES = [
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

  const getCategoryCount = (catName: string) => {
    if (catName === "All") {
      return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    return items
      .filter((item) => item.category === catName)
      .reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  // Firestore Sync
  useEffect(() => {
    setIsLoadingItems(true);
    const pathForOnSnapshot = "inventory";
    const unsubscribe = onSnapshot(
      collection(db, pathForOnSnapshot),
      (snapshot) => {
        const fetchedItems: InventoryItem[] = [];
        snapshot.forEach((doc) => {
          fetchedItems.push({
            id: doc.id,
            ...doc.data()
          } as InventoryItem);
        });
        // Sort newest first
        fetchedItems.sort((a, b) => b.createdAt - a.createdAt);
        setItems(fetchedItems);
        setIsLoadingItems(false);
      },
      (error) => {
        console.error("Firestore synchronisation failed:", error);
        showToast("error", "Failed to sync inventory with Firestore database.");
        setIsLoadingItems(false);
        handleFirestoreError(error, OperationType.GET, pathForOnSnapshot);
      }
    );

    const unsubscribeLogs = onSnapshot(
      collection(db, "history_logs"),
      (snapshot) => {
        const fetchedLogs: HistoryLog[] = [];
        snapshot.forEach((doc) => {
          fetchedLogs.push({
            id: doc.id,
            ...doc.data()
          } as HistoryLog);
        });
        fetchedLogs.sort((a, b) => b.timestamp - a.timestamp);
        setHistoryLogs(fetchedLogs);
      },
      (error) => {
        console.error("Firestore history sync failed:", error);
        handleFirestoreError(error, OperationType.GET, "history_logs");
      }
    );

    return () => {
      unsubscribe();
      unsubscribeLogs();
    };
  }, []);

  // Show dynamic banner feedback
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Callback when camera or upload captures an image
  const handleAddImage = (dataUrl: string, rawB64: string, mime: string) => {
    setCapturedImages((prev) => [...prev, dataUrl]);
    setRawImages((prev) => [...prev, { data: rawB64, mimeType: mime }]);
    setAiAnalysisComplete(false); // Reset to allow analysis of new photos
    showToast("success", "Photo added to appraisal queue!");
  };

  const handleRemoveImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
    setRawImages((prev) => prev.filter((_, i) => i !== index));
    setAiAnalysisComplete(false);
  };

  const handleClearAllImages = () => {
    setCapturedImages([]);
    setRawImages([]);
    setConfidenceScore(null);
    setOtherPossibilities([]);
    setAiAnalysisComplete(false);
  };

  // Trigger server-side Gemini analysis of images and text hint
  const handleAiScan = async () => {
    if (capturedImages.length === 0 && !nameHint) {
      showToast("error", "Please snap a photo or input an item name hint to analyze.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: rawImages.length > 0 ? rawImages : undefined,
          nameHint: nameHint || undefined
        })
      });

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        // Not JSON or empty body
      }

      if (!response.ok) {
        throw new Error(data?.error || `Analysis failed. Server status: ${response.status}`);
      }

      if (data && data.success) {
        setNameHint(data.name);
        setCategory(data.category);
        setEstimatedPrice(data.averagePriceOnline);
        setDescription(data.description);
        setConfidenceScore(data.confidenceScore ?? 100);
        setOtherPossibilities(data.otherPossibilities || []);
        setAiAnalysisComplete(true);

        if (data.isFallback) {
          showToast("success", "Mock scan completed! (Add GEMINI_API_KEY in Secrets for live AI)");
        } else {
          showToast("success", `AI parsed successfully: identified as "${data.name}"!`);
        }
      } else {
        throw new Error(data.error || "Gemini could not identify the item.");
      }
    } catch (err: any) {
      console.error("Scanning failed:", err);
      showToast("error", err.message || "Could not analyze item. Please enter details manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Write item to database
  const handleAddItemToDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameHint) {
      showToast("error", "Item name is required.");
      return;
    }

    setIsSaving(true);
    const pathForWrite = "inventory";
    try {
      const basePriceNum = Number(estimatedPrice) || 0;
      const discountPercentNum = applyDiscount ? Math.min(100, Math.max(0, Number(discountPercent) || 0)) : 0;
      const finalPrice = applyDiscount && discountPercentNum > 0
        ? Number(Math.max(0, basePriceNum * (1 - discountPercentNum / 100)).toFixed(2))
        : Number(basePriceNum.toFixed(2));

      let finalDescription = description;
      if (applyDiscount && discountPercentNum > 0) {
        const discountNote = `[Discounted ${discountPercentNum}% off original C$${basePriceNum.toFixed(2)}]`;
        finalDescription = finalDescription ? `${finalDescription}\n${discountNote}` : discountNote;
      }

      const newItem: Omit<InventoryItem, "id"> = sanitizeFirestorePayload({
        name: nameHint,
        category,
        quantity: Number(quantity),
        averagePriceOnline: finalPrice,
        ...(applyDiscount && discountPercentNum > 0 ? {
          originalPrice: basePriceNum,
          discountPercent: discountPercentNum,
        } : {}),
        description: finalDescription || "No description provided.",
        imageUrl: capturedImages[0] || "",
        imageUrls: capturedImages,
        confidenceScore: confidenceScore ?? 100, // defaults to 100 if manual appraisal verification
        otherPossibilities: otherPossibilities.length > 0 ? otherPossibilities : [],
        createdAt: Date.now()
      });

      const docRef = await addDoc(collection(db, pathForWrite), newItem);
      showToast("success", `"${nameHint}" committed to the ledger${applyDiscount && discountPercentNum > 0 ? ` with ${discountPercentNum}% discount!` : "!"}`);

      // Log history record
      await logHistoryEntry({
        itemId: docRef.id,
        itemName: nameHint,
        category,
        action: "created",
        details: `Added new item "${nameHint}" with initial quantity ${quantity} and unit value C$${finalPrice.toFixed(2)}${applyDiscount && discountPercentNum > 0 ? ` (${discountPercentNum}% discount applied)` : ""}.`,
        timestamp: Date.now()
      });

      // Reset Form State
      setNameHint("");
      setQuantity(1);
      setCategory("Miscellaneous");
      setEstimatedPrice(0);
      setDescription("");
      setCapturedImages([]);
      setRawImages([]);
      setConfidenceScore(null);
      setOtherPossibilities([]);
      setAiAnalysisComplete(false);
      setApplyDiscount(false);
      setDiscountPercent(20);
    } catch (err: any) {
      console.error("Failed to write to database:", err);
      showToast("error", "Could not commit to Firestore database. Please try again.");
      handleFirestoreError(err, OperationType.CREATE, pathForWrite);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick quantity updates from list components
  const handleUpdateQuantity = async (id: string, newQty: number) => {
    const existingItem = items.find((i) => i.id === id);
    if (!existingItem) return;
    const pathForWrite = `inventory/${id}`;
    try {
      const itemRef = doc(db, "inventory", id);
      await updateDoc(itemRef, { quantity: newQty });
      showToast("success", "Inventory stock updated.");

      // Check for a recent quantity_change log for this item (within 10 minutes)
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const recentLog = historyLogs.find(
        (log) => log.itemId === id && log.action === "quantity_change" && log.timestamp > tenMinutesAgo
      );

      if (recentLog) {
        // Retrieve the initial old value from the previous log
        const initialOldValue = recentLog.changes?.[0]?.oldValue ?? existingItem.quantity;

        if (Number(initialOldValue) === newQty) {
          // If returned to original quantity, delete the history record
          await deleteDoc(doc(db, "history_logs", recentLog.id));
        } else {
          // Consolidate into the existing history entry
          const logRef = doc(db, "history_logs", recentLog.id);
          const updateData = sanitizeFirestorePayload({
            details: `Adjusted quantity of "${existingItem.name}" from ${initialOldValue} to ${newQty}.`,
            changes: [
              { field: "quantity", oldValue: initialOldValue, newValue: newQty }
            ],
            timestamp: Date.now()
          });
          await updateDoc(logRef, updateData);
        }
      } else {
        // Log a new history record
        await logHistoryEntry({
          itemId: id,
          itemName: existingItem.name,
          category: existingItem.category,
          action: "quantity_change",
          details: `Adjusted quantity of "${existingItem.name}" from ${existingItem.quantity} to ${newQty}.`,
          changes: [
            { field: "quantity", oldValue: existingItem.quantity, newValue: newQty }
          ],
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error("Quantity adjust failed:", err);
      showToast("error", "Failed to update quantity.");
      handleFirestoreError(err, OperationType.UPDATE, pathForWrite);
    }
  };

  // Delete item from list
  const handleDeleteItem = async (id: string) => {
    const existingItem = items.find((i) => i.id === id);
    const pathForWrite = `inventory/${id}`;
    try {
      await deleteDoc(doc(db, "inventory", id));
      showToast("success", "Item deleted from catalog.");

      await logHistoryEntry({
        itemId: id,
        itemName: existingItem?.name || "Inventory Item",
        category: existingItem?.category,
        action: "deleted",
        details: `Removed "${existingItem?.name || "Item"}" from inventory (Quantity: ${existingItem?.quantity ?? 1}, Price: C$${(existingItem?.averagePriceOnline || 0).toFixed(2)}).`,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Deletion failed:", err);
      showToast("error", "Could not delete item.");
      handleFirestoreError(err, OperationType.DELETE, pathForWrite);
    }
  };

  // Save edits inside modal
  const handleSaveModalEdits = async (updatedItem: InventoryItem) => {
    const existingItem = items.find((i) => i.id === updatedItem.id);
    const { id, ...data } = updatedItem;
    const cleanData = sanitizeFirestorePayload(data);
    const pathForWrite = `inventory/${id}`;
    try {
      const itemRef = doc(db, "inventory", id);
      await updateDoc(itemRef, cleanData);
      showToast("success", "Item specifications saved successfully!");
      setSelectedItem(updatedItem); // Update detail view

      if (existingItem) {
        const changes: HistoryChange[] = [];
        if (existingItem.name !== updatedItem.name) {
          changes.push({ field: "name", oldValue: existingItem.name, newValue: updatedItem.name });
        }
        if (existingItem.category !== updatedItem.category) {
          changes.push({ field: "category", oldValue: existingItem.category, newValue: updatedItem.category });
        }
        if (existingItem.quantity !== updatedItem.quantity) {
          changes.push({ field: "quantity", oldValue: existingItem.quantity, newValue: updatedItem.quantity });
        }
        if (existingItem.averagePriceOnline !== updatedItem.averagePriceOnline) {
          changes.push({ field: "unit price (CAD)", oldValue: `C$${existingItem.averagePriceOnline.toFixed(2)}`, newValue: `C$${updatedItem.averagePriceOnline.toFixed(2)}` });
        }
        if (existingItem.discountPercent !== updatedItem.discountPercent) {
          changes.push({ field: "discount", oldValue: existingItem.discountPercent ? `${existingItem.discountPercent}%` : "None", newValue: updatedItem.discountPercent ? `${updatedItem.discountPercent}%` : "None" });
        }
        if (existingItem.description !== updatedItem.description) {
          changes.push({ field: "description", oldValue: "Previous description", newValue: "Updated description" });
        }

        await logHistoryEntry({
          itemId: updatedItem.id,
          itemName: updatedItem.name,
          category: updatedItem.category,
          action: "updated",
          details: changes.length > 0
            ? `Modified ${changes.length} specification(s) for "${updatedItem.name}".`
            : `Updated properties for "${updatedItem.name}".`,
          changes: changes.length > 0 ? changes : undefined,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error("Modal edit save failed:", err);
      showToast("error", "Failed to save item changes.");
      handleFirestoreError(err, OperationType.UPDATE, pathForWrite);
    }
  };

  // Import a bulk list of items into Firestore (e.g. from local Excel parse)
  const handleImportItems = async (importedList: Omit<InventoryItem, "id">[]) => {
    const pathForWrite = "inventory";
    try {
      const batchPromises = importedList.map((item) => {
        const newItem = sanitizeFirestorePayload({
          name: item.name || "Unnamed Item",
          category: item.category || "Miscellaneous",
          quantity: Number(item.quantity) || 1,
          averagePriceOnline: Number(item.averagePriceOnline) || 0,
          description: item.description || "Imported from local Excel spreadsheet.",
          imageUrl: item.imageUrl || "",
          createdAt: item.createdAt || Date.now()
        });
        return addDoc(collection(db, pathForWrite), newItem);
      });
      await Promise.all(batchPromises);

      await logHistoryEntry({
        itemName: "Bulk Excel Import",
        action: "imported",
        details: `Successfully imported ${importedList.length} item(s) from Excel spreadsheet.`,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error("Bulk database seed/import failed:", err);
      handleFirestoreError(err, OperationType.CREATE, pathForWrite);
    }
  };

  // Export full catalog list to an excel spreadsheet
  const handleExportExcel = () => {
    try {
      if (items.length === 0) {
        showToast("error", "There are no catalog items to export.");
        return;
      }

      const excelRows = items.map((item, index) => ({
        "Serial No.": index + 1,
        "ID": item.id ? item.id.slice(0, 6).toUpperCase() : "",
        "Item Name": item.name,
        "Category": item.category,
        "Quantity": item.quantity,
        "Est. Online Price (CAD)": item.averagePriceOnline,
        "Asset Valuation (CAD)": item.quantity * item.averagePriceOnline,
        "Brief Description": item.description,
        "Date Added": new Date(item.createdAt).toLocaleString("en-CA")
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      
      // Auto-fit column widths elegantly
      const maxLens = Object.keys(excelRows[0] || {}).map(key => ({
        wch: Math.max(key.length, ...excelRows.map(row => String((row as any)[key]).length)) + 2
      }));
      worksheet["!cols"] = maxLens;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Stockpile");

      // Download file triggers
      const fileName = `inventory_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast("success", `Spreadsheet exported as "${fileName}"!`);
    } catch (err) {
      console.error("Excel export failed:", err);
      showToast("error", "Could not export database contents to Excel spreadsheet.");
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-800">
      {/* Toast feedback layer */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center bg-white border border-slate-100 shadow-2xl px-5 py-3.5 rounded-2xl max-w-sm animate-slide-left">
          <div
            className={`w-2 h-2 rounded-full mr-3.5 shrink-0 ${
              toast.type === "success" ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-rose-500 shadow-[0_0_10px_#f43f5e]"
            }`}
          />
          <p className="text-xs font-semibold text-slate-700 tracking-wide leading-relaxed">
            {toast.message}
          </p>
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3.5 sm:px-6 shrink-0 z-10">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded overflow-hidden flex items-center justify-center border border-slate-200/80 bg-slate-50 shrink-0">
            <img
              src={logoImage}
              alt="Authentic Inventory Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-none">Authentic Inventory</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-50 border border-slate-100 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-slate-500 tracking-wide hidden xs:inline">Live Firestore Syncing</span>
            <span className="text-[10px] font-bold text-slate-500 tracking-wide xs:hidden">Live Sync</span>
          </div>
        </div>
      </header>

      {/* Main Layout Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Grid Area */}
        <main ref={mainContainerRef} className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto space-y-4 sm:space-y-6 bg-slate-50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-1 pb-2 border-b border-slate-200/60">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                {activeTab === "intake"
                  ? "Item Intake"
                  : activeTab === "catalogue"
                  ? "Full Ledger Catalogue"
                  : activeTab === "excel"
                  ? "Excel Sync & Data Integration"
                  : "Audit & Change History Log"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === "intake"
                  ? "Capture photos & appraise items side-by-side with a 8-item recent overview"
                  : activeTab === "catalogue"
                  ? `Browsing full database of ${items.length} registered inventory items`
                  : activeTab === "excel"
                  ? "Bi-directionally sync, import, or export Excel spreadsheets with your live database"
                  : "View timestamped log of created, modified, and removed items"}
              </p>
            </div>

            {/* View Switch Tabs */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto shrink-0">
              <button
                type="button"
                id="tab-btn-intake"
                onClick={() => setActiveTab("intake")}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer whitespace-nowrap ${
                  activeTab === "intake"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <PackagePlus className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Item Intake</span>
              </button>
              <button
                type="button"
                id="tab-btn-catalogue"
                onClick={handleOpenCatalogue}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer whitespace-nowrap ${
                  activeTab === "catalogue"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">Full Catalogue</span>
                <span className="sm:hidden font-semibold">Catalogue</span>
              </button>
              <button
                type="button"
                id="tab-btn-excel"
                onClick={() => setActiveTab("excel")}
                className={`hidden sm:flex flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer whitespace-nowrap ${
                  activeTab === "excel"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Excel Sync Engine</span>
              </button>
              <button
                type="button"
                id="tab-btn-history"
                onClick={() => setActiveTab("history")}
                className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer whitespace-nowrap ${
                  activeTab === "history"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <History className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="hidden sm:inline">Change History</span>
                <span className="sm:hidden font-semibold">History</span>
              </button>
            </div>
          </div>

          {/* Metrics Panel */}
          {activeTab === "catalogue" && <StatsPanel items={items} />}

          {/* TAB 1: Item Intake & Quick Overview */}
          {activeTab === "intake" && (
            <div className="space-y-6 w-full animate-fade-in">
              {/* TOP SECTION: Item Intake Registry */}
              <div className="w-full space-y-6">
                <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
                  <div>
                    <h2 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center">
                      <PackagePlus className="w-4 h-4 text-indigo-600 mr-2" />
                      Item Intake Registry & Appraisal
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Snap a picture, name the item, or describe it to automatically lookup price & details.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT: Photo / Camera Stream Window */}
                    <div className={`${isCameraActive ? "lg:col-span-8" : "lg:col-span-5"} space-y-3 transition-all duration-300`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>Photo Capture & Scan</span>
                        </div>
                        {isCameraActive && (
                          <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center space-x-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                            <span>Widescreen Camera</span>
                          </span>
                        )}
                      </div>
                      <CameraCapture
                        capturedImages={capturedImages}
                        onAddImage={handleAddImage}
                        onRemoveImage={handleRemoveImage}
                        onClearAll={handleClearAllImages}
                        onActiveChange={(active) => setIsCameraActive(active)}
                      />
                    </div>

                    {/* RIGHT: Appraisal Form & Item Details */}
                    <div className={`${isCameraActive ? "lg:col-span-4" : "lg:col-span-7"} transition-all duration-300`}>
                      {isCameraActive && (
                        <div className="mb-3 flex items-center justify-between bg-indigo-50/90 border border-indigo-200/80 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 shadow-2xs">
                          <span className="flex items-center space-x-1.5 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Camera Active — Fields Collapsed</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowFullFormInCamera(!showFullFormInCamera)}
                            className="text-[10px] font-extrabold text-indigo-700 bg-white hover:bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                          >
                            {showFullFormInCamera ? "Collapse Form" : "Expand Form"}
                          </button>
                        </div>
                      )}

                      <form onSubmit={handleAddItemToDb} className="space-y-4">
                        {/* Name & Clue Hint - Partially Collapsed when Camera Active */}
                        {isCameraActive && !showFullFormInCamera ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Item Name / Clue
                              </label>
                              <span className="text-[9px] text-slate-400 font-semibold">Compact</span>
                            </div>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Mechanical Keyboard..."
                              value={nameHint}
                              onChange={(e) => {
                                setNameHint(e.target.value);
                                setAiAnalysisComplete(false);
                              }}
                              className="w-full min-h-[34px] px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Item Name / Clue
                              </label>
                              <span className="text-[9px] text-slate-400 font-semibold">Required</span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                placeholder="e.g. Mechanical Keyboard, Bosch Drill..."
                                value={nameHint}
                                onChange={(e) => {
                                  setNameHint(e.target.value);
                                  setAiAnalysisComplete(false);
                                }}
                                className="w-full min-h-[40px] px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                              />
                            </div>
                          </div>
                        )}

                        {/* AI Helper trigger button */}
                        <button
                          type="button"
                          id="btn-ai-appraise"
                          onClick={handleAiScan}
                          disabled={isAnalyzing || (capturedImages.length === 0 && !nameHint)}
                          className="w-full min-h-[40px] bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-[11px] rounded-xl transition-all flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                        >
                          {isAnalyzing ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                              <span>Gemini Appraising...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              <span>Estimate with Gemini AI</span>
                            </>
                          )}
                        </button>

                        {/* Confidence Score Display */}
                        {aiAnalysisComplete && confidenceScore !== null && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between animate-fade-in">
                            <div className="space-y-0.5">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Appraisal Confidence</span>
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs font-extrabold ${
                                  confidenceScore >= 80 ? "text-emerald-600" : confidenceScore >= 50 ? "text-amber-600" : "text-rose-600"
                                }`}>
                                  {confidenceScore}% Certitude
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {confidenceScore >= 80 ? "(Highly Accurate)" : confidenceScore >= 50 ? "(Likely Correct)" : "(Verify details)"}
                                </span>
                              </div>
                            </div>
                            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                              <svg className="w-10 h-10 transform -rotate-90">
                                <circle cx="20" cy="20" r="16" stroke="#f1f5f9" strokeWidth="3" fill="transparent" />
                                <circle cx="20" cy="20" r="16" stroke={confidenceScore >= 80 ? "#10b981" : confidenceScore >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="3" fill="transparent"
                                  strokeDasharray={100}
                                  strokeDashoffset={100 - confidenceScore}
                                  strokeLinecap="round"
                                />
                              </svg>
                              <span className="absolute text-[9px] font-mono font-bold text-slate-700">{confidenceScore}%</span>
                            </div>
                          </div>
                        )}

                        {/* Alternative Possibilities Display */}
                        {aiAnalysisComplete && otherPossibilities && otherPossibilities.length > 0 && (
                          <div className="bg-indigo-50/40 border border-indigo-150/50 rounded-xl p-3.5 space-y-2.5 animate-fade-in">
                            <div className="flex items-center space-x-1.5">
                              <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="block text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                                Alternative Possibilities
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {otherPossibilities.map((alt, idx) => (
                                <div key={idx} className="bg-white/90 border border-indigo-100/60 p-2.5 rounded-lg flex flex-col space-y-1 shadow-xs">
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-[11px] font-bold text-slate-800 leading-tight">
                                      {alt.name}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
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

                        {/* Extra Properties Area */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                              onFocus={(e) => e.target.select()}
                              className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Est. Price (CAD)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">C$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={estimatedPrice}
                                onChange={(e) => setEstimatedPrice(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className="w-full min-h-[40px] pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Category
                            </label>
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500"
                            >
                              <option value="Electronics">Electronics</option>
                              <option value="Tools">Tools</option>
                              <option value="Books">Books</option>
                              <option value="Apparel">Apparel</option>
                              <option value="Home Decor">Home Decor</option>
                              <option value="Kitchenware">Kitchenware</option>
                              <option value="Office Supplies">Office Supplies</option>
                              <option value="Sports & Outdoors">Sports & Outdoors</option>
                              <option value="Toys & Games">Toys & Games</option>
                              <option value="Collectibles">Collectibles</option>
                              <option value="Miscellaneous">Miscellaneous</option>
                            </select>
                          </div>
                        </div>

                        {/* Discount / Markdown Feature */}
                        {(() => {
                          const basePriceNum = Number(estimatedPrice) || 0;
                          const discountPercentNum = applyDiscount ? Math.min(100, Math.max(0, Number(discountPercent) || 0)) : 0;
                          const calculatedDiscountedPrice = applyDiscount ? Math.max(0, basePriceNum * (1 - discountPercentNum / 100)) : basePriceNum;
                          const savingsAmount = basePriceNum - calculatedDiscountedPrice;

                          if (isCameraActive && !showFullFormInCamera) {
                            return (
                              <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 flex items-center justify-between">
                                <label className="flex items-center space-x-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={applyDiscount}
                                    onChange={(e) => setApplyDiscount(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                                    <Percent className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Discount Menu</span>
                                  </span>
                                </label>
                                {applyDiscount ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      {discountPercentNum}% OFF
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setShowFullFormInCamera(true)}
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Off</span>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="flex items-center space-x-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={applyDiscount}
                                    onChange={(e) => setApplyDiscount(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                                    <Percent className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Apply Percentage Discount</span>
                                  </span>
                                </label>
                                {applyDiscount && (
                                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    {discountPercentNum}% OFF
                                  </span>
                                )}
                              </div>

                              {applyDiscount && (
                                <div className="space-y-3 pt-1 animate-fade-in">
                                  {/* Preset percentage quick selector */}
                                  <div>
                                    <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                      Quick Discount Presets
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {[10, 20, 30, 40, 50, 60].map((preset) => (
                                        <button
                                          key={preset}
                                          type="button"
                                          onClick={() => setDiscountPercent(preset)}
                                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                                            Number(discountPercent) === preset
                                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                          }`}
                                        >
                                          {preset}%
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Custom percentage and real-time price preview */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Custom Discount %
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="1"
                                          value={discountPercent}
                                          onChange={(e) => setDiscountPercent(e.target.value)}
                                          onFocus={(e) => e.target.select()}
                                          className="w-full min-h-[38px] px-3 pr-7 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
                                          placeholder="15"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
                                      </div>
                                    </div>

                                    <div className="bg-white border border-emerald-200/80 rounded-lg p-2 flex flex-col justify-center min-h-[38px]">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Final Ledger Price</span>
                                      <div className="flex items-baseline space-x-1.5 mt-0.5">
                                        {basePriceNum > 0 && discountPercentNum > 0 && (
                                          <span className="text-[10px] text-slate-400 line-through font-mono">
                                            C${basePriceNum.toFixed(2)}
                                          </span>
                                        )}
                                        <span className="text-xs font-black text-emerald-700 font-mono">
                                          C${calculatedDiscountedPrice.toFixed(2)}
                                        </span>
                                      </div>
                                      {savingsAmount > 0 && (
                                        <span className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                                          Save C${savingsAmount.toFixed(2)} / unit
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(!isCameraActive || showFullFormInCamera) && (
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                              Description / Specifications
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Add brief details, brand, model..."
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 placeholder-slate-400"
                            />
                          </div>
                        )}

                        {/* Commit Action */}
                        <button
                          type="submit"
                          disabled={isSaving || !nameHint}
                          id="btn-add-ledger"
                          className="w-full min-h-[42px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer mt-2"
                        >
                          <span>Commit to Stock Ledger</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Overview Section (Recent 8 Items) */}
              <div className="w-full">
                {isLoadingItems ? (
                  <div className="w-full min-h-[250px] bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                    <p className="text-xs text-slate-400 mt-3 font-semibold">Synchronising database...</p>
                  </div>
                ) : (
                  <InventoryList
                    items={items}
                    isQuickOverview={true}
                    totalItemsCount={items.length}
                    onViewFullCatalogue={handleOpenCatalogue}
                    onUpdateQuantity={handleUpdateQuantity}
                    onDeleteItem={handleDeleteItem}
                    onExportExcel={handleExportExcel}
                    onSelectItem={setSelectedItem}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Full Ledger Catalogue */}
          {activeTab === "catalogue" && (
            <div className="w-full animate-fade-in space-y-6">
              <div className="w-full">
                {isLoadingItems ? (
                  <div className="w-full min-h-[300px] bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
                    <p className="text-xs text-slate-400 mt-3 font-semibold">Synchronising database...</p>
                  </div>
                ) : (
                  <InventoryList
                    items={items}
                    isQuickOverview={false}
                    totalItemsCount={items.length}
                    onUpdateQuantity={handleUpdateQuantity}
                    onDeleteItem={handleDeleteItem}
                    onExportExcel={handleExportExcel}
                    onSelectItem={setSelectedItem}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Excel Sync Engine (kept mounted so background auto-sync updates file on any tab change) */}
          <div className={activeTab === "excel" ? "w-full animate-fade-in block" : "hidden"}>
            <LocalExcelSync
              items={items}
              onImportItems={handleImportItems}
              onExportExcel={handleExportExcel}
              showToast={showToast}
            />
          </div>

          {/* TAB 4: Change History Log */}
          {activeTab === "history" && (
            <div className="w-full animate-fade-in">
              <HistoryLogTab
                logs={historyLogs}
                onClearHistory={handleClearHistory}
              />
            </div>
          )}
        </main>
      </div>

      {/* Footer Status Bar */}
      <footer className="h-8 bg-slate-800 text-slate-400 text-[10px] px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
            Database Sync: OK
          </span>
          <span className="hidden sm:inline">• Last Backup: Just now</span>
        </div>
        <div>
          <span>v2.4.1 Production Build • Authentic Inventory</span>
        </div>
      </footer>

      {/* Detail item popup modal */}
      <ItemDetailsModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={handleSaveModalEdits}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}
