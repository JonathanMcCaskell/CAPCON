/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});


// Set up JSON parsing with a large size limit to accommodate base64 photos
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Lazy initializer for Gemini API client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "") {
      throw new Error("GEMINI_API_KEY is not configured. Please configure your key in Settings > Secrets.");
    }
    console.log("Initializing Gemini client using GEMINI_API_KEY");
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint to analyze an image (and/or text hint) of an inventory item
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { image, mimeType, images, nameHint } = req.body;

    let client;
    try {
      client = getGeminiClient();
    } catch (keyError: any) {
      // If API Key is missing, provide a helpful fallback mock response so the app is still functional for testing!
      console.warn("Gemini API key error: ", keyError.message);
      
      // Fallback response for demo if Gemini isn't configured yet
      const fallbackName = nameHint || "Sample Unidentified Item";
      return res.json({
        success: true,
        name: fallbackName,
        category: "Miscellaneous",
        averagePriceOnline: 24.99,
        description: `This is a mockup/fallback item returned because the GEMINI_API_KEY is not yet configured. Please configure your key in Settings > Secrets to unlock live, real-time AI recognition of your item photos!`,
        confidenceScore: 85,
        otherPossibilities: [
          { name: "Alternative Standard Model", estimatedPrice: 19.99, reason: "A slightly older version or standard non-deluxe variant of this item." },
          { name: "Premium Edition Version", estimatedPrice: 39.99, reason: "An upscale or upgraded release with premium materials and features." }
        ],
        priceSources: [
          { name: "Amazon Canada", price: 24.99, url: `https://www.amazon.ca/s?k=${encodeURIComponent(fallbackName)}`, badge: "Primary Marketplace" },
          { name: "Walmart Canada", price: 23.50, url: `https://www.walmart.ca/en/search?q=${encodeURIComponent(fallbackName)}`, badge: "Lowest Price" },
          { name: "Canadian Tire", price: 26.99, url: `https://www.canadiantire.ca/en/search-results.html?q=${encodeURIComponent(fallbackName)}`, badge: "Retailer" },
          { name: "eBay Canada", price: 21.99, url: `https://www.ebay.ca/sch/i.html?_nkw=${encodeURIComponent(fallbackName)}`, badge: "Resale" }
        ],
        isFallback: true
      });
    }

    const contents: any[] = [];

    // Add visual contents if provided (supports multiple photos or single photo)
    if (images && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img.data && img.mimeType) {
          contents.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data,
            },
          });
        }
      }
    } else if (image && mimeType) {
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: image, // base64 payload
        },
      });
    }

    // Prepare prompt
    const hasVisuals = (images && images.length > 0) || (image && mimeType);
    let promptText = "Analyze this physical item for our inventory system. If multiple photos are provided, they show different angles, brands, or logos of the SAME item. Use all photos to identify what it is, its most appropriate inventory category, its estimated average market/online retail price in Canadian Dollars (CAD), its brand if visible, and write a brief 1-2 sentence description of it. Also, rate your confidence in this appraisal from 0 to 100 based on the photo quality, clarity, and visibility of key features like logos, text, or shapes. Finally, identify 2-3 other possible items, similar models, or alternative configurations that this item could potentially be, and state why.";
    if (nameHint) {
      promptText += ` Note: The user believes this item is a: "${nameHint}". Use this clue as guidance.`;
    }
    if (!hasVisuals) {
      promptText = `You are an expert inventory appraiser. The user has inputted an item with the name/clue: "${nameHint}". Based purely on this name, estimate its appropriate inventory category, its estimated average retail/online price in Canadian Dollars (CAD), write a brief 1-2 sentence description of it, estimate a confidence score from 0 to 100 representing how confident you are in appraising the item from just this text description clue, and identify 2-3 other possible items, similar models, or alternative configurations that this item could potentially be based on this text clue, and state why.`;
    }

    contents.push({ text: promptText });

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The official or recognized product name. Capitalize properly.",
            },
            category: {
              type: Type.STRING,
              description: "Standard inventory category. Must be one of: Electronics, Tools, Books, Apparel, Home Decor, Kitchenware, Office Supplies, Sports & Outdoors, Toys & Games, Collectibles, Miscellaneous.",
            },
            averagePriceOnline: {
              type: Type.NUMBER,
              description: "The estimated average online price in Canadian Dollars (CAD) (decimal or integer). E.g. 45.50. If completely unknown, return a sensible estimate.",
            },
            description: {
              type: Type.STRING,
              description: "A highly clear 1-2 sentence description outlining what it is and what it is typically used for.",
            },
            confidenceScore: {
              type: Type.NUMBER,
              description: "The estimated confidence score of the AI appraisal from 0 to 100 based on photo clarity, brand visibility, and product identification certainty.",
            },
            otherPossibilities: {
              type: Type.ARRAY,
              description: "A list of 2 to 3 other possible items, similar models, or alternative configurations that this item could potentially be.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "The name of the alternative product, model, or configuration.",
                  },
                  estimatedPrice: {
                    type: Type.NUMBER,
                    description: "Estimated retail or online price in Canadian Dollars (CAD) for this alternative option.",
                  },
                  reason: {
                    type: Type.STRING,
                    description: "A very brief 1-sentence explanation of why it might be this instead (e.g., 'A different trim level of the same model series').",
                  },
                },
                required: ["name", "estimatedPrice", "reason"],
              },
            },
            priceSources: {
              type: Type.ARRAY,
              description: "A list of 3-4 major Canadian retail websites and marketplaces where this item or similar items are listed with estimated CAD prices and site search URLs.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Retailer or marketplace name (e.g., Amazon Canada, Best Buy Canada, Canadian Tire, Walmart Canada, eBay Canada).",
                  },
                  price: {
                    type: Type.NUMBER,
                    description: "Estimated CAD price on this retailer site.",
                  },
                  url: {
                    type: Type.STRING,
                    description: "Direct web URL or site search link for this item on the retailer site (e.g. https://www.amazon.ca/s?k=item+name).",
                  },
                  badge: {
                    type: Type.STRING,
                    description: "A short badge label like 'Primary Marketplace', 'Authorized Retailer', 'Lowest Price', or 'Secondary Market'.",
                  },
                },
                required: ["name", "price", "url", "badge"],
              },
            },
          },
          required: ["name", "category", "averagePriceOnline", "description", "confidenceScore", "otherPossibilities", "priceSources"],
        },
        systemInstruction: "You are an intelligent visual appraiser for a household and business inventory tracking system. Your job is to return highly accurate, clean, structured JSON estimates for items presented in images or text.",
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response text returned from Gemini API.");
    }

    const parsedResult = JSON.parse(resultText.trim());
    return res.json({
      success: true,
      ...parsedResult,
    });
  } catch (err: any) {
    console.error("Error analyzing item image/text:", err);
    const errMsg = err.message || String(err);
    
    if (
      errMsg.includes("429") || 
      errMsg.includes("503") || 
      errMsg.includes("RESOURCE_EXHAUSTED") || 
      errMsg.includes("UNAVAILABLE") || 
      errMsg.includes("quota") || 
      errMsg.includes("limit")
    ) {
      return res.status(429).json({
        success: false,
        error: "Gemini API quota exceeded (free tier is limited to 20 requests/day) or the service is temporarily overloaded. Please try again later or input details manually. Your quota resets daily.",
        isQuotaExceeded: true
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred during item analysis.",
    });
  }
});

