// /lib/firebaseAdmin.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  getStorage,
} from "firebase-admin/storage";

export const firebaseAdmin =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId:
        process.env.FIREBASE_PROJECT_ID,

      clientEmail:
        process.env.FIREBASE_CLIENT_EMAIL,

      privateKey:
        process.env.FIREBASE_PRIVATE_KEY
          ?.replace(/\\n/g, "\n"),
    }),

    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      "laboratorio-bioana.firebasestorage.app",
  });

export const adminAuth = getAuth();
export const adminDB = getFirestore();
export const adminMessaging =
  getMessaging(firebaseAdmin);
  export const adminStorage =
  getStorage(firebaseAdmin);