// src/firebase/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBKl6NxILB0pWVYshlRxU9c2X_OqYDD4Yk",
  authDomain: "laboratorio-bioana.firebaseapp.com",
  projectId: "laboratorio-bioana",
  storageBucket: "laboratorio-bioana.firebasestorage.app",
  messagingSenderId: "608253618122",
  appId: "1:608253618122:web:bcfbfa160c38e66f30d133",
  measurementId: "G-TPE1H687QR"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth};