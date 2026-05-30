import "dotenv/config";
import express from "express";
import { promises as fs } from "fs";
import path from "path";
import P from "pino";
import { createServer as createViteServer } from "vite";
import { connectDB, dbAPI, getDBStatus } from "./server/db.js";
import { getBotResponse } from "./server/gemini.js";
import { WhatsAppLog, WhatsAppSession } from "./src/types";
import { v2 as cloudinary } from "cloudinary";
import Stripe from "stripe";
import QRCode from "qrcode";
import * as Baileys from "@whiskeysockets/baileys";

const makeWASocket = ((Baileys as any).default ?? (Baileys as any).makeWASocket) as any;
const { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, useMultiFileAuthState } = Baileys as any;

const DEFAULT_APP_URL = "https://ai-shop.rantumondal.codes/";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dyhhdl1hy",
  api_key: process.env.CLOUDINARY_API_KEY || "973768443269143",
  api_secret: process.env.CLOUDINARY_API_SECRET || "einkSknfjpcE65pMk5sLUik61Zw"
});

// Lazy load Stripe
let stripeInstance: Stripe | null = null;
function getStripeInstance() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY || "";
    stripeInstance = new Stripe(key, { apiVersion: "2023-10-16" as any });
  }
  return stripeInstance;
}

const whatsappAuthDir = path.join(process.cwd(), "auth_info_baileys");
let whatsappLogs: WhatsAppLog[] = [
  {
    id: "log-1",
    timestamp: new Date().toISOString(),
    from: "System",
    message: "WhatsApp Automation Service initialized. Awaiting connection.",
    type: "system"
  }
];

let whatsappSocket: any = null;
let whatsappBootstrapPromise: Promise<void> | null = null;
let whatsappAuthSyncTimer: NodeJS.Timeout | null = null;
let whatsappReconnectTimer: NodeJS.Timeout | null = null;
let whatsappBridgeVersion = 0;
let whatsappBotSettings = {
  sessionId: "default",
  geminiReplyLimit: 4
};

type ConversationState = {
  geminiRepliesUsed: number;
  lastCategorySlug?: string;
  lastCategoryName?: string;
};

type WhatsAppReplyMode = "gemini" | "catalog" | "sku" | "categories";

const whatsappConversations = new Map<string, ConversationState>();

function normalizeCustomerNumber(value: string) {
  return String(value || "").replace(/[^\d+]/g, "").trim() || String(value || "").trim();
}

function normalizeLookupText(value: string) {
  return String(value || "").trim().toLowerCase();
}

function compactNumber(value: string) {
  return String(value || "").replace(/[^\d]/g, "");
}

function getConversationState(customerNumber: string): ConversationState {
  const key = normalizeCustomerNumber(customerNumber);
  const existing = whatsappConversations.get(key);
  if (existing) {
    return existing;
  }

  const created: ConversationState = { geminiRepliesUsed: 0 };
  whatsappConversations.set(key, created);
  return created;
}

function resetConversationState(customerNumber: string) {
  whatsappConversations.delete(normalizeCustomerNumber(customerNumber));
}

function pushWhatsAppLog(entry: WhatsAppLog) {
  whatsappLogs.push(entry);
  if (whatsappLogs.length > 250) {
    whatsappLogs = whatsappLogs.slice(-250);
  }
}

function getConnectedWhatsAppNumber() {
  const socketNumber = whatsappSocket?.user?.id ? whatsappSocket.user.id.split(":")[0] : "";
  return sessionPhoneNumberFromStore() || socketNumber || "";
}

async function sessionPhoneNumberFromStore() {
  const currentSession = await dbAPI.getWhatsAppSession("default");
  return currentSession?.phoneNumber || "";
}

function buildCategorySummary(categories: any[], products: any[]) {
  const grouped = categories.map((category) => {
    const count = products.filter((product) => product.category === category._id).length;
    return `${category.name}${count ? ` (${count})` : ""}`;
  });

  return grouped.length > 0 ? grouped.join("\n") : "No categories available yet.";
}

function buildCategoryListReply(categories: any[], products: any[], websiteUrl: string) {
  const lines = categories.length > 0
    ? categories.map((category, index) => `${index + 1}. ${category.name} - reply with this category name to see products`).join("\n")
    : ["No categories found in the catalog right now."].join("\n");

  return [
    "Here are the available product categories:",
    lines,
    "",
    `You can also browse the store here: ${websiteUrl}`
  ].join("\n");
}

function buildCategoryProductsReply(category: any, categoryProducts: any[], websiteUrl: string) {
  const productLines = categoryProducts.length > 0
    ? categoryProducts.map((product, index) => `${index + 1}. ${product.name} - SKU: ${product.sku}`).join("\n")
    : "No products are currently assigned to this category.";

  return [
    `Products in ${category.name}:`,
    productLines,
    "",
    "Reply with the SKU to get full product details.",
    `Store link: ${websiteUrl}`
  ].join("\n");
}

