"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../../src/firebase/firebaseConfig";
import { useAuth } from "../../src/Context/AuthContext";
import { FiArrowRight } from "react-icons/fi";

const proyectosImagenes: { [key: string]: string } = {
  "001.Ocumetics": "/ocumetics.jpeg",
  "002.Labella": "/Bioana.jpeg",
  "004.Solvein": "/Bioana.jpeg",
  "005.XSONXS Wound Heads": "/XSONX.png",
  "006.AGMI": "/Bioana.jpeg",
  "007.LumeNXT": "/LumeNXT.jpg",
  "008.Panter": "/Bioana.jpeg",
  "009.Recopad": "/Bioana.jpeg",
  "010.Juno": "/Bioana.jpeg",
  "013.T-EZ": "/Bioana.jpeg",
  "014.QIKCap handle": "/Bioana.jpeg",
  "015.QIKCap disposible": "/Bioana.jpeg",
  "016.Portacad shield": "/Bioana.jpeg",
  "017.JNM": "/Bioana.jpeg",
  "027.XSCRUB": "/Bioana.jpeg",
  "030.MUV": "/Bioana.jpeg",
  "E011.Orthodoxo Anclas": "/Bioana.jpeg",
  "E012.Falcon View": "/Bioana.jpeg",
  "E019.Othotek": "/Bioana.jpeg",
  "E020.Hero Cap": "/Bioana.jpeg",
  "E022.Injectable Dermis": "/Bioana.jpeg",
  "E023.DiViDiaper": "/Bioana.jpeg",
  "E025.InjectMate": "/Bioana.jpeg",
  "E026.Birchconcepts": "/Bioana.jpeg",
  "E028.Peniflex": "/Bioana.jpeg",
  "E029.Zipstich": "/Bioana.jpeg",
  "E031.Orthodoxo Cople": "/Bioana.jpeg",
  "E033.Sport Care": "/Bioana.jpeg",
  "E034.Sage guard": "/Bioana.jpeg",
  "Otro": "/otro.jpg",
};

type ProyectoMeta = {
  total: number;
  listo: number;
  pct: number; // 0-100
  lastTs: number; // último timestamp (opcional para "última actividad")
};

function toMillis(ts: any): number {
  return ts?.toMillis?.() ?? (ts?._seconds ? ts._seconds * 1000 : 0);
}