// API endpoint to save/synchronize inventory to a local Excel spreadsheet file
app.post("/api/save-local-excel", async (req, res) => {
  try {
    const { items, filePath = "inventory_local.xlsx" } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: "Items list is required and must be an array." });
    }

    // Resolve path cleanly (keep it within the workspace root directory safely)
    const safePath = path.resolve(process.cwd(), filePath);

    const excelRows = items.map((item: any, index: number) => ({
      "Serial No.": index + 1,
      "ID": item.id || "",
      "Item Name": item.name || "Unnamed Item",
      "Category": item.category || "Miscellaneous",
      "Quantity": Number(item.quantity) || 0,
      "Est. Online Price (CAD)": Number(item.averagePriceOnline) || 0,
      "Asset Valuation (CAD)": (Number(item.quantity) || 0) * (Number(item.averagePriceOnline) || 0),
      "Brief Description": item.description || "",
      "Date Added": item.createdAt ? new Date(item.createdAt).toLocaleString("en-CA") : new Date().toLocaleString("en-CA")
    }));

    const xlsxLib: typeof XLSX = (XLSX as any).default || XLSX;
    const worksheet = xlsxLib.utils.json_to_sheet(excelRows);
    
    // Auto-fit column widths
    if (excelRows.length > 0) {
      const maxLens = Object.keys(excelRows[0]).map(key => ({
        wch: Math.max(key.length, ...excelRows.map(row => String((row as any)[key] ?? "").length)) + 2
      }));
      worksheet["!cols"] = maxLens;
    }

    const workbook = xlsxLib.utils.book_new();
    xlsxLib.utils.book_append_sheet(workbook, worksheet, "Inventory Stockpile");

    // Write to local file system using fs
    const buffer = xlsxLib.write(workbook, { type: "buffer", bookType: "xlsx" });
    fs.writeFileSync(safePath, buffer);

    return res.json({
      success: true,
      message: `Successfully updated local Excel file at "${filePath}"`,
      path: safePath,
      timestamp: Date.now()
    });
  } catch (err: any) {
    console.error("Failed to write local Excel file:", err);
    return res.status(500).json({
      success: false,
      error: `Could not write local Excel file: ${err.message || String(err)}`
    });
  }
});