function buildProductDetailsReply(product: any, websiteUrl: string) {
  return [
    `Product details for SKU ${product.sku}:`,
    `Name: ${product.name}`,
    `Price: $${product.price}`,
    `Stock: ${product.stock} units`,
    `Description: ${product.description}`,
    `Status: ${product.stock > 0 ? "In stock" : "Out of stock"}`,
    "",
    `Browse more products: ${websiteUrl}`
  ].join("\n");
}

function findMatchingCategory(categories: any[], messageText: string) {
  const normalized = normalizeLookupText(messageText);
  return categories.find((category) => {
    const name = normalizeLookupText(category.name);
    const slug = normalizeLookupText(category.slug);
    return normalized === name || normalized.includes(name) || normalized === slug || normalized.includes(slug);
  }) || null;
}

function findMatchingSku(products: any[], messageText: string) {
  const normalized = String(messageText || "").toUpperCase();
  return products.find((product) => {
    const sku = String(product.sku || "").toUpperCase();
    const skuRegex = new RegExp(`\\b${sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return skuRegex.test(normalized) || normalized.includes(sku);
  }) || null;
}

async function getBotCatalogReply(incomingText: string, websiteUrl: string, customerNumber: string) {
  const products = await dbAPI.getProducts();
  const categories = await dbAPI.getCategories();
  const conversation = getConversationState(customerNumber);
  const normalized = normalizeLookupText(incomingText);

  const matchedSkuProduct = findMatchingSku(products, incomingText);
  if (matchedSkuProduct) {
    conversation.lastCategorySlug = matchedSkuProduct.category;
    const category = categories.find((item) => item._id === matchedSkuProduct.category) || null;
    conversation.lastCategoryName = category?.name;
    return {
      reply: buildProductDetailsReply(matchedSkuProduct, websiteUrl),
      mode: "sku" as WhatsAppReplyMode,
      productFound: true,
      matchedSku: matchedSkuProduct.sku,
      recognizedCode: matchedSkuProduct.sku
    };
  }

  const matchedCategory = findMatchingCategory(categories, incomingText);
  const asksForCategories = /\b(category|categories|available categories|what do you sell|product categories|show categories|all products|product details|list products)\b/i.test(normalized);
  const asksForProductDetails = /\b(product details|details|show products|available products|catalog|inventory)\b/i.test(normalized);

  if (matchedCategory) {
    const categoryProducts = products.filter((product) => product.category === matchedCategory._id);
    conversation.lastCategorySlug = matchedCategory._id;
    conversation.lastCategoryName = matchedCategory.name;
    return {
      reply: buildCategoryProductsReply(matchedCategory, categoryProducts, websiteUrl),
      mode: "catalog" as WhatsAppReplyMode,
      productFound: categoryProducts.length > 0,
      selectedCategory: matchedCategory.name
    };
  }

  if (asksForCategories || asksForProductDetails || conversation.geminiRepliesUsed >= whatsappBotSettings.geminiReplyLimit) {
    return {
      reply: [
        buildCategoryListReply(categories, products, websiteUrl),
        "",
        "If you already know the product code, send the SKU and I’ll pull the detailed product record."
      ].join("\n"),
      mode: "categories" as WhatsAppReplyMode,
      productFound: false
    };
  }

  return null;
}

async function buildWhatsAppReply(incomingText: string, customerNumber: string, websiteUrl: string, source: string) {
  const conversation = getConversationState(customerNumber);
  const catalogReply = await getBotCatalogReply(incomingText, websiteUrl, customerNumber);

  if (catalogReply) {
    if (catalogReply.mode !== "gemini") {
      conversation.geminiRepliesUsed = conversation.geminiRepliesUsed;
    }

    if (catalogReply.mode === "sku") {
      conversation.geminiRepliesUsed = 0;
    }

    return {
      ...catalogReply,
      action: catalogReply.mode === "sku" ? "sku-details" : catalogReply.mode === "catalog" ? "category-products" : "category-list"
    };
  }

  const aiResponse = await getBotResponse(incomingText, websiteUrl);
  conversation.geminiRepliesUsed += 1;

  return {
    ...aiResponse,
    mode: "gemini" as WhatsAppReplyMode,
    action: aiResponse.productFound ? "gemini-product-reply" : "gemini-reply",
    source
  };
}

function isWhatsAppSocketActive() {
  return Boolean(whatsappSocket && whatsappSocket?.ws?.readyState !== 3);
}

async function closeWhatsAppSocket() {
  if (!whatsappSocket) {
    return;
  }

  try {
    whatsappSocket.ev.removeAllListeners("connection.update");
    whatsappSocket.ev.removeAllListeners("creds.update");
    whatsappSocket.ev.removeAllListeners("messages.upsert");
    await whatsappSocket.end(undefined);
  } catch (error) {
    console.warn("WhatsApp socket close warning:", error);
  } finally {
    whatsappSocket = null;
  }
}

async function resetWhatsAppBridgeState() {
  whatsappBridgeVersion += 1;
  whatsappBootstrapPromise = null;
  if (whatsappReconnectTimer) {
    clearTimeout(whatsappReconnectTimer);
    whatsappReconnectTimer = null;
  }
  await closeWhatsAppSocket();
  await dbAPI.clearWhatsAppAuthState("default");
  await clearWhatsAppAuthDir();
  await updateWhatsAppSession({
    connected: false,
    status: "disconnected",
    qrCode: "",
    phoneNumber: ""
  });
}

async function ensureWhatsAppAuthDir() {
  await fs.mkdir(whatsappAuthDir, { recursive: true });
}

async function clearWhatsAppAuthDir() {
  const entries = await fs.readdir(whatsappAuthDir, { withFileTypes: true }).catch(() => [] as any[]);
  await Promise.all(
    entries
      .filter((entry: any) => entry.isFile?.() ?? false)
      .map((entry: any) => fs.unlink(path.join(whatsappAuthDir, entry.name)).catch(() => undefined))
  );
}

async function hydrateWhatsAppAuthDirFromMongo() {
  const storedFiles = await dbAPI.getWhatsAppAuthState("default");
  if (!storedFiles || Object.keys(storedFiles).length === 0) {
    return false;
  }

  await ensureWhatsAppAuthDir();
  await clearWhatsAppAuthDir();

  await Promise.all(
    Object.entries(storedFiles).map(([fileName, content]) =>
      fs.writeFile(path.join(whatsappAuthDir, fileName), content, "utf-8")
    )
  );

  return true;
}

async function persistWhatsAppAuthDirToMongo() {
  await ensureWhatsAppAuthDir();

  const entries = await fs.readdir(whatsappAuthDir, { withFileTypes: true }).catch(() => [] as any[]);
  const files: Record<string, string> = {};

  for (const entry of entries as any[]) {
    if (!entry.isFile?.() || !entry.name.endsWith(".json")) {
      continue;
    }

    try {
      files[entry.name] = await fs.readFile(path.join(whatsappAuthDir, entry.name), "utf-8");
    } catch (readError) {
      console.warn(`Skipping WhatsApp auth file ${entry.name} during Mongo sync:`, readError);
    }
  }

  if (Object.keys(files).length > 0) {
    await dbAPI.updateWhatsAppAuthState("default", files);
  }
}

function startWhatsAppAuthSyncLoop() {
  if (whatsappAuthSyncTimer) {
    return;
  }

  whatsappAuthSyncTimer = setInterval(() => {
    void persistWhatsAppAuthDirToMongo().catch((error) => {
      console.error("WhatsApp auth sync loop failure:", error);
    });
  }, 15000);

  whatsappAuthSyncTimer.unref?.();
}

function extractWhatsAppText(message: any) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.buttonsResponseMessage?.selectedButtonId ||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ""
  ).trim();
}

async function updateWhatsAppSession(data: Partial<WhatsAppSession>) {
  const current = (await dbAPI.getWhatsAppSession("default")) || { connected: false, status: "disconnected", qrCode: "", phoneNumber: "" };
  const nextSession: WhatsAppSession = {
    connected: data.connected ?? current.connected ?? false,
    status: data.status ?? current.status ?? "disconnected",
    qrCode: data.qrCode ?? current.qrCode,
    phoneNumber: data.phoneNumber ?? current.phoneNumber
  };

  await dbAPI.updateWhatsAppSession("default", nextSession);
  return nextSession;
}

async function startWhatsAppBridge() {
  if (whatsappBootstrapPromise) {
    return whatsappBootstrapPromise;
  }

  if (isWhatsAppSocketActive()) {
    return;
  }

  whatsappBootstrapPromise = (async () => {
    const bridgeVersion = whatsappBridgeVersion;

    try {
      await ensureWhatsAppAuthDir();
      await hydrateWhatsAppAuthDirFromMongo();

      if (bridgeVersion !== whatsappBridgeVersion) {
        return;
      }

      const logger = P({ level: "silent" });
      const { state, saveCreds } = await useMultiFileAuthState(whatsappAuthDir);
      startWhatsAppAuthSyncLoop();

      if (bridgeVersion !== whatsappBridgeVersion) {
        return;
      }

      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        const latestVersion = await fetchLatestBaileysVersion();
        if (Array.isArray(latestVersion?.version)) {
          version = latestVersion.version as [number, number, number];
        }
      } catch (versionError) {
        console.warn("Baileys version fetch failed, using pinned fallback version:", versionError);
      }

      whatsappSocket = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        browser: ["Shera Sawda", "Chrome", "1.0.0"]
      });

      if (bridgeVersion !== whatsappBridgeVersion) {
        await closeWhatsAppSocket();
        return;
      }

      whatsappSocket.ev.on("creds.update", async (...args: any[]) => {
        if (bridgeVersion !== whatsappBridgeVersion) {
          return;
        }

        await saveCreds(...args);
        void persistWhatsAppAuthDirToMongo().catch((error) => {
          console.error("WhatsApp auth persistence failure after creds update:", error);
        });
      });

      whatsappSocket.ev.on("messages.upsert", async (event: any) => {
        if (bridgeVersion !== whatsappBridgeVersion) {
          return;
        }

        try {
          const whatsappMessage = event?.messages?.[0];
          if (!whatsappMessage || whatsappMessage.key?.fromMe) {
            return;
          }

          const remoteJid = whatsappMessage.key?.remoteJid;
          if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
            return;
          }

          const incomingText = extractWhatsAppText(whatsappMessage.message);
          if (!incomingText) {
            return;
          }

          const customerNumber = remoteJid.split("@")[0];
          const hostHeader = process.env.APP_URL || DEFAULT_APP_URL;
          const session = await dbAPI.getWhatsAppSession("default");
          const connectedNumber = session?.phoneNumber || (whatsappSocket?.user?.id ? whatsappSocket.user.id.split(":")[0] : "");

          const incomingLog: WhatsAppLog = {
            id: `msg-in-${Date.now()}`,
            timestamp: new Date().toISOString(),
            from: customerNumber,
            message: incomingText,
            type: "incoming",
            connectedNumber,
            action: "incoming-message"
          };
          pushWhatsAppLog(incomingLog);

          pushWhatsAppLog({
            id: `sys-${Date.now()}-analysing`,
            timestamp: new Date().toISOString(),
            from: "AI Engine",
            message: `Analyzing incoming text from ${customerNumber}. Connected WhatsApp number: ${connectedNumber || "not connected"}.`,
            type: "system",
            connectedNumber,
            action: "analyzing-message"
          });

          const aiResponse = await buildWhatsAppReply(incomingText, customerNumber, hostHeader, "socket");

          const outgoingLog: WhatsAppLog = {
            id: `msg-out-${Date.now()}`,
            timestamp: new Date().toISOString(),
            from: "AI Bot (Seller)",
            message: aiResponse.reply,
            response: incomingText,
            type: "outgoing",
            connectedNumber,
            action: aiResponse.action || (aiResponse.productFound ? "product-reply" : "gemini-reply")
          };
          pushWhatsAppLog(outgoingLog);

          if (whatsappSocket) {
            await whatsappSocket.sendMessage(remoteJid, { text: aiResponse.reply });
          }
        } catch (error: any) {
          console.error("WhatsApp message handler failure:", error);
          pushWhatsAppLog({
            id: `msg-err-${Date.now()}`,
            timestamp: new Date().toISOString(),
            from: "AI Bot (Seller)",
            message: "কি জানতে চান? কোন product নেবেন সেটার SKU বলুন।",
            type: "outgoing"
            ,action: "error-fallback"
          });
        }
      });

      whatsappSocket.ev.on("connection.update", async (update: any) => {
        if (bridgeVersion !== whatsappBridgeVersion) {
          return;
        }

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              scale: 8,
              color: {
                dark: "#030712",
                light: "#ffffff"
              }
            });

            await updateWhatsAppSession({
              connected: false,
              status: "connecting",
              qrCode: qrDataUrl,
              phoneNumber: ""
            });
            void persistWhatsAppAuthDirToMongo().catch((error) => {
              console.error("WhatsApp auth persistence failure after QR generation:", error);
            });

            whatsappLogs.push({
              id: `log-${Date.now()}-qr`,
              timestamp: new Date().toISOString(),
              from: "Server",
              message: "Generated live WhatsApp Web QR code. Scan it from WhatsApp > Linked devices.",
              type: "system"
            });
          } catch (qrError) {
            console.error("WhatsApp QR generation failure:", qrError);
            await updateWhatsAppSession({
              connected: false,
              status: "connecting",
              qrCode: "",
              phoneNumber: ""
            });
          }
        }

        if (connection === "open") {
          const phoneNumber = whatsappSocket?.user?.id ? whatsappSocket.user.id.split(":")[0] : "";
          await updateWhatsAppSession({
            connected: true,
            status: "connected",
            qrCode: "",
            phoneNumber
          });
          void persistWhatsAppAuthDirToMongo().catch((error) => {
            console.error("WhatsApp auth persistence failure after connection open:", error);
          });

          whatsappLogs.push({
            id: `log-${Date.now()}-open`,
            timestamp: new Date().toISOString(),
            from: "System",
            message: `✅ WhatsApp connected successfully${phoneNumber ? ` for ${phoneNumber}` : ""}.`,
            type: "system"
          });
        }

        if (connection === "close") {
          const disconnectCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const loggedOut = disconnectCode === DisconnectReason.loggedOut;
          const currentSession = await dbAPI.getWhatsAppSession("default");

          if (loggedOut) {
            await dbAPI.clearWhatsAppAuthState("default");
            await clearWhatsAppAuthDir();
            await updateWhatsAppSession({
              connected: false,
              status: "disconnected",
              qrCode: "",
              phoneNumber: ""
            });
          } else {
            await updateWhatsAppSession({
              connected: false,
              status: "connecting",
              qrCode: currentSession?.qrCode || "",
              phoneNumber: whatsappSocket?.user?.id ? whatsappSocket.user.id.split(":")[0] : (currentSession?.phoneNumber || "")
            });
            void persistWhatsAppAuthDirToMongo().catch((error) => {
              console.error("WhatsApp auth persistence failure after close:", error);
            });
          }

          whatsappLogs.push({
            id: `log-${Date.now()}-close`,
            timestamp: new Date().toISOString(),
            from: "System",
            message: loggedOut
              ? "WhatsApp session logged out. Scan again to reconnect."
              : "WhatsApp connection closed. Click Connect to generate a fresh QR code.",
            type: "system"
          });

          whatsappSocket = null;

          if (!loggedOut) {
            if (whatsappReconnectTimer) {
              clearTimeout(whatsappReconnectTimer);
            }

            whatsappReconnectTimer = setTimeout(() => {
              whatsappReconnectTimer = null;
              void startWhatsAppBridge();
            }, 2500);

            whatsappReconnectTimer.unref?.();
          }
        }
      });
    } catch (error) {
      if (bridgeVersion !== whatsappBridgeVersion) {
        return;
      }

      console.error("WhatsApp bridge bootstrap failure:", error);
      whatsappSocket = null;
      await updateWhatsAppSession({
        connected: false,
        status: "disconnected",
        qrCode: "",
        phoneNumber: ""
      });
      void persistWhatsAppAuthDirToMongo().catch((syncError) => {
        console.error("WhatsApp auth persistence failure after bootstrap error:", syncError);
      });

      whatsappLogs.push({
        id: `log-${Date.now()}-bootstrap-error`,
        timestamp: new Date().toISOString(),
        from: "Server",
        message: "WhatsApp bridge could not start right now. Please retry connection after the server finishes initializing.",
        type: "system"
      });
    }
  })();

  try {
    await whatsappBootstrapPromise;
  } finally {
    whatsappBootstrapPromise = null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set standard body parsers with increased size limit for base64 image uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Global server state for WhatsApp automation
  let whatsappSession: WhatsAppSession = {
    connected: false,
    status: 'disconnected',
    qrCode: undefined,
    phoneNumber: undefined
  };

  // Initialize DB asynchronously
  const dbConnected = await connectDB();
  console.log(`Database connected? ${dbConnected ? 'YES' : 'NO'}`);
  whatsappBotSettings = await dbAPI.getWhatsAppBotSettings("default");
  void startWhatsAppBridge().catch((error) => {
    console.error("Failed to initialize WhatsApp bridge:", error);
  });

  // Base API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      db: getDBStatus()
    });
  });

  // Cloudinary direct base64 image uploader endpoint
  app.post("/api/upload", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Missing 'image' parameter in body." });
      }
      
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: "storebot_media"
      });
      res.json({ url: uploadResponse.secure_url });
    } catch (error: any) {
      console.error("Cloudinary upload failure:", error);
      res.status(500).json({ error: error.message || "Failed uploading via Cloudinary gateway" });
    }
  });

  // SMS ingestion endpoint for mobile SMS forwarder apps
  function parsePaymentSms(message: string) {
    const amountMatch = message.match(/Received\s+Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
    const senderMatch = message.match(/\bfrom\s+([+\d][\d\s()-]{5,})/i);
    const trxIdMatch = message.match(/\bTrxID\s+([A-Za-z0-9_-]+)/i);
    const dateTimeMatch = message.match(/\bat\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);

    const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : 0;
    const sender = senderMatch ? senderMatch[1].replace(/\s+/g, "").trim() : "unknown";
    const trxId = trxIdMatch ? trxIdMatch[1].trim().toUpperCase() : "";
    const dateTime = dateTimeMatch ? dateTimeMatch[1].trim() : new Date().toISOString();

    return { amount, sender, trxId, dateTime };
  }

  const saveSmsHandler = async (req: express.Request, res: express.Response) => {
    try {
      const body = req.body || {};
      const message = String(body.message || body.text || body.sms || body.body || "").trim();

      if (!message) {
        return res.status(400).json({ error: "SMS message is required." });
      }

      const parsed = parsePaymentSms(message);
      if (!parsed.trxId) {
        return res.status(400).json({ error: "TrxID not found in SMS message." });
      }

      if (!parsed.amount) {
        return res.status(400).json({ error: "Amount not found in SMS message." });
      }

      const saved = await dbAPI.createSmsMessage({
        amount: parsed.amount,
        sender: parsed.sender,
        trxId: parsed.trxId,
        dateTime: parsed.dateTime,
        status: 'Unused',
        message,
        payload: body
      });

      res.status(201).json({ success: true, data: saved });
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: "Duplicate TrxID. This SMS was already saved." });
      }
      console.error("SMS ingestion failure:", error);
      res.status(500).json({ error: error.message || "Failed to save SMS message" });
    }
  };

  app.post("/sms", saveSmsHandler);
  app.post("/api/sms", saveSmsHandler);

  app.get("/sms", async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const items = await dbAPI.getSmsMessages(limit);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch SMS messages" });
    }
  });

  app.get("/api/sms", async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const items = await dbAPI.getSmsMessages(limit);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch SMS messages" });
    }
  });

  app.post("/api/payment/method-2", async (req, res) => {
    try {
      const { items, email } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Shopping cart items is required." });
      }
      if (!email) {
        return res.status(400).json({ error: "Customer email is required." });
      }

      let total = 0;
      const resolvedItems = [];

      for (const item of items) {
        const prod = await dbAPI.getProductBySku(item.sku);
        if (!prod) {
          return res.status(404).json({ error: `Product with SKU ${item.sku} not found in our catalog.` });
        }

        const currentQty = Number(item.quantity) || 1;
        resolvedItems.push({
          productId: prod._id,
          name: prod.name,
          sku: prod.sku,
          price: prod.price,
          quantity: currentQty,
          image: prod.images[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"
        });
        total += prod.price * currentQty;
      }

      const order = await dbAPI.createOrder({
        userEmail: email,
        items: resolvedItems,
        total,
        stripePaymentIntentId: "",
        status: "pending",
        paymentMethod: "method2",
        validationAttempts: 0,
        trxId: ""
      } as any);

      res.status(201).json({
        success: true,
        message: "Payment method 2 order created. Please enter your TrxID to verify the payment.",
        order
      });
    } catch (error: any) {
      console.error("Method 2 order creation failure:", error);
      res.status(500).json({ error: error.message || "Failed to create method 2 order" });
    }
  });

  app.post("/validate-trx", async (req, res) => {
    try {
      const trxId = String(req.body?.trxId || req.body?.TrxID || req.query?.trxId || "").trim();
      const orderId = String(req.body?.orderId || req.query?.orderId || "").trim();

      if (!trxId) {
        return res.status(400).json({ valid: false, used: false, message: "TrxID is required." });
      }

      if (orderId) {
        const result = await dbAPI.processMethod2Validation(orderId, trxId);
        if (result.used) {
          return res.json(result);
        }
        if (result.canceled) {
          return res.status(410).json(result);
        }
        return res.status(result.valid ? 409 : 404).json(result);
      }

      const result = await dbAPI.validateAndUseTrxId(trxId);

      if (!result.valid) {
        return res.status(404).json(result);
      }

      if (!result.used) {
        return res.status(409).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error("TrxID validation failure:", error);
      res.status(500).json({ valid: false, used: false, message: error.message || "Failed to validate TrxID" });
    }
  });

  // Stripe Payment Checkout integration
  app.post("/api/payment/stripe", async (req, res) => {
    try {
      const { items, email } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Shopping cart items is required." });
      }
      if (!email) {
        return res.status(400).json({ error: "Customer email is required." });
      }

      // 1. Perform strict validation check first across all products
      for (const item of items) {
        const prod = await dbAPI.getProductBySku(item.sku);
        if (!prod) {
          return res.status(404).json({ error: `Product with SKU ${item.sku} not found in our catalog.` });
        }
        const requestedQty = Number(item.quantity) || 1;
        if (prod.stock < requestedQty) {
          return res.status(400).json({ 
            error: `Sorry, only ${prod.stock} items left in stock` 
          });
        }
      }

      let total = 0;
      const resolvedItems = [];

      for (const item of items) {
        // Resolve item from db to ensure pricing and stock calculations
        const prod = await dbAPI.getProductBySku(item.sku);
        if (prod) {
          // Verify stock and decrement
          const currentQty = Number(item.quantity) || 1;
          const updatedStock = Math.max(0, prod.stock - currentQty);
          await dbAPI.updateProduct(prod._id, { stock: updatedStock });

          resolvedItems.push({
            productId: prod._id,
            name: prod.name,
            sku: prod.sku,
            price: prod.price,
            quantity: currentQty,
            image: prod.images[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"
          });
          total += prod.price * currentQty;
        }
      }

      if (resolvedItems.length === 0) {
        return res.status(400).json({ error: "None of the products SKU matches catalog items." });
      }

      // Generate simulated/Stripe payment transaction reference ID
      let paymentIntentId = "pay_sim_" + Math.random().toString(36).substring(2, 10).toUpperCase();

      try {
        const stripe = getStripeInstance();
        if (stripe) {
          // Dynamically try charging through the live Stripe transaction pipeline
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(total * 100), // convert to cents
            currency: "usd",
            receipt_email: email,
            metadata: {
              customer_email: email,
              skus: resolvedItems.map(i => i.sku).join(",")
            }
          });
          paymentIntentId = paymentIntent.id;
        }
      } catch (stripeErr: any) {
        console.warn("Stripe API integration warning (Using fallback transaction logic):", stripeErr.message);
      }

      // Create Order in DB
      const order = await dbAPI.createOrder({
        userEmail: email,
        items: resolvedItems,
        total,
        stripePaymentIntentId: paymentIntentId,
        status: "completed"
      });

      res.status(201).json({ success: true, order });
    } catch (err: any) {
      console.error("Payment API error:", err);
      res.status(500).json({ error: err.message || "Failed processing payment session" });
    }
  });

  // Client Orders Fetch Endpoints
  app.get("/api/orders", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: "Customer email is required." });
      }
      const orders = await dbAPI.getOrders(email);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve historic transactions." });
    }
  });

  // Customer Profile Settings Endpoints
  app.get("/api/profile", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: "Email is required." });
      }
      let profile = await dbAPI.getUserProfile(email);
      if (!profile) {
        profile = {
          email,
          name: email.split("@")[0],
          photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
          phoneNumber: "",
          shippingAddress: ""
        };
      }
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to retrieve user profile coordinates." });
    }
  });

  app.post("/api/profile", async (req, res) => {
    try {
      const { email, name, photoURL, phoneNumber, shippingAddress } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required to preserve profile." });
      }
      const updatedProfile = await dbAPI.updateUserProfile(email, {
        name,
        photoURL,
        phoneNumber,
        shippingAddress
      });
      res.json({ success: true, profile: updatedProfile });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to preserve/update user profile." });
    }
  });

  // --- CATEGORIES CRUD ENDPOINTS ---
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await dbAPI.getCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const { name, slug, image } = req.body;
      const category = await dbAPI.addCategory({ name, slug, image });
      res.status(201).json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, image } = req.body;
      const updated = await dbAPI.updateCategory(id, { name, slug, image });
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await dbAPI.deleteCategory(id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete category" });
    }
  });

  // --- PRODUCTS CRUD ENDPOINTS ---
  app.get("/api/products", async (req, res) => {
    try {
      const products = await dbAPI.getProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch products" });
    }
  });

  app.get("/api/products/validate-sku", async (req, res) => {
    try {
      const sku = req.query.sku as string;
      const excludeId = req.query.excludeId as string;
      if (!sku) {
        return res.json({ isDuplicate: false });
      }
      const cleanSku = sku.trim().toUpperCase();
      const product = await dbAPI.getProductBySku(cleanSku);
      const isDuplicate = product !== null && product._id !== excludeId;
      res.json({ isDuplicate });
    } catch (error: any) {
      console.error("SKU validation failure:", error);
      res.status(500).json({ error: error.message || "Failed validating SKU" });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const product = await dbAPI.getProductBySlug(slug);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const { name, slug, description, price, stock, sku, images, category } = req.body;
      const product = await dbAPI.addProduct({ name, slug, description, price, stock, sku, images, category });
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, slug, description, price, stock, sku, images, category } = req.body;
      const updated = await dbAPI.updateProduct(id, { name, slug, description, price, stock, sku, images, category });
      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await dbAPI.deleteProduct(id);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete product" });
    }
  });

  // --- WHATSAPP SIMULATION ENDPOINTS ---
  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const session = await dbAPI.getWhatsAppSession("default");
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed retrieving WhatsApp session status" });
    }
  });

  app.get("/api/whatsapp/bot-settings", async (req, res) => {
    try {
      const settings = await dbAPI.getWhatsAppBotSettings("default");
      whatsappBotSettings = settings;
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed retrieving WhatsApp bot settings" });
    }
  });

  app.put("/api/whatsapp/bot-settings", async (req, res) => {
    try {
      const geminiReplyLimit = Number(req.body?.geminiReplyLimit);
      const updated = await dbAPI.updateWhatsAppBotSettings("default", { geminiReplyLimit });
      whatsappBotSettings = updated;
      pushWhatsAppLog({
        id: `log-${Date.now()}-settings`,
        timestamp: new Date().toISOString(),
        from: "System",
        message: `Gemini reply limit updated to ${updated.geminiReplyLimit}.`,
        type: "system",
        action: "settings-updated"
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed updating WhatsApp bot settings" });
    }
  });

  app.post("/api/whatsapp/test-gemini", async (req, res) => {
    try {
      const message = String(req.body?.message || req.body?.text || "").trim();
      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      const hostHeader = req.headers.host || DEFAULT_APP_URL;
      const appUrl = process.env.APP_URL || (hostHeader.startsWith("http") ? hostHeader : `https://${hostHeader}`);
      const response = await getBotResponse(message, appUrl);

      pushWhatsAppLog({
        id: `log-${Date.now()}-test-gemini`,
        timestamp: new Date().toISOString(),
        from: "Admin Test",
        message,
        response: response.reply,
        type: "system",
        action: response.productFound ? "test-gemini-product-reply" : "test-gemini-reply"
      });

      res.json({ success: true, ...response });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed testing Gemini" });
    }
  });

  app.post("/api/whatsapp/connect", async (req, res) => {
    try {
      await resetWhatsAppBridgeState();
      await updateWhatsAppSession({
        connected: false,
        status: "connecting",
        qrCode: "",
        phoneNumber: ""
      });
      await startWhatsAppBridge();
      const updated = await dbAPI.getWhatsAppSession("default");

      pushWhatsAppLog({
        id: `log-${Date.now()}-1`,
        timestamp: new Date().toISOString(),
        from: "Server",
        message: "Generated live WhatsApp Web QR code. Waiting for WhatsApp scan...",
        type: "system",
        action: "connection-qr-generated"
      });

      res.json(updated || { connected: false, status: "connecting", qrCode: "", phoneNumber: "" });
    } catch (err: any) {
      console.error("WhatsApp connect endpoint failure:", err);
      const fallbackSession = await dbAPI.updateWhatsAppSession("default", {
        connected: false,
        status: "disconnected",
        qrCode: "",
        phoneNumber: ""
      });

      res.status(200).json({
        ...(fallbackSession || { connected: false, status: "disconnected", qrCode: "", phoneNumber: "" }),
        message: "WhatsApp bridge could not initialize yet. Please retry in a moment."
      });
    }
  });

  // Action callback to let user "Scan" and trigger success in the sandbox UI
  app.post("/api/whatsapp/simulate-scan", async (req, res) => {
    try {
      const defaultNumber = req.body.number || "+1 (555) 728-1920";
      const session = {
        connected: true,
        status: 'connected',
        qrCode: "",
        phoneNumber: defaultNumber
      };
      const updated = await dbAPI.updateWhatsAppSession("default", session);

      whatsappLogs.push({
        id: `log-${Date.now()}-2`,
        timestamp: new Date().toISOString(),
        from: "System",
        message: `✅ WhatsApp connected successfully to active session (${defaultNumber}). Core listener registered.`,
        type: "system",
        connectedNumber: defaultNumber,
        action: "simulate-connection-open"
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed simulating scan" });
    }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    try {
      await closeWhatsAppSocket();
      await dbAPI.clearWhatsAppAuthState("default");
      await clearWhatsAppAuthDir();

      const session = {
        connected: false,
        status: 'disconnected',
        qrCode: "",
        phoneNumber: ""
      };
      const updated = await dbAPI.updateWhatsAppSession("default", session);

      whatsappLogs.push({
        id: `log-${Date.now()}-3`,
        timestamp: new Date().toISOString(),
        from: "System",
        message: "Disconnected existing WhatsApp automation bridge.",
        type: "system",
        action: "connection-closed"
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed closing session" });
    }
  });

  app.get("/api/whatsapp/logs", (req, res) => {
    res.json(whatsappLogs);
  });

  // Clear session logging history
  app.post("/api/whatsapp/logs/clear", (req, res) => {
    whatsappLogs = [
      {
        id: "log-system-reset",
        timestamp: new Date().toISOString(),
        from: "System",
        message: "Console log session buffer cleared by admin action.",
        type: "system"
      }
    ];
    res.json(whatsappLogs);
  });

  // Simulated WhatsApp customer query messaging portal
  app.post("/api/whatsapp/simulate-incoming", async (req, res) => {
    const { from, message } = req.body;
    if (!from || !message) {
      return res.status(400).json({ error: "From and Message parameters are required." });
    }

    try {
      const hostHeader = req.headers.host || DEFAULT_APP_URL;
      const appUrl = process.env.APP_URL || (hostHeader.startsWith("http") ? hostHeader : `https://${hostHeader}`);
      const session = await dbAPI.getWhatsAppSession("default");
      const connectedNumber = session?.phoneNumber || "";
      const customerNumber = normalizeCustomerNumber(from);

      const incomingLog: WhatsAppLog = {
        id: `msg-in-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: customerNumber || from,
        message,
        type: 'incoming',
        connectedNumber,
        action: "incoming-message"
      };
      pushWhatsAppLog(incomingLog);

      pushWhatsAppLog({
        id: `sys-${Date.now()}-analysing`,
        timestamp: new Date().toISOString(),
        from: "AI Engine",
        message: `Analyzing incoming text from ${customerNumber || from}. Connected WhatsApp number: ${connectedNumber || "not connected"}.`,
        type: "system",
        connectedNumber,
        action: "analyzing-message"
      });

      const aiResponse = await buildWhatsAppReply(message, customerNumber || from, appUrl, "simulator");

      const outgoingLog: WhatsAppLog = {
        id: `msg-out-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: "AI Bot (Seller)",
        message: aiResponse.reply,
        response: message,
        type: 'outgoing',
        connectedNumber,
        action: aiResponse.action || (aiResponse.productFound ? "product-reply" : "gemini-reply")
      };
      pushWhatsAppLog(outgoingLog);

      if (whatsappSocket) {
        const normalizedFrom = compactNumber(from);
        const remoteJid = normalizedFrom ? `${normalizedFrom}@s.whatsapp.net` : from;
        await whatsappSocket.sendMessage(remoteJid, { text: aiResponse.reply });
      }

      res.json({
        success: true,
        incoming: incomingLog,
        reply: aiResponse.reply,
        metadata: {
          matchedSku: aiResponse.matchedSku,
          recognizedCode: aiResponse.recognizedCode,
          productFound: aiResponse.productFound,
          action: aiResponse.action,
          connectedNumber
        }
      });

    } catch (error: any) {
      console.error("WhatsApp Incoming webhook failure:", error);
      const errLog: WhatsAppLog = {
        id: `msg-err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        from: "AI Bot (Seller)",
        message: "Pardon me, I encountered a database lookup latency. Could you please resend the model code?",
        response: message,
        type: 'outgoing',
        action: "error-fallback"
      };
      pushWhatsAppLog(errLog);
      res.json({ success: false, reply: errLog.message });
    }
  });

  // Vite framework middleware integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server booted beautifully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
