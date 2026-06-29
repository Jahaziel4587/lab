"use client";

import { useEffect, useState } from "react";
import { FiFileText, FiDownload, FiPaperclip } from "react-icons/fi";
import { cardClass, btnPrimary } from "../styles";
import { Info, InfoText, BooleanInfo, Block } from "../components/InfoBlocks";
import { listFixtureFolderFiles } from "../services/fixtureStorage";
import type { UploadedFile } from "../types";

function ArchivosSolicitud({
  title,
  archivos,
}: {
  title: string;
  archivos?: UploadedFile[];
}) {
  if (!archivos || archivos.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
        <FiPaperclip />
        {title}
      </div>

      <div className="grid gap-2">
        {archivos.map((file, index) => (
          <a
            key={`${file.url}-${index}`}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-emerald-100 transition hover:bg-white/[0.08]"
          >
            <span className="min-w-0 truncate">{file.name}</span>
            <FiDownload className="shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function ResumenSolicitud({
  pedido,
  pedidoId,
  faseActual,
  userDisplayName,
  generatingPdf,
  onDownloadDocx,
}: {
  pedido: any;
  pedidoId: string;
  faseActual: string;
  userDisplayName: string;
  generatingPdf: boolean;
  onDownloadDocx: () => void;
}) {
  const solicitud = pedido?.fixtureSolicitud || {};
  const necesidad = solicitud?.necesidad || {};
  const alcance = solicitud?.alcance || {};
  const inputs = solicitud?.inputs || {};
  const firmaPM = solicitud?.firmaPM || {};

  const [archivosVisuales, setArchivosVisuales] = useState<UploadedFile[]>([]);
  const [archivosTecnicos, setArchivosTecnicos] = useState<UploadedFile[]>([]);
  const [loadingArchivos, setLoadingArchivos] = useState(false);

  useEffect(() => {
    if (!pedidoId) return;

    const loadArchivos = async () => {
      try {
        setLoadingArchivos(true);

        const [visuales, tecnicos] = await Promise.all([
          listFixtureFolderFiles({
            pedidoId,
            folder: "explicacion-visual",
          }),
          listFixtureFolderFiles({
            pedidoId,
            folder: "archivos-tecnicos",
          }),
        ]);

        setArchivosVisuales(visuales);
        setArchivosTecnicos(tecnicos);
      } catch (error) {
        console.error("Error cargando archivos de solicitud:", error);
      } finally {
        setLoadingArchivos(false);
      }
    };

    loadArchivos();
  }, [pedidoId]);

  const noHayArchivos =
    !loadingArchivos &&
    archivosVisuales.length === 0 &&
    archivosTecnicos.length === 0;

  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            Resumen de solicitud formal
          </h2>
          <p className="mt-1 text-sm text-white/55">
            Esta información se considera congelada como base del proceso.
          </p>

          <button
            type="button"
            onClick={onDownloadDocx}
            disabled={generatingPdf}
            className={`${btnPrimary} mt-4`}
          >
            <FiFileText />
            {generatingPdf ? "Generando DOCX..." : "Descargar DOCX"}
          </button>
        </div>

        <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          {pedido?.status || "En proceso"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 text-sm md:grid-cols-2">
        <Info label="Título" value={pedido?.titulo} />
        <Info label="ID / Referencia" value={pedido?.io} />
        <Info label="Proyecto" value={pedido?.proyecto} />
        <Info label="Solicitante" value={pedido?.correoUsuario} />
        <Info label="Fase actual" value={faseActual} />
      </div>

      <div className="mt-6 grid gap-5">
        <Block title="1. Necesidad">
          <InfoText label="Problemática" value={necesidad?.problematica} />
          <InfoText
            label="Piezas / producto"
            value={necesidad?.piezasProducto}
          />
        </Block>

        <Block title="2. Alcance">
          <InfoText
            label="Para qué sí se usará"
            value={alcance?.descripcion}
          />
          <InfoText
            label="Proceso donde se usará"
            value={(alcance?.procesos || []).join(", ")}
          />
        </Block>

        <Block title="3. Archivos adjuntos de solicitud">
          {loadingArchivos && (
            <p className="text-sm text-white/55">Cargando archivos...</p>
          )}

          <ArchivosSolicitud
            title="Explicación visual / referencias del PM"
            archivos={archivosVisuales}
          />

          <ArchivosSolicitud
            title="Archivos técnicos / planos / documentos"
            archivos={archivosTecnicos}
          />

          {noHayArchivos && (
            <p className="text-sm text-white/55">
              No hay archivos adjuntos registrados en la solicitud formal.
            </p>
          )}
        </Block>

        <Block title="4. Inputs">
          <div className="grid gap-3 md:grid-cols-2">
            <BooleanInfo label="Cuarto limpio" value={inputs?.cuartoLimpio} />
            <BooleanInfo label="Horno" value={inputs?.horno} />
            <BooleanInfo
              label="Rigidez / dureza"
              value={inputs?.rigidezDureza}
            />
            <BooleanInfo
              label="Esterilizable"
              value={inputs?.esterilizable}
            />
            <BooleanInfo
              label="Dimensiones críticas"
              value={inputs?.dimensionesCriticas}
            />
            <BooleanInfo
              label="Reportar presupuestos al PM"
              value={inputs?.presupuestoPM}
            />
          </div>

          {inputs?.equipos?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-white/80">
                Equipos involucrados
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
                {inputs.equipos.map((eq: string, index: number) => (
                  <li key={index}>{eq}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <InfoText
              label="Temperatura máxima"
              value={inputs?.temperaturaMax}
            />
            <InfoText
              label="Detalle rigidez / dureza"
              value={inputs?.rigidezDetalle}
            />
            <InfoText label="Referencia DWG" value={inputs?.referenciaDWG} />
            <InfoText
              label="Tiempo para trabajar"
              value={inputs?.tiempoTrabajo}
            />
          </div>

          <InfoText label="Información extra" value={inputs?.extra} />
        </Block>

        <Block title="5. Criterios de éxito">
          <InfoText label="Criterios" value={solicitud?.criteriosExito} />
        </Block>

        <Block title="Firma solicitud formal">
          <Info label="Firmado por" value={userDisplayName} />
          <Info label="Fecha" value={firmaPM?.fecha} />
        </Block>
      </div>
    </section>
  );
}