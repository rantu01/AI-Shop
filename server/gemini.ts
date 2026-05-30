import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { dbAPI } from "./db.js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});

interface BotResult {
  reply: string;
  matchedSku?: string;
  recognizedCode?: string;
  productFound?: boolean;
}

const DEFAULT_WEBSITE_URL = "https://ai-shop.rantumondal.codes/";
const PRODUCT_CATEGORIES = [
  "Shera Sawda Exclusive",
  "Shera Sawda Fasion",
  "Shera Sawda ",
];

function buildSearchHelpReply(sampleSku: string, websiteUrl: string): string {
  const categoryList = PRODUCT_CATEGORIES.map((category, index) => `${index + 1}. ${category}`).join("\n");

  return `হ্যালো! আমাদের ** সেরা সওদা **  ওয়েবসাইটে আপনাকে স্বাগতম। পণ্য খুঁজতে নিচের যেকোনো একটি ভাবে মেসেজ করুন:

**Available product categories:**
${categoryList}

**কীভাবে লিখবেন:**
- "${sampleSku} এর দাম কত?"
- "${sampleSku} স্টকে আছে কি?"
- "Show me Shera Sawda Exclusive products"
- "I want to explore products"

আপনি শুধু নাম, category, SKU, বা product code লিখলেই আমরা relevant product দেখাব।
বা
type **explore** to see all products.


**Browse here:** ${websiteUrl}
`
;
}

function isGeminiUnavailableError(error: any) {
  const message = String(error?.message || error || "").toLowerCase();
  const statusCode = Number(error?.status || error?.code || 0);
  return (
    message.includes("expired") ||
    message.includes("quota") ||
    message.includes("billing") ||
    message.includes("credential") ||
    message.includes("unauthorized") ||
    message.includes("unauthenticated") ||
    message.includes("authentication") ||
    message.includes("permission") ||
    message.includes("api key") ||
    message.includes("api-key") ||
    message.includes("token") ||
    message.includes("access denied") ||
    message.includes("resource exhausted") ||
    message.includes("exceeded") ||
    message.includes("invalid api key") ||
    statusCode === 401 ||
    statusCode === 403 ||
    statusCode === 429
  );
}

