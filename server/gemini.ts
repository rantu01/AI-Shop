import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { dbAPI } from "./db.js";

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "", // Server-side secret
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

interface BotResult {
  reply: string;
  matchedSku?: string;
  recognizedCode?: string;
  productFound?: boolean;
}

/**
 * Main E-commerce Gemini conversational AI broker.
 * Leverages the database state to answer user product queries accurately.
 * 
 * Flow explanation:
 * 1. Read all products from MongoDB (or in-memory fallback).
 * 2. Analyze incoming message to see if it specifically mentions a known SKU code (e.g. ELEC-001) or a modified pattern.
 * 3. Formulate the prompt with detailed product availability context.
 * 4. Ground Gemini's response so it acts as an "E-commerce Sales Assistant".
 */
export async function getBotResponse(incomingText: string, websiteUrl: string = "https://example.com"): Promise<BotResult> {
  const products = await dbAPI.getProducts();
  const cleanedText = incomingText.trim().toUpperCase();

  // 1. Programmatic SKU Matcher
  // Check if user literally provided a matching code (e.g. "ELEC-001") or if we can extract it from the sentence.
  let matchedProduct: any = null;
  for (const product of products) {
    const skuCode = product.sku.toUpperCase();
    // Match exact word, or check if the message contains the SKU code
    const skuRegex = new RegExp(`\\b${skuCode}\\b`, 'i');
    if (skuRegex.test(cleanedText) || cleanedText.includes(skuCode)) {
      matchedProduct = product;
      break;
    }
  }

  // 2. Programmatic SKU failure detection
  // If the message contains something that looks like a code (e.g., matching the regex XXXX-000 or similar SKU format) 
  // but does not correspond to a product in the database, prioritize the requested "Incorrect Sku" exact block error.
  const codeRegex = /\b([A-Z]{3,4})[-_ ]?(\d{3,4})\b/i;
  const matchCode = incomingText.match(codeRegex);
  let probableCodeAttempt: string | undefined = undefined;
  if (matchCode) {
    probableCodeAttempt = matchCode[0].toUpperCase();
  }

  // If a code was attempted, but it is incorrect:
  if (probableCodeAttempt && !matchedProduct) {
    // See if it aligns with some other product, otherwise it's definitely incorrect SKU
    const isActuallySkuAttempt = products.some(p => p.sku.substring(0, 3) === probableCodeAttempt?.substring(0, 3));
    if (isActuallySkuAttempt || probableCodeAttempt.includes('-')) {
      return {
        reply: `Sorry, this product code "${probableCodeAttempt}" is incorrect. Please visit our website [Website Link](${websiteUrl}) to view all our available products.`,
        recognizedCode: probableCodeAttempt,
        productFound: false
      };
    }
  }

  // If Gemini API is not configured, fallback to a friendly mocked AI dialog responder so they can see full functionality
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is not configured on the server. Using pre-programmed simulated AI Sales Bot response.");
    if (matchedProduct) {
      const isAvailable = matchedProduct.stock > 0;
      const lowerText = incomingText.toLowerCase();
      const isStockQuery = lowerText.includes("how many") || lowerText.includes("left") || lowerText.includes("stock") || lowerText.includes("quantity") || lowerText.includes("available");
      
      if (isStockQuery) {
        if (isAvailable) {
          return {
            reply: `🤖 *Simulated Sales Bot:* We currently have ${matchedProduct.stock} items left in stock of ${matchedProduct.name}.`,
            matchedSku: matchedProduct.sku,
            productFound: true
          };
        } else {
          // Find alternative products from database
          const activeAlternatives = products.filter(p => p.sku !== matchedProduct.sku && p.stock > 0);
          const altsText = activeAlternatives.length > 0 
            ? `However, we suggest checking out these in-stock alternatives:\n` + activeAlternatives.slice(0, 2).map(p => `- **${p.name}** (Code: ${p.sku}) for $${p.price}`).join("\n")
            : `Please feel free to check our website for future updates.`;
          return {
            reply: `🤖 *Simulated Sales Bot:* Sorry, "${matchedProduct.name}" is currently out of stock. ${altsText}\nYou can also explore other items on our website [Website Link](${websiteUrl}).`,
            matchedSku: matchedProduct.sku,
            productFound: true
          };
        }
      }

      const availabilityText = isAvailable ? `Yes, it is available! We currently have ${matchedProduct.stock} units in stock.` : "Sorry, this item is currently out of stock.";
      return {
        reply: `🤖 *Simulated Sales Bot:* Hi! Yes, I found the product code **${matchedProduct.sku}** in our catalog.\n\n* **Name:** ${matchedProduct.name}\n* **Price:** $${matchedProduct.price}\n* **Availability:** ${availabilityText}\n\n* **Description:** ${matchedProduct.description}\n\nWould you like me to help you complete an order? You can tap our WhatsApp chat link to place your order directly.`,
        matchedSku: matchedProduct.sku,
        productFound: true
      };
    } else if (probableCodeAttempt) {
      return {
        reply: `Sorry, this product code matches our format but is incorrect. Please visit our website [Website Link](${websiteUrl}) to view all our available products.`,
        recognizedCode: probableCodeAttempt,
        productFound: false
      };
    } else {
      return {
        reply: `🤖 *Simulated Sales Bot:* Welcome to our automated e-commerce catalog assistant! I notice you are asking about our products.\n\nCould you please provide the specific **Product Code (SKU)** of the item you are interested in? (For example: **ELEC-001** or **ELEC-002** or **FASH-001**). You can find these product codes displayed on our e-commerce store next to each item details page.`,
        productFound: false
      };
    }
  }

  // 3. Dynamic Gemini API Grounding Prompt Assembly
  try {
    const productsDetailsContext = products.map(p => 
      `- Name: ${p.name}\n  SKU/Product Code: ${p.sku}\n  Price: $${p.price}\n  Stock: ${p.stock} units\n  Description: ${p.description}\n  Status: ${p.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK'}`
    ).join("\n\n");

    let promptContents = "";
    let systemInstruction = `You are a professional E-commerce Sales Assistant Bot for our webstore.
Your job is to assist customers politely, dynamically, and clearly based strictly on the current catalog.

CATALOG STATUS:
${productsDetailsContext}

WEBSITE LINK:
${websiteUrl}

BUSINESS DIRECTIVES (FOLLOW STRICTLY):
1. If the user asks general queries ("is this product available?", "hi what do you sell?", "available?", "do you have headphones?"), POLITELY and warmly greet them and ask them for the **Product Code / SKU**. Give an example of a valid SKU from our catalog (e.g. ELEC-001) so they understand.
2. If the user provided a correct SKU match: (State of matchedProduct is already detected by backend as: ${matchedProduct ? matchedProduct.name : 'None'}).
   - If the user is checking stock/inventory query (e.g. "how many left", "how many items are left in stock", "is it in stock", "stock quantity"):
     a) If the product is IN STOCK, you MUST reply: "We currently have [X] items left in stock of [Product Name]." where [X] is replaced with the exact active stock number and [Product Name] is replaced with the exact product name in our records.
     b) If the product is OUT OF STOCK, politely inform them it is out of stock, and proactively suggest 1 or 2 alternative items from our active catalog that are currently in stock, or direct them to explore the webstore at ${websiteUrl}.
   - Otherwise, reply details conversationally including the name of product, price, description, and availability. Emphasize stock urgency.
3. If they wrote a product code or SKU that doesn't match any of the codes in the CATALOG above, you MUST respond EXACTLY with this phrasing (do not wrap in other greeting filler, but you can convert into rich markdown):
   "Sorry, this product code is incorrect. Please visit our website [Website Link](${websiteUrl}) to view all our available products."
`;

    if (matchedProduct) {
      const lowerIn = incomingText.toLowerCase();
      const wantsStock = lowerIn.includes("how many") || lowerIn.includes("left") || lowerIn.includes("stock") || lowerIn.includes("quantity") || lowerIn.includes("available");
      
      promptContents = `The user is specifically inquiring with the correct Product SKU code "${matchedProduct.sku}".
We loaded this data from the MongoDB:
- Name: ${matchedProduct.name}
- Price: $${matchedProduct.price}
- Stock Availability: ${matchedProduct.stock} units
- Description: ${matchedProduct.description}

Is user asking about stock quantites/left overs? ${wantsStock ? 'YES' : 'NO'}.
If YES, make sure you write EXACTLY: "We currently have ${matchedProduct.stock} items left in stock of ${matchedProduct.name}." if it's in stock. If out of stock, politely state this and recommend in-stock alternatives from our CATALOG.
Otherwise, write a helpful e-commerce sales assistant response highlighting the product info. Keep it concise. Ensure you mention SKU code: ${matchedProduct.sku}.`;
    } else {
      promptContents = `User says: "${incomingText}".
Act as instructed. If their message can't be resolved with a specific product, prompt politely for the Product Code. If they entered a wrong code, output the correct wrong code reply.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptContents,
      config: {
        systemInstruction,
        temperature: 0.3 // Low temperature for high consistency and adherence to guidelines
      }
    });

    const reply = response.text || "I was unable to understand your request. Could you please provide the SKU product code?";
    
    return {
      reply,
      matchedSku: matchedProduct?.sku,
      recognizedCode: probableCodeAttempt,
      productFound: !!matchedProduct
    };

  } catch (error) {
    console.error("Gemini API execution error:", error);
    // Safe user fallback response
    if (matchedProduct) {
      return {
        reply: `Hello! Yes, the product code **${matchedProduct.sku}** is available! The "${matchedProduct.name}" costs $${matchedProduct.price} with ${matchedProduct.stock} units in stock. \n\nDescription: ${matchedProduct.description}`,
        matchedSku: matchedProduct.sku,
        productFound: true
      };
    }
    return {
      reply: "Thank you for reaching out. Please provide the SKU code or product code of the item you want to check, and I will instantly search our database.",
      productFound: false
    };
  }
}
