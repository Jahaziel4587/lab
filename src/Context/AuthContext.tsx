"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig"; // asegúrate de exportar db en tu config

// Lista legacy de admins por correo (fallback)
const adminEmails = ["jahaziel@bioana.com", "manuel@bioana.com"];

type AuthContextType = {
  user: User | null;
  logout: () => Promise<void>;
  isAdmin: boolean;
  loading: boolean;
  displayName: string; // Nombre a mostrar en menú
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: async () => {},
  isAdmin: false,
  loading: true,
  displayName: "",
});

const PUSH_TOKEN_STORAGE_KEY = "bioana_fcm_token";

async function updatePushDevice(
  currentUser: User,
  method: "POST" | "DELETE",
) {
  const pushToken = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!pushToken) return;

  const idToken = await currentUser.getIdToken();
  const response = await fetch("/api/notifications/register-device", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ token: pushToken }),
  });

  if (!response.ok) {
    throw new Error(
      method === "POST"
        ? "No se pudo asociar el dispositivo a la sesión actual"
        : "No se pudo desvincular el dispositivo de la sesión",
    );
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setDisplayName("");
        setLoading(false);
        return;
      }

      // El token pertenece al dispositivo, por lo que hay que reasignarlo
      // cada vez que cambia la cuenta autenticada en este navegador.
      updatePushDevice(u, "POST").catch((error) => {
        console.error("Error sincronizando notificaciones push:", error);
      });

      try {
        // 1) Claims (admin true/false)
        const token = await u.getIdTokenResult(true);
        const claimAdmin = Boolean(token.claims?.admin);

        // 2) Firestore: nombre y apellido
        let nameFromDb = "";
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          if (snap.exists()) {
            const data = snap.data() as any;
            const nombre = (data?.nombre || "").toString().trim();
            const apellido = (data?.apellido || "").toString().trim();
            nameFromDb = [nombre, apellido].filter(Boolean).join(" ");
          }
        } catch (_) {
          // si falla Firestore, seguimos con fallback
        }

        // 3) Fallbacks
        const legacyAdmin = adminEmails.includes(u.email || "");
        setIsAdmin(claimAdmin || legacyAdmin);

        // nombre a mostrar: Firestore > displayName de auth > correo
        const fromAuth = (u.displayName || "").trim();
        setDisplayName(nameFromDb || fromAuth || (u.email ?? ""));

      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const logout = async () => {
    const currentUser = auth.currentUser;

    try {
      if (currentUser) {
        await updatePushDevice(currentUser, "DELETE");
      }
    } catch (error) {
      console.error("Error desvinculando notificaciones push:", error);
    } finally {
      await signOut(auth);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, logout, isAdmin, loading, displayName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
