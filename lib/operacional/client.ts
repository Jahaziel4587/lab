"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/src/firebase/firebaseConfig";
import { DEFAULT_PROJECTS, type Project } from "./catalog";
export async function opsRequest(path: string, body?: unknown) { if (!auth.currentUser)
    throw new Error("Inicia sesión."); const r = await fetch(path, { method: body ? "POST" : "GET", cache: "no-store", headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); const data = await r.json(); if (!r.ok)
    throw new Error(data.error || "No se pudo guardar."); return data; }
export function useProjects() { const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS), [error, setError] = useState(""); useEffect(() => onAuthStateChanged(auth, u => { if (u)
    void opsRequest("/api/projects").then(d => { setProjects(d.projects); setError(""); }).catch(e => setError(e.message));
else
    setProjects(DEFAULT_PROJECTS); }), []); return { projects, error, displayProject: (label: string) => { const p = projects.find(p => p.label === label); return p ? (p.code === "OTRO" ? p.name : `${p.code}.${p.name}`) : label; } }; }
