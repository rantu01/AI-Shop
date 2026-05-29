import mongoose, { Schema, Document } from 'mongoose';
import { initialCategories, initialProducts } from '../src/lib/mockData.js';
import { Category, Product, Order, UserProfile } from '../src/types.js';

// --- MONGOOSE SCHEMAS & INTERFACES ---

export interface ICategoryDoc extends Document {
  name: string;
  slug: string;
  image: string;
}

export interface IProductDoc extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  images: string[];
  category: mongoose.Types.ObjectId | string;
}

export interface IOrderDoc extends Document {
  userEmail: string;
  orderNumber?: string;
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    image: string;
  }>;
  total: number;
  stripePaymentIntentId: string;
  status: string;
}

const CategorySchema = new Schema<ICategoryDoc>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  image: { type: String, required: true }
}, { timestamps: true });

const ProductSchema = new Schema<IProductDoc>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  sku: { type: String, required: true, unique: true },
  images: [{ type: String }],
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true }
}, { timestamps: true });

const OrderSchema = new Schema<IOrderDoc>({
  userEmail: { type: String, required: true, index: true },
  orderNumber: { type: String, required: false },
  items: [{
    productId: { type: String, required: true },
    name: { type: String, required: true, default: "Product Item" },
    sku: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 1 },
    image: { type: String, required: true, default: "" }
  }],
  total: { type: Number, required: true, default: 0 },
  stripePaymentIntentId: { type: String, default: "" },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' }
}, { timestamps: true });

export interface IUserProfileDoc extends Document {
  email: string;
  name: string;
  photoURL: string;
  phoneNumber: string;
  shippingAddress: string;
}

const UserProfileSchema = new Schema<IUserProfileDoc>({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  photoURL: { type: String, default: "" },
  phoneNumber: { type: String, default: "" },
  shippingAddress: { type: String, default: "" }
}, { timestamps: true });

export interface IWhatsAppSessionDoc extends Document {
  sessionId: string;
  connected: boolean;
  status: string;
  qrCode?: string;
  phoneNumber?: string;
}

const WhatsAppSessionSchema = new Schema<IWhatsAppSessionDoc>({
  sessionId: { type: String, required: true, unique: true, index: true },
  connected: { type: Boolean, required: true, default: false },
  status: { type: String, required: true, default: "disconnected" },
  qrCode: { type: String, default: "" },
  phoneNumber: { type: String, default: "" }
}, { timestamps: true });

export interface IWhatsAppAuthStateDoc extends Document {
  sessionId: string;
  files: Record<string, string>;
}

const WhatsAppAuthStateSchema = new Schema<IWhatsAppAuthStateDoc>({
  sessionId: { type: String, required: true, unique: true, index: true },
  files: { type: Schema.Types.Mixed, required: true, default: {} }
}, { timestamps: true });

export let CategoryModel: mongoose.Model<ICategoryDoc>;
export let ProductModel: mongoose.Model<IProductDoc>;
export let OrderModel: mongoose.Model<IOrderDoc>;
export let UserProfileModel: mongoose.Model<IUserProfileDoc>;
export let WhatsAppSessionModel: mongoose.Model<IWhatsAppSessionDoc>;
export let WhatsAppAuthStateModel: mongoose.Model<IWhatsAppAuthStateDoc>;


let isMongoConnected = false;

