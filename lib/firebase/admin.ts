import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function getAdminApp(): App {
  if (getApps().length) {
    return getApps()[0] as App;
  }
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey || undefined,
    }),
  });
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp(), "valett");
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}