export async function getBotResponse(incomingText: string, websiteUrl: string = DEFAULT_WEBSITE_URL): Promise<BotResult> {
  const products = await dbAPI.getProducts();
  const cleanedText = incomingText.trim().toLowerCase();
  const sampleSku = products.length > 0 ? products[0].sku : "ELEC-001";
  const searchHelpReply = buildSearchHelpReply(sampleSku, websiteUrl);

  const generalGreetings = [
    "hi",
    "hello",
    "hey",
    "hola",
    "asalamu alaikum",
    "assalamualaikum",
    "স্ল্যাম",
    "হাই",
    "হ্যালো",
    "কেমন আছেন",
    "ভালো আছেন",
    "available",
    "available?",
    "আছে",
    "আছে?",
    "কি জানতে চান",
    "help",
    "info"
  ];

  const productIntentKeywords = [
    "product",
    "item",
    "sku",
    "code",
    "price",
    "stock",
    "available",
    "availability",
    "browse",
    "search",
    "explore",
    "category",
    "categories",
    "shop"
  ];

  if (cleanedText.length <= 3 || generalGreetings.includes(cleanedText)) {
    return {
      reply: searchHelpReply,
      productFound: false
    };
  }

  let matchedProduct: any = null;
  const upperCleanedText = cleanedText.toUpperCase();

  for (const product of products) {
    const skuCode = product.sku.toUpperCase();
    const skuRegex = new RegExp(`\\b${skuCode}\\b`, "i");
    if (skuRegex.test(upperCleanedText) || upperCleanedText.includes(skuCode)) {
      matchedProduct = product;
      break;
    }
  }

  const codeRegex = /\b([A-Z]{3,4})[-_ ]?(\d{3,4})\b/i;
  const matchCode = incomingText.match(codeRegex);
  let probableCodeAttempt: string | undefined = undefined;
  if (matchCode) {
    probableCodeAttempt = matchCode[0].toUpperCase();
  }

  const hasProductIntent =
    !!matchedProduct ||
    !!probableCodeAttempt ||
    productIntentKeywords.some(keyword => cleanedText.includes(keyword));

  if (!hasProductIntent) {
    return {
      reply: searchHelpReply,
      productFound: false
    };
  }

  if (probableCodeAttempt && !matchedProduct) {
    const isActuallySkuAttempt = products.some(p => p.sku.substring(0, 3) === probableCodeAttempt?.substring(0, 3));
    if (isActuallySkuAttempt || probableCodeAttempt.includes("-")) {
      return {
        reply: `Sorry, this product code "${probableCodeAttempt}" is incorrect. Please visit our website [Website Link](${websiteUrl}) to view all our available products.`,
        recognizedCode: probableCodeAttempt,
        productFound: false
      };
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is not configured. Using System Auto-Response.");
    if (matchedProduct) {
      return {
        reply: `Hello! Yes, the product code **${matchedProduct.sku}** is available! The "${matchedProduct.name}" costs $${matchedProduct.price}.`,
        matchedSku: matchedProduct.sku,
        productFound: true
      };
    }

    return {
      reply: searchHelpReply,
      productFound: false
    };
  }

  try {
    const productsDetailsContext = products
      .map(
        p =>
          `- Name: ${p.name}\n  SKU/Product Code: ${p.sku}\n  Price: $${p.price}\n  Stock: ${p.stock} units\n  Description: ${p.description}\n  Status: ${p.stock > 0 ? "AVAILABLE" : "OUT_OF_STOCK"}`
      )
      .join("\n\n");

    let promptContents = "";
    const systemInstruction = `You are a professional E-commerce Sales Assistant Bot for our webstore.
Your job is to assist customers politely, dynamically, and clearly based strictly on the current catalog.

CATALOG STATUS:
${productsDetailsContext}

WEBSITE LINK:
${websiteUrl}

BUSINESS DIRECTIVES (FOLLOW STRICTLY):
1. If the user sends a general greeting or query without a valid SKU, warmly greet them in Bengali and explicitly guide them on HOW to ask questions using examples:
"${searchHelpReply}"

2. If the user provided a correct SKU match:
   - If the user is checking stock/inventory query:
     a) If the product is IN STOCK, you MUST reply: "We currently have [X] items left in stock of [Product Name]." where [X] is replaced with the exact active stock number and [Product Name] is replaced with the exact product name.
     b) If the product is OUT OF STOCK, politely inform them it is out of stock, and suggest alternatives.
   - Otherwise, reply details conversationally including price and description.
3. If they wrote a product code or SKU that doesn't match any of the codes in the CATALOG, you MUST respond EXACTLY with:
   "Sorry, this product code is incorrect. Please visit our website [Website Link](${websiteUrl}) to view all our available products."
`;

    if (matchedProduct) {
      const wantsStock =
        cleanedText.includes("how many") ||
        cleanedText.includes("left") ||
        cleanedText.includes("stock") ||
        cleanedText.includes("quantity") ||
        cleanedText.includes("available");

      promptContents = `The user is specifically inquiring with the correct Product SKU code "${matchedProduct.sku}".
We loaded this data from the MongoDB:
- Name: ${matchedProduct.name}
- Price: $${matchedProduct.price}
- Stock Availability: ${matchedProduct.stock} units

Is user asking about stock quantities? ${wantsStock ? "YES" : "NO"}.
If YES, make sure you write EXACTLY: "We currently have ${matchedProduct.stock} items left in stock of ${matchedProduct.name}." if it's in stock.
Otherwise, write a helpful response highlighting the product info. Ensure you mention SKU code: ${matchedProduct.sku}.`;
    } else {
      promptContents = `User says: "${incomingText}". Act as instructed by system instructions.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptContents,
      config: {
        systemInstruction,
        temperature: 0.3
      }
    });
    const reply = response.text || searchHelpReply;

    return {
      reply,
      matchedSku: matchedProduct?.sku,
      recognizedCode: probableCodeAttempt,
      productFound: !!matchedProduct
    };
  } catch (error) {
    console.error("Gemini API execution error:", error);

    if (isGeminiUnavailableError(error)) {
      return {
        reply: searchHelpReply,
        productFound: false
      };
    }

    if (matchedProduct) {
      return {
        reply: `Hello! Yes, the product code **${matchedProduct.sku}** is available! The "${matchedProduct.name}" costs $${matchedProduct.price} with ${matchedProduct.stock} units in stock.`,
        matchedSku: matchedProduct.sku,
        productFound: true
      };
    }

    return {
      reply: searchHelpReply,
      productFound: false
    };
  }
}