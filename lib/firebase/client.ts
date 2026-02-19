import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebase(): FirebaseApp {
  const app = getApps().length ? getApps()[0] as FirebaseApp : initializeApp(firebaseConfig);
  return app;
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functions: Functions;

export function getFirebaseAuth(): Auth {
  if (!auth) {
    app = getFirebase();
    auth = getAuth(app);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    app = app ?? getFirebase();
    db = getFirestore(app, "valett");
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    app = app ?? getFirebase();
    storage = getStorage(app);
  }
  return storage;
}

export function getFirebaseFunctions(region?: string): Functions {
  if (!functions) {
    app = app ?? getFirebase();
    functions = getFunctions(app, region ?? "europe-west1");
  }
  return functions;
}

export { getFirebase, httpsCallable };