function formatRelative(ts: number) {
  if (!ts) return "Sin actividad";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

// Barra segmentada tipo mockup
function SegmentedProgress({
  pct,
  segments = 12,
}: {
  pct: number;
  segments?: number;
}) {
  const filled = Math.round((pct / 100) * segments);

  return (
    <div className="mt-4 flex items-center gap-1.5">
      {Array.from({ length: segments }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            className={[
              "h-2 w-7 rounded-full border",
              on
                ? "bg-emerald-400/90 border-emerald-300/30 shadow-[0_10px_22px_-14px_rgba(45,212,191,0.9)]"
                : "bg-white/[0.03] border-white/10",
            ].join(" ")}
          />
        );
      })}
      <span className="ml-2 text-[11px] text-white/55 tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

export default function SolicitudesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [proyectos, setProyectos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Record<string, ProyectoMeta>>({});

  const irAListado = (proyecto: string) => {
    router.push(`/solicitudes/listado?proyecto=${encodeURIComponent(proyecto)}`);
  };

 useEffect(() => {
  const run = async () => {
    if (!user?.email) return;
    setLoading(true);

    const myEmail = String(user.email);
    const pedidosCol = collection(db, "pedidos");

    // --- A) Pedidos propios (para proyectos NO compartidos) ---
    // Intento 1: campo "usuario"
    const qPropios1 = query(pedidosCol, where("usuario", "==", myEmail));
    const snap1 = await getDocs(qPropios1);

    // Si no trae nada, intento 2: "correoUsuario"
    let snapPropios = snap1;
    if (snap1.empty) {
      const qPropios2 = query(pedidosCol, where("correoUsuario", "==", myEmail));
      snapPropios = await getDocs(qPropios2);
    }

    const ownedProjects = new Set<string>();
    const sharedProjects = new Set<string>();

    // meta parcial: métricas de pedidos propios
    const metaTmp: Record<string, ProyectoMeta> = {};

    const ensure = (proyecto: string) => {
      if (!metaTmp[proyecto]) metaTmp[proyecto] = { total: 0, listo: 0, pct: 0, lastTs: 0 };
      return metaTmp[proyecto];
    };

    const consumePedido = (proyecto: string, data: any) => {
      const m = ensure(proyecto);
      m.total += 1;

      const status = String(data?.status ?? data?.estatus ?? "").toLowerCase();
      if (status === "listo") m.listo += 1;

      const ts = toMillis(data?.timestamp ?? data?.createdAt ?? data?.fecha);
      m.lastTs = Math.max(m.lastTs, ts);
    };

    // Guardamos proyectos propios + métricas propias
    snapPropios.forEach((d) => {
      const data = d.data() as DocumentData;
      const proyecto = data?.proyecto;
      if (!proyecto) return;
      ownedProjects.add(proyecto);
      consumePedido(proyecto, data);
    });

    // --- B) Proyectos compartidos ---
    const sharesSnap = await getDocs(collection(db, "proyectos_shares"));
    sharesSnap.forEach((docu) => {
      const datos = docu.data() as any;
      const arr: string[] = Array.isArray(datos?.users) ? datos.users : [];
      if (arr.includes(myEmail)) {
        sharedProjects.add(docu.id);
      }
    });

    // --- C) Para proyectos compartidos: recalculamos usando TODOS los pedidos del proyecto ---
    // Importante: si un proyecto está compartido, sobreescribimos la métrica con la de "todos"
    await Promise.all(
      Array.from(sharedProjects).map(async (proyecto) => {
        const qAll = query(pedidosCol, where("proyecto", "==", proyecto));
        const snapAll = await getDocs(qAll);

        // resetea métrica de ese proyecto y calcula con todos
        metaTmp[proyecto] = { total: 0, listo: 0, pct: 0, lastTs: 0 };

        snapAll.forEach((d) => {
          const data = d.data() as any;
          consumePedido(proyecto, data);
        });
      })
    );

    // --- D) Lista final de proyectos (unión: propios + compartidos) ---
    const all = new Set<string>([...ownedProjects, ...sharedProjects]);

    // Para que proyectos compartidos sin pedidos igual aparezcan con 0%
    all.forEach((p) => ensure(p));

    // Calcula porcentajes finales
    Object.keys(metaTmp).forEach((k) => {
      const m = metaTmp[k];
      m.pct = m.total > 0 ? Math.round((m.listo / m.total) * 100) : 0;
    });

    setMeta(metaTmp);
    setProyectos([...all].sort());
    setLoading(false);
  };

  run();
}, [user?.email]);

  const subtitle = useMemo(() => {
    if (loading) return "Cargando…";
    const totalProy = proyectos.length;
    const totPedidos = Object.values(meta).reduce((acc, m) => acc + m.total, 0);
    return `${totalProy} proyecto${totalProy === 1 ? "" : "s"} · ${totPedidos} pedido${
      totPedidos === 1 ? "" : "s"
    }`;
  }, [loading, proyectos.length, meta]);

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Tus proyectos
          </h1>
          <p className="mt-2 text-sm text-white/70">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-white/60">Cargando proyectos…</p>
      ) : proyectos.length === 0 ? (
        <p className="mt-6 text-sm text-white/60">
          No hay proyectos disponibles para tu usuario.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {proyectos.map((nombre) => {
            const m = meta[nombre] ?? { total: 0, listo: 0, pct: 0, lastTs: 0 };

            return (
              <button
                key={nombre}
                onClick={() => irAListado(nombre)}
                className="group text-left rounded-3xl border border-white/10 bg-white/[0.03]
                  backdrop-blur-xl p-6 hover:bg-white/[0.06] transition
                  shadow-[0_20px_80px_-55px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-white/90 truncate">
                      {nombre}
                    </h3>
                    <p className="mt-1 text-xs text-white/55">
                      Última actividad: {formatRelative(m.lastTs)}
                    </p>
                  </div>

                  <div
                    className="w-10 h-10 rounded-2xl border border-white/10 bg-white/[0.03]
                      flex items-center justify-center group-hover:bg-white/[0.06] transition"
                  >
                    <FiArrowRight className="text-white/80" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/75">
                    Pedidos: <span className="text-white/85 font-semibold">{m.total}</span>
                  </span>
                  <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/[0.03] text-white/75">
                    Listos: <span className="text-white/85 font-semibold">{m.listo}</span>
                  </span>
                </div>

                {/* Barra segmentada: % listo */}
                <SegmentedProgress pct={m.pct} segments={12} />

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    Porcentaje de solicitudes terminadas
                  </span>
                  <span className="text-xs text-white/70 group-hover:text-white transition">
                    Ver proyecto
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