// --- DUAL DB IN-MEMORY FALLBACK STORES ---
let inMemoryCategories: Category[] = [...initialCategories];
let inMemoryProducts: Product[] = [...initialProducts];
let inMemoryOrders: Order[] = [];
let inMemoryProfiles: UserProfile[] = [];
let inMemoryWhatsAppSession: any = { connected: false, status: 'disconnected', qrCode: '', phoneNumber: '' };
let inMemoryWhatsAppAuthState: Record<string, Record<string, string>> = {};

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("⚠️ MONGODB_URI environment variable not defined. Operating in high-fidelity In-Memory Fallback Mode.");
    isMongoConnected = false;
    return false;
  }

  try {
    // Set 3 second timeout so we don't block start up indefinitely
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000
    });
    isMongoConnected = true;
    console.log("🚀 Custom MongoDB connected successfully!");

    // Initialize Models
    CategoryModel = mongoose.models.Category || mongoose.model<ICategoryDoc>('Category', CategorySchema);
    ProductModel = mongoose.models.Product || mongoose.model<IProductDoc>('Product', ProductSchema);
    OrderModel = mongoose.models.Order || mongoose.model<IOrderDoc>('Order', OrderSchema);
    UserProfileModel = mongoose.models.UserProfile || mongoose.model<IUserProfileDoc>('UserProfile', UserProfileSchema);
    WhatsAppSessionModel = mongoose.models.WhatsAppSession || mongoose.model<IWhatsAppSessionDoc>('WhatsAppSession', WhatsAppSessionSchema);
    WhatsAppAuthStateModel = mongoose.models.WhatsAppAuthState || mongoose.model<IWhatsAppAuthStateDoc>('WhatsAppAuthState', WhatsAppAuthStateSchema);

    // Try dropping stale unique indexes if they exist to prevent constraint violations
    try {
      await mongoose.connection.db?.collection('orders').dropIndex('orderNumber_1');
      console.log("Successfully dropped stale index 'orderNumber_1' from orders collection.");
    } catch (indexErr) {
      // Ignore if index doesn't exist
    }

    // Seed initial schemas if collections are empty
    const catCount = await CategoryModel.countDocuments();
    if (catCount === 0) {
      console.log("🌱 Database empty. Seeding MongoDB with initial e-commerce categories...");
      const insertedCats = await CategoryModel.insertMany(
        initialCategories.map(c => ({ name: c.name, slug: c.slug, image: c.image }))
      );

      const prodCount = await ProductModel.countDocuments();
      if (prodCount === 0) {
        console.log("🌱 Seeding MongoDB with initial electronic and apparel products...");
        // Match product categories to newly inserted mongo category ids
        const catMap = new Map<string, string>();
        insertedCats.forEach(c => {
          if (c.slug === 'electronics') catMap.set('cat-1', c._id.toString());
          if (c.slug === 'fashion-apparel') catMap.set('cat-2', c._id.toString());
          if (c.slug === 'office-stationery') catMap.set('cat-3', c._id.toString());
        });

        const seedProducts = initialProducts.map(p => ({
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          stock: p.stock,
          sku: p.sku,
          images: p.images,
          category: catMap.get(p.category) || insertedCats[0]._id.toString()
        }));

        await ProductModel.insertMany(seedProducts);
        console.log("🌱 MongoDB Data Seeding completed successfully!");
      }
    }
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection failure. Falling back to high-fidelity In-Memory Database Store:", error);
    isMongoConnected = false;
    return false;
  }
}

// Ensure first lazy initialization on query
export function getDBStatus() {
  return {
    connected: isMongoConnected,
    mode: isMongoConnected ? "MongoDB Atlas" : "In-Memory Sandbox DB",
  };
}

