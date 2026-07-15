"use client";

import { useParams, useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";
import DetalleFixture from "@/app/components/DetalleFixture";

import DetalleHeader from "./components/DetalleHeader";
import PedidoResumenCard from "./components/PedidoResumenCard";
import PedidoChatCard from "./components/PedidoChatCard";
import SpecUpdatesCard from "./components/SpecUpdatesCard";
import CotizacionCard from "./components/CotizacionCard";
import QuoteDraftCard from "./components/QuoteDraftCard";
import QuoteVersionsCard from "./components/QuoteVersionsCard";

import { usePedidoDetalle } from "./hooks/usePedidoDetalle";
import { usePedidoFiles } from "./hooks/usePedidoFiles";
import { useSpecUpdates } from "./hooks/useSpecUpdates";
import { usePedidoChat } from "./hooks/usePedidoChat";
import { useCotizacionViva } from "./hooks/useCotizacionViva";
import EjecucionesCard from "./components/EjecucionesCard";
import RepetirPedidoModal from "./components/RepetirPedidoModal";
import { usePedidoEjecuciones } from "./hooks/usePedidoEjecuciones";
import {
  formatMoney,
  sanitizeForFirestore,
  loadPdfMake,
} from "./utils";

export default function DetallePedidoPage() {
  const { id } = useParams();
  const router = useRouter();
  const pedidoId = id as string;
  
  const { isAdmin, user } = useAuth() as any;

  const { pedido, loadingPedido } = usePedidoDetalle(pedidoId);
  const { files, filesLoading } = usePedidoFiles(pedidoId, pedido);

  const specs = useSpecUpdates(pedidoId, pedido, isAdmin, user);
  const chat = usePedidoChat(pedidoId, pedido, isAdmin, user);
  const cotizacion = useCotizacionViva(pedidoId);

  const handleCotizar = () => {
    const proyecto = encodeURIComponent(pedido?.proyecto || "");
    const titulo = encodeURIComponent(pedido?.titulo || "");
    router.push(`/cotizador?proyecto=${proyecto}&titulo=${titulo}`);
  };

  const handleGenerarPDF = async (): Promise<boolean> => {
    try {
      if (!pedidoId) throw new Error("Sin id de pedido");

      if (cotizacion.quoteLines.length === 0) {
        alert("No hay líneas en la Cotización Viva.");
        return false;
      }

      const folio = await cotizacion.nextFolio();
      const fecha = new Date();

      const filasServicios = cotizacion.quoteLines.map((ln) => {
        const d = ln.data;
        const base = d.subtotalMXN ?? 0;
        const inflado =
          base * (1 + (Number(cotizacion.draft.gananciaPct) || 0) / 100);

        const detalles = cotizacion.buildDetailsForLine(d);

        return {
          servicio: d.serviceName || d.serviceId || "Servicio",
          detalles,
          total: inflado,
        };
      });

      const pdfMake = await loadPdfMake();

      const loadLogo = async (): Promise<string | null> => {
        try {
          const logoRef = storageRef(storage, "org/logo.png");
          const url = await getDownloadURL(logoRef);
          const resp = await fetch(url);
          const blob = await resp.blob();

          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("No se pudo leer el logo"));
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(blob);
          });
        } catch {
          return null;
        }
      };

      const logoDataUrl = await loadLogo();
      const company = cotizacion.branding.companyName || "Bioana SAPI de CV";

      function sectionBlock(title: string, items: string[]) {
        return {
          table: {
            widths: ["*"],
            body: [
              [{ text: title, color: "white", margin: [6, 3, 6, 3] }],
              [{ ul: items, margin: [6, 6, 6, 6], fontSize: 8.5 }],
            ],
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? "#1ABC80" : null,
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#e5e7eb",
            vLineColor: () => "#e5e7eb",
          },
        };
      }

      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 60, 40, 70],
        content: [
          {
            columns: [
              {
                width: "*",
                stack: [
                  ...(logoDataUrl
                    ? [{ image: logoDataUrl, width: 120, margin: [0, 0, 0, 6] }]
                    : []),
                  { text: company, bold: true, fontSize: 12 },
                ],
              },
              {
                width: 220,
                table: {
                  widths: ["auto", "*"],
                  body: [
                    [{ text: "Fecha:", bold: true }, { text: fecha.toLocaleDateString() }],
                    [{ text: "Cotizado por:", bold: true }, { text: "Manuel García" }],
                  ],
                },
                layout: "noBorders",
              },
            ],
            margin: [0, 0, 0, 6],
          },
          {
            table: {
              headerRows: 1,
              widths: ["*", "*", 90],
              body: [
                [
                  { text: "Servicio", style: "th" },
                  { text: "Detalles del servicio", style: "th" },
                  { text: "Total", style: "th" },
                ],
                ...filasServicios.map((f) => [
                  { text: f.servicio, bold: true },
                  { ul: f.detalles.length ? f.detalles : ["—"] },
                  { text: formatMoney(f.total), alignment: "right" },
                ]),
              ],
            },
            margin: [0, 6, 0, 10],
          },
          {
            columns: [
              { width: "*", text: "" },
              {
                width: 260,
                table: {
                  widths: [120, 120],
                  body: [
                    [
                      { text: "Subtotal:", bold: true },
                      { text: formatMoney(cotizacion.subtotalConGananciaMXN), alignment: "right" },
                    ],
                    [
                      { text: "IVA (16%):", bold: true },
                      { text: formatMoney(cotizacion.ivaMonto), alignment: "right" },
                    ],
                    [
                      { text: "Envío:", bold: true },
                      { text: formatMoney(Number(cotizacion.draft.envio) || 0), alignment: "right" },
                    ],
                    [
                      { text: "TOTAL:", bold: true },
                      { text: formatMoney(cotizacion.totalFinal), bold: true, alignment: "right" },
                    ],
                  ],
                },
                layout: "lightHorizontalLines",
              },
            ],
            margin: [0, 0, 0, 16],
          },
          sectionBlock("General Information", [
            "Once the deposit payment is made, the order cannot be canceled either entirely or partially.",
            "Pieces with different or extra details mentioned in the quotation are not covered by the quotation.",
          ]),
          { text: " " },
          sectionBlock("Conditions", [
            "Within 3-5 business days after receiving the deposit.",
            "Delivery will be at Bioana’s offices unless shipping has been agreed upon with Bioana staff.",
          ]),
          { text: " " },
          sectionBlock("Payment", [
            "To initiate the purchasing process, a purchase order and a 50% deposit are required.",
            "The payment can be made via electronic transfer as defined with Bioana staff.",
          ]),
        ],
        styles: {
          th: { bold: true },
        },
        defaultStyle: {
          fontSize: 10,
        },
      };

      const pdfBlob: Blob = await new Promise((resolve) => {
        pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => resolve(blob));
      });

      const filePath = `cotizaciones/${pedidoId}/${folio}.pdf`;
      const fileRef = storageRef(storage, filePath);

      await uploadBytes(fileRef, pdfBlob);
      const url = await getDownloadURL(fileRef);

      const versionData = sanitizeForFirestore({
        folio,
        url,
        cliente: cotizacion.draft.cliente || "",
        atencionA: cotizacion.draft.atencionA || "",
        envio: Number(cotizacion.draft.envio) || 0,
        notas: cotizacion.draft.notas || "",
        gananciaPct: Number(cotizacion.draft.gananciaPct) || 0,
        subtotalBaseMXN: cotizacion.subtotalBaseMXN,
        gananciaMonto: cotizacion.gananciaMonto,
        subtotalConGananciaMXN: cotizacion.subtotalConGananciaMXN,
        ivaMonto: cotizacion.ivaMonto,
        total: cotizacion.totalFinal,
        createdAt: serverTimestamp(),
        lines: filasServicios,
      });

      await setDoc(
        doc(db, "pedidos", pedidoId, "quote_versions", folio),
        versionData
      );

      await cotizacion.loadVersions();

      alert(`PDF generado: ${folio}`);
      return true;
    } catch (err) {
      console.error("[handleGenerarPDF] Error:", err);
      alert("No se pudo generar el PDF.");
      return false;
    }
  };
