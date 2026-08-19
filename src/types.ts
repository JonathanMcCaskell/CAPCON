/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AlternativePossibility {
  name: string;
  estimatedPrice: number;
  reason: string;
}

export interface PriceSource {
  name: string;
  price: number;
  url?: string;
  badge?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  averagePriceOnline: number;
  originalPrice?: number;
  discountPercent?: number;
  description: string;
  imageUrl?: string; // base64 data URL
  imageUrls?: string[]; // Multiple photos base64 data URLs
  confidenceScore?: number; // 0 to 100 confidence rating
  otherPossibilities?: AlternativePossibility[]; // alternative matches
  priceSources?: PriceSource[]; // price source comparisons
  createdAt: number;
}

export interface AnalyzeRequest {
  image?: string; // base64 without prefix
  mimeType?: string;
  images?: { data: string; mimeType: string }[];
  nameHint?: string;
}

export interface AnalyzeResponse {
  name: string;
  category: string;
  averagePriceOnline: number;
  description: string;
  confidenceScore: number;
  otherPossibilities?: AlternativePossibility[];
  priceSources?: PriceSource[];
  success: boolean;
  error?: string;
}

export interface HistoryChange {
  field: string;
  oldValue?: string | number;
  newValue?: string | number;
}

export interface HistoryLog {
  id: string;
  itemId?: string;
  itemName: string;
  action: "created" | "updated" | "deleted" | "quantity_change" | "imported";
  details: string;
  changes?: HistoryChange[];
  timestamp: number;
  category?: string;
}

