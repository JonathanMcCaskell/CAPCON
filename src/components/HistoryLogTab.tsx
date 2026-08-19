import React, { useState } from "react";
import {
  History,
  Search,
  Trash2,
  PlusCircle,
  Edit3,
  Layers,
  ArrowRight,
  Filter,
  FileSpreadsheet,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { HistoryLog } from "../types";

interface HistoryLogTabProps {
  logs: HistoryLog[];
  onClearHistory: () => Promise<void>;
}

export default function HistoryLogTab({ logs, onClearHistory }: HistoryLogTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [isClearing, setIsClearing] = useState(false);

  // Helper function to consolidate consecutive quantity_change logs for the same item
  const consolidateLogs = (inputLogs: HistoryLog[]): HistoryLog[] => {
    if (inputLogs.length <= 1) return inputLogs;

    const result: HistoryLog[] = [];
    const MAX_GAP_MS = 15 * 60 * 1000; // 15 minute window

    let i = 0;
    while (i < inputLogs.length) {
      const current = inputLogs[i];

      if (current.action === "quantity_change") {
        const itemKey = current.itemId || current.itemName;
        let chainOldValue = current.changes?.[0]?.oldValue;
        let chainNewValue = current.changes?.[0]?.newValue;
        let newestTimestamp = current.timestamp;
        let lastTimestamp = current.timestamp;

        // Look ahead to group older quantity_change entries for the same item within MAX_GAP_MS
        let j = i + 1;
        while (j < inputLogs.length) {
          const next = inputLogs[j];
          const nextKey = next.itemId || next.itemName;

          if (
            next.action === "quantity_change" &&
            nextKey === itemKey &&
            Math.abs(lastTimestamp - next.timestamp) <= MAX_GAP_MS
          ) {
            // Keep track of the oldest oldValue in the chain
            if (next.changes?.[0]?.oldValue !== undefined) {
              chainOldValue = next.changes[0].oldValue;
            }
            lastTimestamp = next.timestamp;
            j++;
          } else {
            break;
          }
        }

        // If we merged one or more logs
        if (j > i + 1) {
          if (
            chainOldValue !== undefined &&
            chainNewValue !== undefined &&
            String(chainOldValue) !== String(chainNewValue)
          ) {
            result.push({
              ...current,
              timestamp: newestTimestamp,
              details: `Adjusted quantity of "${current.itemName}" from ${chainOldValue} to ${chainNewValue}.`,
              changes: [
                { field: "quantity", oldValue: chainOldValue, newValue: chainNewValue }
              ]
            });
          }
          i = j;
          continue;
        }
      }

      result.push(current);
      i++;
    }

    return result;
  };

  const processedLogs = consolidateLogs(logs);

  // Filter logs
  const filteredLogs = processedLogs.filter((log) => {
    const matchesSearch =
      log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.category && log.category.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear all history records? This cannot be undone.")) {
      setIsClearing(true);
      try {
        await onClearHistory();
      } finally {
        setIsClearing(false);
      }
    }
  };

  const getActionBadge = (action: HistoryLog["action"]) => {
    switch (action) {
      case "created":
        return {
          label: "Item Created",
          bgColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: PlusCircle
        };
      case "updated":
        return {
          label: "Item Modified",
          bgColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: Edit3
        };
      case "deleted":
        return {
          label: "Item Removed",
          bgColor: "bg-rose-50 text-rose-700 border-rose-200",
          icon: Trash2
        };
      case "quantity_change":
        return {
          label: "Quantity Change",
          bgColor: "bg-amber-50 text-amber-700 border-amber-200",
          icon: Layers
        };
      case "imported":
        return {
          label: "Excel Import",
          bgColor: "bg-teal-50 text-teal-700 border-teal-200",
          icon: FileSpreadsheet
        };
      default:
        return {
          label: "Action",
          bgColor: "bg-slate-50 text-slate-700 border-slate-200",
          icon: History
        };
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    
    // Relative time
    const now = Date.now();
    const diffSec = Math.floor((now - ts) / 1000);
    let relative = "";
    if (diffSec < 60) relative = "Just now";
    else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
    else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
    else relative = `${Math.floor(diffSec / 86400)}d ago`;

    return { full: `${dateStr} at ${timeStr}`, relative };
  };

  // Metrics calculation
  const totalLogs = processedLogs.length;
  const createdCount = processedLogs.filter((l) => l.action === "created").length;
  const updatedCount = processedLogs.filter((l) => l.action === "updated" || l.action === "quantity_change").length;
  const deletedCount = processedLogs.filter((l) => l.action === "deleted").length;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Top Banner / Metrics */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Audit & Change History Log</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time timestamped audit ledger tracking item additions, property edits, quantity adjustments, and deletions.
              </p>
            </div>
          </div>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Audit Log</span>
            </button>
          )}
        </div>

        {/* Quick Metric Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Logged Events</span>
            <span className="text-base sm:text-lg font-extrabold text-slate-800">{totalLogs}</span>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Items Created</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-800">{createdCount}</span>
          </div>
          <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Modifications & Edits</span>
            <span className="text-base sm:text-lg font-extrabold text-indigo-800">{updatedCount}</span>
          </div>
          <div className="bg-rose-50/60 border border-rose-100 p-3 rounded-2xl">
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Items Removed</span>
            <span className="text-base sm:text-lg font-extrabold text-rose-800">{deletedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search log by item name or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl focus:outline-hidden focus:border-indigo-500 cursor-pointer w-full sm:w-auto"
          >
            <option value="all">All Actions ({processedLogs.length})</option>
            <option value="created">Created ({processedLogs.filter((l) => l.action === "created").length})</option>
            <option value="updated">Modified ({processedLogs.filter((l) => l.action === "updated").length})</option>
            <option value="quantity_change">Quantity Changes ({processedLogs.filter((l) => l.action === "quantity_change").length})</option>
            <option value="deleted">Removed ({processedLogs.filter((l) => l.action === "deleted").length})</option>
            <option value="imported">Excel Imports ({processedLogs.filter((l) => l.action === "imported").length})</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-700">No History Records Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm || actionFilter !== "all"
                ? "No logs match your search query or selected filter."
                : "Activity history will automatically appear here as items are created, modified, or removed from your inventory."}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getActionBadge(log.action);
            const BadgeIcon = badge.icon;
            const timeInfo = formatTimestamp(log.timestamp);

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border flex items-center space-x-1 shrink-0 ${badge.bgColor}`}>
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight truncate">
                      {log.itemName}
                    </h4>
                    {log.category && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-150 px-2 py-0.5 rounded-full shrink-0 hidden xs:inline">
                        {log.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 shrink-0 self-end sm:self-auto font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{timeInfo.full}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md">
                      {timeInfo.relative}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {log.details}
                </p>

                {/* Changes Table / Diffs if available */}
                {log.changes && log.changes.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 space-y-1.5 text-xs font-mono">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Specific Modifications:</span>
                    <div className="grid gap-1.5">
                      {log.changes.map((change, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-extrabold text-slate-700 capitalize min-w-[90px]">
                            {change.field}:
                          </span>
                          {change.oldValue !== undefined && (
                            <span className="line-through text-slate-400 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                              {String(change.oldValue)}
                            </span>
                          )}
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {String(change.newValue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