const ejecuciones = usePedidoEjecuciones(pedidoId, pedido, user);
  if (loadingPedido || !pedido) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white/80">
        Cargando…
      </div>
    );
  }

  if (pedido.tipoPedido === "fixture") {
    return (
      <DetalleFixture
        pedido={pedido}
        pedidoId={pedidoId}
        isAdmin={isAdmin}
        user={user}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white">
     <div className="flex items-center justify-between">
  <DetalleHeader id={pedidoId} onBack={() => router.back()} />

  <button onClick={ejecuciones.abrirModal} className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 transition">
    Repetir pedido
  </button>
</div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <PedidoResumenCard
          pedido={pedido}
          files={files}
          filesLoading={filesLoading}
          isAdmin={isAdmin}
          onCotizar={handleCotizar}
        />

        <PedidoChatCard
          chatMessages={chat.chatMessages}
          newMessage={chat.newMessage}
          setNewMessage={chat.setNewMessage}
          handleSendMessage={chat.handleSendMessage}
          chatEndRef={chat.chatEndRef}
          nameByEmail={chat.nameByEmail}
          user={user}
        />
      </div>

      <SpecUpdatesCard
        specUpdates={specs.specUpdates}
        showSpecForm={specs.showSpecForm}
        setShowSpecForm={specs.setShowSpecForm}
        specDesc={specs.specDesc}
        setSpecDesc={specs.setSpecDesc}
        specFiles={specs.specFiles}
        savingSpec={specs.savingSpec}
        specInputRef={specs.specInputRef}
        addSpecFiles={specs.addSpecFiles}
        removeSpecFile={specs.removeSpecFile}
        moveSpecFile={specs.moveSpecFile}
        handleSpecSubmit={specs.handleSpecSubmit}
      />
<EjecucionesCard
  pedido={pedido}
  ejecuciones={ejecuciones.ejecuciones}
  loading={ejecuciones.loadingEjecuciones}
/>

<RepetirPedidoModal
  open={ejecuciones.showRepetirModal}
  pedido={pedido}
  nuevaFecha={ejecuciones.nuevaFecha}
  setNuevaFecha={ejecuciones.setNuevaFecha}
  notas={ejecuciones.notas}
  setNotas={ejecuciones.setNotas}
  creando={ejecuciones.creandoEjecucion}
  onClose={ejecuciones.cerrarModal}
  onConfirm={ejecuciones.crearEjecucion}
/>
      <CotizacionCard
        pedido={pedido}
        quoteMeta={cotizacion.quoteMeta}
        quoteLines={cotizacion.quoteLines}
        loadingQuote={cotizacion.loadingQuote}
        draft={cotizacion.draft}
        isGen={cotizacion.isGen}
        setIsGen={cotizacion.setIsGen}
        cargarCotizacionViva={cotizacion.cargarCotizacionViva}
        handleGenerarPDF={handleGenerarPDF}
        buildDetailsForLine={cotizacion.buildDetailsForLine}
        subtotalBaseMXN={cotizacion.subtotalBaseMXN}
        gananciaMonto={cotizacion.gananciaMonto}
        subtotalConGananciaMXN={cotizacion.subtotalConGananciaMXN}
        ivaMonto={cotizacion.ivaMonto}
        totalFinal={cotizacion.totalFinal}
      />

      <QuoteDraftCard
        draft={cotizacion.draft}
        scheduleSave={cotizacion.scheduleSave}
      />

      <QuoteVersionsCard versions={cotizacion.versions} />
    </div>
  );
}