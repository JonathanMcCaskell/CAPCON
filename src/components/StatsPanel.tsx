/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Package, Hash, DollarSign, Tag } from "lucide-react";
import { InventoryItem } from "../types";

interface StatsPanelProps {
  items: InventoryItem[];
}

export default function StatsPanel({ items }: StatsPanelProps) {
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalValue = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.averagePriceOnline || 0),
    0
  );

  // Find top category
  const categoryCounts: Record<string, number> = {};
  items.forEach((item) => {
    if (item.category) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }
  });

  let topCategory = "N/A";
  let maxCount = 0;
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topCategory = cat;
    }
  });

  const stats = [
    {
      id: "stat-total-items",
      label: "Unique Items",
      value: totalItems,
      icon: Package,
      bgColor: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      id: "stat-total-quantity",
      label: "Total Quantity",
      value: totalQuantity,
      icon: Hash,
      bgColor: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    {
      id: "stat-total-value",
      label: "Est. Ledger Value (CAD)",
      value: `C$${totalValue.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      bgColor: "bg-indigo-50 text-indigo-600 border-indigo-100",
    },
    {
      id: "stat-top-category",
      label: "Top Category",
      value: topCategory,
      icon: Tag,
      bgColor: "bg-amber-50 text-amber-600 border-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 w-full">
      {stats.map((stat) => (
        <div
          key={stat.id}
          id={stat.id}
          className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center space-x-2.5 sm:space-x-3.5 transition-all hover:shadow-md hover:border-slate-200/60 min-w-0"
        >
          <div className={`p-2 sm:p-2.5 rounded-xl border ${stat.bgColor} flex items-center justify-center shrink-0`}>
            <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              {stat.label}
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-800 tracking-tight mt-0.5 truncate">
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
