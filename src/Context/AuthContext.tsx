"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

// ✅ Lista central de correos de administradores
const adminEmails = ["jahaziel@bioana.com", "manuel@bioana.com"];

type AuthContextType = {
  user: User | null;
  logout: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: async () => {},
  isAdmin: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  // ✅ Verificación de administrador centralizada
  const isAdmin = !!user && adminEmails.includes(user.email || "");

  return (
    <AuthContext.Provider value={{ user, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