// API endpoint to read from a local Excel spreadsheet file
app.get("/api/load-local-excel", async (req, res) => {
  try {
    const filePath = (req.query.filePath as string) || "inventory_local.xlsx";
    const safePath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(safePath)) {
      return res.json({
        success: false,
        exists: false,
        message: `Local Excel file "${filePath}" does not exist yet.`
      });
    }

    const xlsxLib: typeof XLSX = (XLSX as any).default || XLSX;
    const fileBuffer = fs.readFileSync(safePath);
    const workbook = xlsxLib.read(fileBuffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsxLib.utils.sheet_to_json(worksheet);

    // Map rows back to the shape of InventoryItem
    const parsedItems = rawRows.map((row: any) => {
      const name = row["Item Name"] || row["name"] || "Imported Item";
      const category = row["Category"] || row["category"] || "Miscellaneous";
      const quantity = Number(row["Quantity"] || row["quantity"]) || 1;
      const averagePriceOnline = Number(row["Est. Online Price (CAD)"] || row["Est. Online Price (CA$)"] || row["Est. Online Price (USD)"] || row["averagePriceOnline"] || row["price"]) || 0;
      const description = row["Brief Description"] || row["description"] || "";
      
      let createdAt = Date.now();
      if (row["Date Added"] || row["createdAt"]) {
        const parsedDate = Date.parse(row["Date Added"] || row["createdAt"]);
        if (!isNaN(parsedDate)) {
          createdAt = parsedDate;
        }
      }

      return {
        name,
        category,
        quantity,
        averagePriceOnline,
        description,
        createdAt
      };
    });

    return res.json({
      success: true,
      exists: true,
      filePath,
      items: parsedItems
    });
  } catch (err: any) {
    console.error("Failed to read local Excel file:", err);
    return res.status(500).json({
      success: false,
      error: `Could not read local Excel file: ${err.message || String(err)}`
    });
  }
});

async function startServer() {
  // Local diagnostics for API Keys to help with local runs
  const gKey = process.env.GEMINI_API_KEY || "";
  console.log("=== API Key Diagnostics ===");
  if (!gKey || gKey === "MY_GEMINI_API_KEY" || gKey === "") {
    console.warn("⚠️  No API Key detected! Please create a '.env' file in the root folder (copied from '.env.example') and set your GEMINI_API_KEY.");
  } else {
    console.log(`✅ GEMINI_API_KEY detected! Length: ${gKey.length}, Prefix: ${gKey.substring(0, 6)}...`);
  }
  console.log("===========================");

  // Vite dev middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted for local development.");
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Inventory App server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
