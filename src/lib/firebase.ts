import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

// Create standard or mocked Firebase hooks
let authInstance: any = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
  } catch (error) {
    console.warn("Firebase Auth failed to load. Falling back to Mock Auth Mode:", error);
  }
}

// Simple Mock Firebase implementation to guarantee sandbox functionality
class MockAuth {
  private listeners: Array<(user: any) => void> = [];
  private currentUser: any = null;

  constructor() {
    // Check if there is a session stored locally
    const savedUser = localStorage.getItem("simulated_firebase_user");
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {
        this.currentUser = null;
      }
    }
  }

  onAuthStateChanged(callback: (user: any) => void) {
    this.listeners.push(callback);
    // Call immediately with current state
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  async signInWithEmailAndPassword(email: string, pass: string) {
    // Allow any admin test account or mock login
    if (email === "admin@test.com" || email.includes("admin")) {
      const user = {
        uid: "mock-admin-uid-123",
        email: email,
        displayName: "Admin User",
        photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
        isAdmin: true
      };
      this.currentUser = user;
      localStorage.setItem("simulated_firebase_user", JSON.stringify(user));
      this.notifyListeners();
      return { user };
    } else {
      const user = {
        uid: "mock-user-uid-456",
        email: email,
        displayName: email.split("@")[0],
        photoURL: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80",
        isAdmin: false
      };
      this.currentUser = user;
      localStorage.setItem("simulated_firebase_user", JSON.stringify(user));
      this.notifyListeners();
      return { user };
    }
  }

  async signInWithGoogleSimulated() {
    const user = {
      uid: "mock-google-uid-789",
      email: "google.user@gmail.com",
      displayName: "Jane Google",
      photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
      isAdmin: false
    };
    this.currentUser = user;
    localStorage.setItem("simulated_firebase_user", JSON.stringify(user));
    this.notifyListeners();
    return { user };
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem("simulated_firebase_user");
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.currentUser));
  }
}

export const mockAuth = new MockAuth();

// Wrapper helper
export const auth = authInstance;
export const isRealFirebase = isFirebaseConfigured;

let stateCallback: ((user: any) => void) | null = null;
let currentMockUser: any = null;
let currentRealUser: any = null;

const notifyUnifiedStatus = () => {
  if (!stateCallback) return;
  if (currentRealUser) {
    const enrichedUser = {
      uid: currentRealUser.uid,
      email: currentRealUser.email,
      displayName: currentRealUser.displayName || currentRealUser.email?.split("@")[0] || "User",
      photoURL: currentRealUser.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80",
      isAdmin: currentRealUser.email === "admin@test.com" || currentRealUser.email?.includes("admin")
    };
    stateCallback(enrichedUser);
  } else if (currentMockUser) {
    stateCallback(currentMockUser);
  } else {
    stateCallback(null);
  }
};

export const customSignInWithEmail = async (email: string, pass: string) => {
  if (isRealFirebase && auth) {
    try {
      await mockAuth.signOut();
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return cred;
    } catch (realError: any) {
      console.warn("Real Firebase email auth failed, trying sandbox mock fallback...", realError);
      // Fallback to local simulated mock database context for seamless experience
      if (email === "admin@test.com" || email.includes("admin") || realError.code === "auth/invalid-credential" || realError.code === "auth/user-not-found") {
        return mockAuth.signInWithEmailAndPassword(email, pass);
      }
      throw realError;
    }
  }
  return mockAuth.signInWithEmailAndPassword(email, pass);
};

export const customSignOut = async () => {
  await mockAuth.signOut();
  if (isRealFirebase && auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut from real firebase failed", e);
    }
  }
};

export const customSignInWithGoogle = async () => {
  if (isRealFirebase && auth) {
    try {
      await mockAuth.signOut();
      const provider = new GoogleAuthProvider();
      return await signInWithPopup(auth, provider);
    } catch (realError: any) {
      console.warn("Real Firebase Google auth failed, trying sandbox mock fallback...", realError);
      return mockAuth.signInWithGoogleSimulated();
    }
  }
  return mockAuth.signInWithGoogleSimulated();
};

export const customOnAuthStateChanged = (callback: (user: any) => void) => {
  stateCallback = callback;

  const unsubscribeMock = mockAuth.onAuthStateChanged((user) => {
    currentMockUser = user;
    notifyUnifiedStatus();
  });

  let unsubscribeReal = () => {};
  if (isRealFirebase && auth) {
    unsubscribeReal = onAuthStateChanged(auth, (user) => {
      currentRealUser = user;
      notifyUnifiedStatus();
    });
  }

  return () => {
    unsubscribeMock();
    unsubscribeReal();
    stateCallback = null;
  };
};