// --- DUAL OPERATION HANDLERS ---
export const dbAPI = {
  // Categories
  async getCategories(): Promise<Category[]> {
    if (isMongoConnected) {
      try {
        const docs = await CategoryModel.find({});
        return docs.map(d => ({
          _id: d._id.toString(),
          name: d.name,
          slug: d.slug,
          image: d.image
        }));
      } catch (err) {
        console.error("MongoDB getCategories error, falling back to in-memory:", err);
      }
    }
    return inMemoryCategories;
  },

  async addCategory(data: Partial<Category>): Promise<Category> {
    const slug = data.slug || (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newId = `cat-${Date.now()}`;
    const cleanData = {
      name: data.name || "New Category",
      slug,
      image: data.image || "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=600&q=80"
    };

    if (isMongoConnected) {
      try {
        const doc = await CategoryModel.create(cleanData);
        return {
          _id: doc._id.toString(),
          name: doc.name,
          slug: doc.slug,
          image: doc.image
        };
      } catch (err) {
        console.error("MongoDB addCategory error, creating in-memory:", err);
      }
    }

    const created: Category = { _id: newId, ...cleanData };
    inMemoryCategories.push(created);
    return created;
  },

  async updateCategory(id: string, data: Partial<Category>): Promise<Category | null> {
    if (isMongoConnected) {
      try {
        const doc = await CategoryModel.findByIdAndUpdate(id, data, { new: true });
        if (doc) {
          return {
            _id: doc._id.toString(),
            name: doc.name,
            slug: doc.slug,
            image: doc.image
          };
        }
      } catch (err) {
        console.error("MongoDB updateCategory error, updating in-memory:", err);
      }
    }

    const index = inMemoryCategories.findIndex(c => c._id === id);
    if (index !== -1) {
      const updated = { ...inMemoryCategories[index], ...data };
      inMemoryCategories[index] = updated;
      return updated;
    }
    return null;
  },

  async deleteCategory(id: string): Promise<boolean> {
    if (isMongoConnected) {
      try {
        // First delete products of this category if cascaded, or just remove the category
        await CategoryModel.findByIdAndDelete(id);
        // Clean up references
        await ProductModel.deleteMany({ category: id });
        return true;
      } catch (err) {
        console.error("MongoDB deleteCategory error:", err);
      }
    }

    inMemoryCategories = inMemoryCategories.filter(c => c._id !== id);
    // Cascade delete products in memory too
    inMemoryProducts = inMemoryProducts.filter(p => p.category !== id);
    return true;
  },

  // Products
  async getProducts(): Promise<Product[]> {
    if (isMongoConnected) {
      try {
        const docs = await ProductModel.find({}).populate('category');
        return docs.map(d => ({
          _id: d._id.toString(),
          name: d.name || d.get('name') || "Unnamed Product",
          slug: d.slug || d.get('slug') || "unnamed-product",
          description: d.description || d.get('description') || "No description provided.",
          price: typeof d.price === 'number' ? d.price : (Number(d.get('price')) || 0),
          stock: typeof d.stock === 'number' ? d.stock : (Number(d.get('stock')) || 0),
          sku: d.sku || d.get('sku') || "SKU-UNKNOWN",
          images: Array.isArray(d.images) && d.images.length > 0 ? d.images : (Array.isArray(d.get('images')) && (d.get('images') as any).length > 0 ? d.get('images') : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"]),
          category: typeof d.category === 'object' && d.category !== null ? (d.category as any)._id.toString() : (d.category ? d.category.toString() : "cat-1")
        }));
      } catch (err) {
        console.error("MongoDB getProducts error, falling back to in-memory:", err);
      }
    }
    return inMemoryProducts;
  },

  async getProductBySlug(slug: string): Promise<Product | null> {
    if (isMongoConnected) {
      try {
        const d = await ProductModel.findOne({ slug }).populate('category');
        if (d) {
          return {
            _id: d._id.toString(),
            name: d.name || d.get('name') || "Unnamed Product",
            slug: d.slug || d.get('slug') || slug,
            description: d.description || d.get('description') || "No description provided.",
            price: typeof d.price === 'number' ? d.price : (Number(d.get('price')) || 0),
            stock: typeof d.stock === 'number' ? d.stock : (Number(d.get('stock')) || 0),
            sku: d.sku || d.get('sku') || "SKU-UNKNOWN",
            images: Array.isArray(d.images) && d.images.length > 0 ? d.images : (Array.isArray(d.get('images')) && (d.get('images') as any).length > 0 ? d.get('images') : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"]),
            category: typeof d.category === 'object' && d.category !== null ? (d.category as any)._id.toString() : (d.category ? d.category.toString() : "cat-1")
          };
        }
      } catch (err) {
        console.error("MongoDB getProductBySlug error:", err);
      }
    }
    return inMemoryProducts.find(p => p.slug === slug) || null;
  },

  async getProductBySku(sku: string): Promise<Product | null> {
    if (isMongoConnected) {
      try {
        const d = await ProductModel.findOne({ sku: sku.trim().toUpperCase() });
        if (d) {
          return {
            _id: d._id.toString(),
            name: d.name || d.get('name') || "Unnamed Product",
            slug: d.slug || d.get('slug') || "unnamed-product",
            description: d.description || d.get('description') || "No description provided.",
            price: typeof d.price === 'number' ? d.price : (Number(d.get('price')) || 0),
            stock: typeof d.stock === 'number' ? d.stock : (Number(d.get('stock')) || 0),
            sku: d.sku || d.get('sku') || sku,
            images: Array.isArray(d.images) && d.images.length > 0 ? d.images : (Array.isArray(d.get('images')) && (d.get('images') as any).length > 0 ? d.get('images') : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"]),
            category: d.category ? d.category.toString() : "cat-1"
          };
        }
      } catch (err) {
        console.error("MongoDB getProductBySku error:", err);
      }
    }
    return inMemoryProducts.find(p => p.sku.trim().toUpperCase() === sku.trim().toUpperCase()) || null;
  },

  async addProduct(data: Partial<Product>): Promise<Product> {
    const slug = data.slug || (data.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const sku = (data.sku || `PROD-${Date.now()}`).toUpperCase().trim();
    const newId = `product-${Date.now()}`;
    const cleanData = {
      name: data.name || "New Product",
      slug,
      description: data.description || "Product description goes here.",
      price: Number(data.price) || 0,
      stock: Number(data.stock) || 0,
      sku,
      images: data.images && data.images.length > 0 ? data.images : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"],
      category: data.category || (inMemoryCategories[0]?._id || "cat-1")
    };

    if (isMongoConnected) {
      try {
        const doc = await ProductModel.create(cleanData);
        return {
          _id: doc._id.toString(),
          name: doc.name,
          slug: doc.slug,
          description: doc.description,
          price: doc.price,
          stock: doc.stock,
          sku: doc.sku,
          images: doc.images,
          category: doc.category.toString()
        };
      } catch (err) {
        console.error("MongoDB addProduct error, adding in-memory:", err);
      }
    }

    const created: Product = { _id: newId, ...cleanData };
    inMemoryProducts.push(created);
    return created;
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product | null> {
    const editData: any = { ...data };
    if (data.price !== undefined) editData.price = Number(data.price);
    if (data.stock !== undefined) editData.stock = Number(data.stock);
    if (data.sku !== undefined) editData.sku = data.sku.toUpperCase().trim();

    if (isMongoConnected) {
      try {
        const doc = await ProductModel.findByIdAndUpdate(id, editData, { new: true });
        if (doc) {
          return {
            _id: doc._id.toString(),
            name: doc.name,
            slug: doc.slug,
            description: doc.description,
            price: doc.price,
            stock: doc.stock,
            sku: doc.sku,
            images: doc.images,
            category: doc.category.toString()
          };
        }
      } catch (err) {
        console.error("MongoDB updateProduct error, updating in-memory:", err);
      }
    }

    const index = inMemoryProducts.findIndex(p => p._id === id);
    if (index !== -1) {
      const updated = { ...inMemoryProducts[index], ...editData };
      inMemoryProducts[index] = updated;
      return updated;
    }
    return null;
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (isMongoConnected) {
      try {
        await ProductModel.findByIdAndDelete(id);
        return true;
      } catch (err) {
        console.error("MongoDB deleteProduct error:", err);
      }
    }

    inMemoryProducts = inMemoryProducts.filter(p => p._id !== id);
    return true;
  },

  async getOrders(email: string): Promise<Order[]> {
    if (isMongoConnected && OrderModel) {
      try {
        const docs = await OrderModel.find({ userEmail: email }).sort({ createdAt: -1 });
        return docs.map(d => ({
          _id: d._id.toString(),
          userEmail: d.userEmail,
          items: d.items,
          total: d.total,
          stripePaymentIntentId: d.stripePaymentIntentId,
          status: d.status as any,
          createdAt: d.get('createdAt') ? d.get('createdAt').toISOString() : new Date().toISOString()
        }));
      } catch (err) {
        console.error("MongoDB getOrders error, using in-memory:", err);
      }
    }
    return inMemoryOrders.filter(o => o.userEmail === email);
  },

  async createOrder(data: Partial<Order & { orderNumber?: string }>): Promise<Order> {
    const newId = `order-${Date.now()}`;
    const generatedOrderNumber = "ORD-" + Date.now() + "-" + Math.floor(1000 + Math.random() * 9000);
    const cleanData = {
      userEmail: data.userEmail || "guest@test.com",
      orderNumber: data.orderNumber || generatedOrderNumber,
      items: data.items || [],
      total: data.total || 0,
      stripePaymentIntentId: data.stripePaymentIntentId || "",
      status: (data.status || "completed") as any,
      createdAt: new Date().toISOString()
    };

    if (isMongoConnected && OrderModel) {
      try {
        const doc = await OrderModel.create(cleanData);
        return {
          _id: doc._id.toString(),
          userEmail: doc.userEmail,
          items: doc.items,
          total: doc.total,
          stripePaymentIntentId: doc.stripePaymentIntentId,
          status: doc.status as any,
          createdAt: doc.get('createdAt') ? doc.get('createdAt').toISOString() : new Date().toISOString()
        };
      } catch (err) {
        console.error("MongoDB createOrder error, using in-memory fallback:", err);
      }
    }

    const created: Order = { _id: newId, ...cleanData };
    inMemoryOrders.unshift(created);
    return created;
  },

  async getUserProfile(email: string): Promise<UserProfile | null> {
    if (isMongoConnected && UserProfileModel) {
      try {
        const d = await UserProfileModel.findOne({ email });
        if (d) {
          return {
            email: d.email,
            name: d.name,
            photoURL: d.photoURL,
            phoneNumber: d.phoneNumber,
            shippingAddress: d.shippingAddress
          };
        }
      } catch (err) {
        console.error("MongoDB getUserProfile error:", err);
      }
    }
    return inMemoryProfiles.find(p => p.email === email) || null;
  },

  async updateUserProfile(email: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const cleanData = {
      email,
      name: data.name || email.split("@")[0],
      photoURL: data.photoURL || "",
      phoneNumber: data.phoneNumber || "",
      shippingAddress: data.shippingAddress || ""
    };

    if (isMongoConnected && UserProfileModel) {
      try {
        const doc = await UserProfileModel.findOneAndUpdate({ email }, cleanData, { new: true, upsert: true });
        return {
          email: doc.email,
          name: doc.name,
          photoURL: doc.photoURL,
          phoneNumber: doc.phoneNumber,
          shippingAddress: doc.shippingAddress
        };
      } catch (err) {
        console.error("MongoDB updateUserProfile error:", err);
      }
    }

    const index = inMemoryProfiles.findIndex(p => p.email === email);
    if (index !== -1) {
      const updated = { ...inMemoryProfiles[index], ...cleanData };
      inMemoryProfiles[index] = updated;
      return updated;
    } else {
      inMemoryProfiles.push(cleanData);
      return cleanData;
    }
  },

  async getWhatsAppSession(sessionId: string): Promise<any | null> {
    if (isMongoConnected && WhatsAppSessionModel) {
      try {
        const doc = await WhatsAppSessionModel.findOne({ sessionId });
        if (doc) {
          return {
            connected: doc.connected,
            status: doc.status,
            qrCode: doc.qrCode,
            phoneNumber: doc.phoneNumber
          };
        }
      } catch (err) {
        console.error("MongoDB getWhatsAppSession error:", err);
      }
    }
    return inMemoryWhatsAppSession || null;
  },

  async updateWhatsAppSession(sessionId: string, data: any): Promise<any> {
    const cleanData = {
      sessionId,
      connected: data.connected !== undefined ? data.connected : false,
      status: data.status || 'disconnected',
      qrCode: data.qrCode || "",
      phoneNumber: data.phoneNumber || ""
    };

    if (isMongoConnected && WhatsAppSessionModel) {
      try {
        const doc = await WhatsAppSessionModel.findOneAndUpdate({ sessionId }, cleanData, { new: true, upsert: true });
        return {
          connected: doc.connected,
          status: doc.status,
          qrCode: doc.qrCode,
          phoneNumber: doc.phoneNumber
        };
      } catch (err) {
        console.error("MongoDB updateWhatsAppSession error:", err);
      }
    }

    inMemoryWhatsAppSession = cleanData;
    return cleanData;
  },

  async getWhatsAppAuthState(sessionId: string): Promise<Record<string, string> | null> {
    if (isMongoConnected && WhatsAppAuthStateModel) {
      try {
        const doc = await WhatsAppAuthStateModel.findOne({ sessionId });
        if (doc?.files && typeof doc.files === 'object') {
          return doc.files as Record<string, string>;
        }
      } catch (err) {
        console.error("MongoDB getWhatsAppAuthState error:", err);
      }
    }

    return inMemoryWhatsAppAuthState[sessionId] || null;
  },

  async updateWhatsAppAuthState(sessionId: string, files: Record<string, string>): Promise<Record<string, string>> {
    const cleanFiles = Object.fromEntries(
      Object.entries(files || {}).filter(([, content]) => typeof content === 'string')
    );

    if (isMongoConnected && WhatsAppAuthStateModel) {
      try {
        const doc = await WhatsAppAuthStateModel.findOneAndUpdate(
          { sessionId },
          { sessionId, files: cleanFiles },
          { new: true, upsert: true }
        );

        return (doc?.files as Record<string, string>) || cleanFiles;
      } catch (err) {
        console.error("MongoDB updateWhatsAppAuthState error:", err);
      }
    }

    inMemoryWhatsAppAuthState[sessionId] = cleanFiles;
    return cleanFiles;
  },

  async clearWhatsAppAuthState(sessionId: string): Promise<void> {
    if (isMongoConnected && WhatsAppAuthStateModel) {
      try {
        await WhatsAppAuthStateModel.deleteOne({ sessionId });
        return;
      } catch (err) {
        console.error("MongoDB clearWhatsAppAuthState error:", err);
      }
    }

    delete inMemoryWhatsAppAuthState[sessionId];
  }
};
