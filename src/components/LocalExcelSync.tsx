import React, { useState, useEffect, useRef } from "react";
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Check, 
  HardDrive, 
  FileUp, 
  ArrowDownToLine,
  Database,
  Upload,
  Download,
  Sparkles,
  Table,
  CheckCircle2,
  FileCode,
  Info,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
  BookOpen
} from "lucide-react";
import { InventoryItem } from "../types";
import * as XLSX from "xlsx";

interface LocalExcelSyncProps {
  items: InventoryItem[];
  onImportItems: (imported: Omit<InventoryItem, "id">[]) => Promise<void>;
  onExportExcel: () => void;
  showToast: (type: "success" | "error", message: string) => void;
}

export default function LocalExcelSync({ items, onImportItems, onExportExcel, showToast }: LocalExcelSyncProps) {
  // Config States
  const [filePath, setFilePath] = useState(() => {
    return localStorage.getItem("excel_filePath") || "inventory_local.xlsx";
  });
  const [autoSyncServer, setAutoSyncServer] = useState(() => {
    return localStorage.getItem("excel_autoSyncServer") !== "false";
  });
  const [autoSyncClient, setAutoSyncClient] = useState(() => {
    return localStorage.getItem("excel_autoSyncClient") === "true";
  });

  // Action / Status States
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [fileHandle, setFileHandle] = useState<any | null>(null);
  const [isFSASupported, setIsFSASupported] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Import States
  const [previewItems, setPreviewItems] = useState<any[] | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [isReadingExcel, setIsReadingExcel] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);

  // Guide States
  const [showGuide, setShowGuide] = useState(true);
  const [activeGuideTab, setActiveGuideTab] = useState<"import" | "autosync" | "export">("import");

  // Prevent initial mount sync trigger
  const isFirstMount = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect File System Access API support
  useEffect(() => {
    const isTopWindow = typeof window !== "undefined" && window.self === window.top;
    setIsFSASupported(
      typeof window !== "undefined" && 
      "showSaveFilePicker" in window &&
      isTopWindow
    );
  }, []);

  // Save config settings to localStorage
  useEffect(() => {
    localStorage.setItem("excel_filePath", filePath);
    localStorage.setItem("excel_autoSyncServer", String(autoSyncServer));
    localStorage.setItem("excel_autoSyncClient", String(autoSyncClient));
  }, [filePath, autoSyncServer, autoSyncClient]);

  // Synchronize on item changes (automatic background sync)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const triggerAutoSync = async () => {
      if (autoSyncServer) {
        await handleServerSync(items, false);
      }
      if (autoSyncClient && fileHandle) {
        await handleClientSync(items, false);
      }
    };

    const timer = setTimeout(() => {
      triggerAutoSync();
    }, 1200);

    return () => clearTimeout(timer);
  }, [items, autoSyncServer, autoSyncClient, fileHandle]);

  // Total valuation calculation
  const totalValuation = items.reduce(
    (acc, item) => acc + (item.quantity * (item.averagePriceOnline || 0)),
    0
  );

  // Server-side sync function
  const handleServerSync = async (itemsList: InventoryItem[], showSuccessToast = true) => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/save-local-excel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: itemsList,
          filePath: filePath.trim() || "inventory_local.xlsx"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Server responded with an error");
      }

      setLastSyncTime(new Date());
      if (showSuccessToast) {
        showToast("success", `Local Excel file updated at "${filePath}"!`);
      }
    } catch (err: any) {
      console.error("Local Server Excel sync failed:", err);
      if (showSuccessToast) {
        showToast("error", `Server sync failed: ${err.message || String(err)}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Client-side File System Access API sync function
  const handleClientSync = async (itemsList: InventoryItem[], showSuccessToast = true) => {
    if (!fileHandle) {
      if (showSuccessToast) {
        showToast("error", "No local file bound yet. Click 'Bind Local Disk File' first.");
      }
      return;
    }

    setIsSyncing(true);
    try {
      const options = { mode: "readwrite" };
      if ((await fileHandle.queryPermission(options)) !== "granted") {
        if ((await fileHandle.requestPermission(options)) !== "granted") {
          throw new Error("Write permissions were not granted by user.");
        }
      }

      const excelRows = itemsList.map((item, index) => ({
        "Serial No.": index + 1,
        "ID": item.id,
        "Item Name": item.name,
        "Category": item.category,
        "Quantity": item.quantity,
        "Est. Online Price (CAD)": item.averagePriceOnline,
        "Asset Valuation (CAD)": item.quantity * item.averagePriceOnline,
        "Brief Description": item.description,
        "Date Added": new Date(item.createdAt).toLocaleString("en-CA")
      }));

      const xlsxLib: typeof XLSX = (XLSX as any).default || XLSX;
      const worksheet = xlsxLib.utils.json_to_sheet(excelRows);
      
      if (excelRows.length > 0) {
        const maxLens = Object.keys(excelRows[0]).map(key => ({
          wch: Math.max(key.length, ...excelRows.map(row => String((row as any)[key] ?? "").length)) + 2
        }));
        worksheet["!cols"] = maxLens;
      }

      const workbook = xlsxLib.utils.book_new();
      xlsxLib.utils.book_append_sheet(workbook, worksheet, "Inventory Stockpile");

      const excelBuffer = xlsxLib.write(workbook, { type: "array", bookType: "xlsx" });
      
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array(excelBuffer));
      await writable.close();

      setLastSyncTime(new Date());
      if (showSuccessToast) {
        showToast("success", `Directly wrote database updates to "${fileHandle.name}"!`);
      }
    } catch (err: any) {
      console.error("Client FSA sync failed:", err);
      if (showSuccessToast) {
        showToast("error", `Direct file write failed: ${err.message || String(err)}`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Bind a persistent local file handle in the browser
  const handleBindFile = async () => {
    try {
      if (typeof window !== "undefined" && window.self !== window.top) {
        showToast("error", "Direct disk file pickers are restricted inside iframe preview mode. Use Server Sync or open app in a new tab!");
        return;
      }

      const options = {
        suggestedName: filePath || "inventory_local.xlsx",
        types: [{
          description: "Excel Spreadsheets",
          accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
        }]
      };
      
      const handle = await (window as any).showSaveFilePicker(options);
      setFileHandle(handle);
      setAutoSyncClient(true);
      showToast("success", `Successfully bound browser-stream file to "${handle.name}"!`);
      
      await handleClientSync(items, true);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Binding file error:", err);
        if (err.name === "SecurityError" || err.message?.includes("Cross origin") || err.message?.includes("sub frames") || err.message?.includes("showSaveFilePicker")) {
          showToast("error", "Direct disk file pickers are restricted inside iframe preview mode. Use Server Sync or open app in a new tab!");
        } else {
          showToast("error", `Failed to bind local file: ${err.message}`);
        }
      }
    }
  };

  // Load / Import from local Excel file from server disk
  const handleLoadExcelFromServer = async () => {
    setIsReadingExcel(true);
    setPreviewItems(null);
    try {
      const url = `/api/load-local-excel?filePath=${encodeURIComponent(filePath.trim())}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load file");
      }

      if (!data.exists) {
        showToast("error", `No existing file found at "${filePath}" to import.`);
        return;
      }

      if (!data.items || data.items.length === 0) {
        showToast("error", `The Excel file at "${filePath}" is empty.`);
        return;
      }

      setPreviewItems(data.items);
      setPreviewFileName(filePath);
      showToast("success", `Loaded server file "${filePath}"! Found ${data.items.length} items ready to import.`);
    } catch (err: any) {
      console.error("Load excel failed:", err);
      showToast("error", `Could not read spreadsheet: ${err.message || String(err)}`);
    } finally {
      setIsReadingExcel(false);
    }
  };

  // Drag & Drop / File Select parse
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const processUploadedFile = (file: File) => {
    setIsReadingExcel(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const xlsxLib: typeof XLSX = (XLSX as any).default || XLSX;
        const workbook = xlsxLib.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = xlsxLib.utils.sheet_to_json(worksheet);

        if (!jsonRows || jsonRows.length === 0) {
          showToast("error", "The uploaded spreadsheet appears to be empty.");
          setIsReadingExcel(false);
          return;
        }

        const mappedItems = jsonRows.map((row: any) => {
          const name = row["Item Name"] || row["Name"] || row["Item"] || row["Title"] || row["Product"] || "Unnamed Item";
          const qty = Number(row["Quantity"] || row["Qty"] || row["Count"] || 1) || 1;
          const cat = row["Category"] || row["Type"] || row["Group"] || "Miscellaneous";
          const price = Number(row["Est. Online Price (CAD)"] || row["Est. Online Price (CA$)"] || row["Est. Online Price (USD)"] || row["Price"] || row["Cost"] || row["Valuation"] || 0) || 0;
          const desc = row["Brief Description"] || row["Description"] || row["Notes"] || "";

          return {
            name: String(name),
            category: String(cat),
            quantity: qty,
            averagePriceOnline: price,
            description: String(desc),
            imageUrl: ""
          };
        });

        setPreviewItems(mappedItems);
        setPreviewFileName(file.name);
        showToast("success", `Parsed "${file.name}"! Found ${mappedItems.length} items ready to import.`);
      } catch (err: any) {
        console.error("Failed to parse uploaded file:", err);
        showToast("error", "Failed to parse file. Ensure it is a valid .xlsx, .xls, or .csv spreadsheet.");
      } finally {
        setIsReadingExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Download Blank Sample Template
  const handleDownloadTemplate = () => {
    try {
      const sampleRows = [
        {
          "Item Name": "Logitech MX Master 3S Mouse",
          "Category": "Electronics",
          "Quantity": 2,
          "Est. Online Price (CAD)": 99.99,
          "Brief Description": "Wireless ergonomic office mouse with silent clicks"
        },
        {
          "Item Name": "Ergonomic Mesh Task Chair",
          "Category": "Furniture",
          "Quantity": 1,
          "Est. Online Price (CAD)": 249.50,
          "Brief Description": "Adjustable lumbar support and 3D armrests"
        },
        {
          "Item Name": "Bosch 18V Cordless Drill",
          "Category": "Tools",
          "Quantity": 3,
          "Est. Online Price (CAD)": 129.00,
          "Brief Description": "Includes two 2.0Ah batteries and fast charger"
        }
      ];

      const xlsxLib: typeof XLSX = (XLSX as any).default || XLSX;
      const worksheet = xlsxLib.utils.json_to_sheet(sampleRows);
      worksheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 22 }, { wch: 45 }];

      const workbook = xlsxLib.utils.book_new();
      xlsxLib.utils.book_append_sheet(workbook, worksheet, "Template");
      xlsxLib.writeFile(workbook, "Authentic_Inventory_Template.xlsx");
      showToast("success", "Sample Excel template downloaded!");
    } catch (err) {
      showToast("error", "Could not generate sample template.");
    }
  };

  // Apply imported items to Firestore ledger
  const handleApplyImport = async () => {
    if (!previewItems || previewItems.length === 0) return;
    setIsApplyingImport(true);
    try {
      await onImportItems(previewItems);
      showToast("success", `Successfully imported ${previewItems.length} items into Firestore!`);
      setPreviewItems(null);
      setPreviewFileName(null);
    } catch (err: any) {
      console.error("Applying import failed:", err);
      showToast("error", `Failed to commit items: ${err.message || String(err)}`);
    } finally {
      setIsApplyingImport(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Welcome & Quick Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Spreadsheet & Database Sync Hub</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Excel Sync Engine
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bi-directionally bridge your local Excel spreadsheets with your cloud Firestore database. Export clean reports, bulk import items, or configure auto-saving to local disk files.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-3 rounded-xl text-center min-w-[120px]">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Synced Items</p>
              <p className="text-lg font-black text-white mt-0.5">{items.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-3 rounded-xl text-center min-w-[140px]">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Total Stock Value (CAD)</p>
              <p className="text-lg font-black text-emerald-400 mt-0.5">
                C${totalValuation.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Top Action Bar */}
      <div className="bg-white border border-slate-200/80 shadow-2xs rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs text-slate-600 font-medium">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Target File: <strong className="font-mono text-slate-800">{filePath}</strong></span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500">
            {lastSyncTime ? `Last updated ${lastSyncTime.toLocaleTimeString()}` : "Ready for sync"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <FileCode className="w-4 h-4 text-slate-500" />
            <span>Sample Template</span>
          </button>
        </div>
      </div>

      {/* Interactive Step-by-Step User Guide Card */}
      <div className="bg-white border border-indigo-100 shadow-xs rounded-2xl overflow-hidden transition-all duration-300">
        <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-slate-50 px-5 py-4 border-b border-indigo-100/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                User Guide: How to Use Excel Sync
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Step-by-Step Instructions
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Follow these simple steps to import, auto-sync, or export your inventory spreadsheets.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>{showGuide ? "Hide Guide" : "Show Step-by-Step Guide"}</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {showGuide && (
          <div className="p-5 space-y-5 animate-fade-in">
            {/* Guide Workflow Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setActiveGuideTab("import")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeGuideTab === "import"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>1. Bulk Import from Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab("autosync")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeGuideTab === "autosync"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>2. Automatic Real-Time Sync</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab("export")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  activeGuideTab === "export"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>3. Export Reports</span>
              </button>
            </div>

            {/* TAB 1: BULK IMPORT STEPS */}
            {activeGuideTab === "import" && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 relative flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                        1
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Get Template
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Download or Format</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Click <strong className="text-slate-700">"Sample Template"</strong> to download a formatted sheet, or ensure your Excel file includes columns: <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">Item Name</code>, <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">Category</code>, <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">Quantity</code>, <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">Price</code>.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full mt-2 py-1.5 bg-white border border-slate-200 hover:border-indigo-400 text-indigo-600 rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Download Sample Template</span>
                  </button>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 relative flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                        2
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Upload File
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Drag & Drop File</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Drag your <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">.xlsx</code>, <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">.xls</code>, or <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">.csv</code> into the upload area below, or click <strong className="text-slate-700">"Load from Server File"</strong> to parse existing server files.
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full mt-2 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1 cursor-pointer transition-all shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File to Upload</span>
                  </button>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 relative flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                        3
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Verify Data
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Preview Spreadsheet</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      The system parses and validates your rows instantly. Review the item names, quantities, and calculated asset valuation prices in the preview panel.
                    </p>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-xl flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Auto-maps headers automatically</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 relative flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                        4
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Commit Data
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Import into Database</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Click <strong className="text-slate-700">"Import Items into Database"</strong>. All items will be saved directly into your cloud database and appear across your catalogue.
                    </p>
                  </div>
                  <div className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-xl flex items-center space-x-1">
                    <Database className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Synced with cloud database</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AUTO SYNC STEPS */}
            {activeGuideTab === "autosync" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                      1
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Server Disk Path
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Configure File Name</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Under <strong className="text-slate-700">"Server Auto-Sync Config"</strong>, set your preferred file path (e.g. <code className="bg-slate-200/60 text-slate-800 px-1 rounded text-[10px]">inventory_local.xlsx</code>).
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                      2
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Auto-Mirroring
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Toggle Automatic Server Sync</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Check <strong className="text-slate-700">"Automatic Server Sync"</strong>. Whenever you add, edit, or remove items in the app, the background server auto-writes changes directly into your Excel file.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 hover:border-emerald-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                      3
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      Desktop Direct File Stream
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Bind Local File Handle (Optional)</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    In desktop browsers (Chrome/Edge), click <strong className="text-slate-700">"Bind Local File"</strong> to choose a file on your local computer. Browser edits write directly to your hard drive file!
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: EXPORT REPORT STEPS */}
            {activeGuideTab === "export" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 hover:border-slate-400 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-xl bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                      1
                    </span>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded-md">
                      Data Verification
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Review Live Inventory</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ensure all item entries, prices, quantities, and categories are up to date in your database.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 hover:border-slate-400 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-xl bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center shadow-2xs">
                      2
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Instant Download
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Click Export Excel (.xlsx)</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Click the <strong className="text-emerald-700">"Export Excel (.xlsx)"</strong> button at the top right of this screen. The system generates a formatted spreadsheet with serial numbers, valuation subtotals, and timestamps.
                  </p>
                  <button
                    onClick={onExportExcel}
                    className="w-full mt-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Live Excel Sheet Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Import & File Upload Zone */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Import Local Spreadsheet */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center">
                  <FileUp className="w-4 h-4 text-indigo-600 mr-2" />
                  Import & Bootstrap Inventory
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Upload an Excel spreadsheet from your computer or load directly from your server file.
                </p>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                .xlsx / .xls / .csv
              </span>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processUploadedFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50/60 scale-[1.01]"
                  : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-700">
                  Drag & Drop your Excel file here, or <span className="text-indigo-600 underline">browse</span>
                </p>
                <p className="text-[10px] text-slate-400">
                  Supports columns: Item Name, Category, Quantity, Est. Online Price, Brief Description
                </p>
              </div>
            </div>

            {/* Server Load Button Alternative */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-medium">Or load server file:</span>
              <button
                type="button"
                onClick={handleLoadExcelFromServer}
                disabled={isReadingExcel || isApplyingImport}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer"
              >
                {isReadingExcel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                <span>Load from "{filePath}"</span>
              </button>
            </div>

            {/* Spreadsheet Preview Table */}
            {previewItems && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Table className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Spreadsheet Preview ({previewFileName || "Uploaded File"})
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {previewItems.length} Items Found
                  </span>
                </div>

                <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 font-sans text-xs">
                  {previewItems.map((pItem: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                      <div className="min-w-0 pr-3">
                        <p className="font-bold text-slate-800 truncate">{pItem.name}</p>
                        <p className="text-[10px] text-slate-400">{pItem.category || "Uncategorized"} • Qty: {pItem.quantity}</p>
                      </div>
                      <span className="shrink-0 font-extrabold text-emerald-600 font-mono text-xs">
                        C${(Number(pItem.averagePriceOnline) || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewItems(null);
                      setPreviewFileName(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyImport}
                    disabled={isApplyingImport}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold flex items-center space-x-2 shadow-sm cursor-pointer transition-all"
                  >
                    {isApplyingImport ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    <span>Import {previewItems.length} Items into Database</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Auto-Sync Settings & How It Works */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 2: Server File Sync Settings */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center">
                <HardDrive className="w-4 h-4 text-emerald-600 mr-2" />
                Server Auto-Sync Config
              </h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                Local Server Disk
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Excel File Path on Server
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="inventory_local.xlsx"
                    className="flex-1 min-h-[38px] px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleServerSync(items, true)}
                    disabled={isSyncing || items.length === 0}
                    className="px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer transition-all shrink-0"
                    title="Manual Sync to Server Excel"
                  >
                    {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Auto Sync Toggle Switch */}
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">
                      Automatic Server Sync
                    </span>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Saves to server disk on every database change
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSyncServer}
                    onChange={(e) => setAutoSyncServer(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
              </div>

              {/* Direct File Handle Stream (Browser FSA API) */}
              <div className="bg-emerald-50/50 border border-emerald-200/60 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 mr-1.5" />
                    Direct Browser File Stream
                  </span>
                  {isFSASupported ? (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full flex items-center">
                      <Check className="w-3 h-3 mr-0.5" /> Active
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Desktop Only</span>
                  )}
                </div>

                <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                  Bind a local <code className="font-mono bg-emerald-100/80 px-1 rounded text-emerald-900">.xlsx</code> file directly to your browser for real-time local disk updates.
                </p>

                {fileHandle ? (
                  <div className="p-3 bg-white border border-emerald-200 rounded-xl flex items-center justify-between shadow-2xs">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-emerald-900 truncate">{fileHandle.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">Direct Stream Connected</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleBindFile}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleBindFile}
                    disabled={!isFSASupported}
                    className="w-full min-h-[36px] border border-dashed border-emerald-400 bg-white hover:bg-emerald-100/50 disabled:opacity-40 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition-all shadow-2xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Bind Local File (.xlsx)</span>
                  </button>
                )}

                {fileHandle && (
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={autoSyncClient}
                      onChange={(e) => setAutoSyncClient(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs text-emerald-900 font-medium">
                      Stream browser edits directly to disk file
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* How Sync Works Guide */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4 border border-slate-800 shadow-sm">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>How Excel Sync Works</span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <p><strong className="text-white">Firestore is Primary:</strong> All live item changes automatically save to Google Firestore.</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <p><strong className="text-white">Auto-Mirroring:</strong> When enabled, every update automatically writes a backup row to your local Excel file.</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <p><strong className="text-white">Bulk Import:</strong> Upload offline Excel lists anytime to bootstrap or expand your stock ledger in seconds.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
