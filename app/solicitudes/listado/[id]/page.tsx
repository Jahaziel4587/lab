"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import {
  db,
  storage,
} from "@/src/firebase/firebaseConfig";
import { useAuth } from "@/src/Context/AuthContext";
import DetalleFixture from "@/app/components/DetalleFixture";

import DetalleHeader from "./components/DetalleHeader";
import PedidoResumenCard from "./components/PedidoResumenCard";
import PedidoChatCard from "./components/PedidoChatCard";
import SpecUpdatesCard from "./components/SpecUpdatesCard";
import CotizacionCard from "./components/CotizacionCard";
import QuoteDraftCard from "./components/QuoteDraftCard";
import QuoteVersionsCard from "./components/QuoteVersionsCard";
import EjecucionesCard, {
  type EjecucionCotizable,
} from "./components/EjecucionesCard";
import RepetirPedidoModal from "./components/RepetirPedidoModal";

import { usePedidoDetalle } from "./hooks/usePedidoDetalle";
import { usePedidoFiles } from "./hooks/usePedidoFiles";
import { useSpecUpdates } from "./hooks/useSpecUpdates";
import { usePedidoChat } from "./hooks/usePedidoChat";
import { useCotizacionViva } from "./hooks/useCotizacionViva";
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

  /*
   * null representa la ejecución original.
   * Cuando se selecciona una repetición, guardamos aquí su información.
   */
  const [
    ejecucionSeleccionada,
    setEjecucionSeleccionada,
  ] = useState<EjecucionCotizable | null>(null);

  const { pedido, loadingPedido } =
    usePedidoDetalle(pedidoId);

  const { files, filesLoading } =
    usePedidoFiles(pedidoId, pedido);

  const specs = useSpecUpdates(
    pedidoId,
    pedido,
    isAdmin,
    user
  );

  const chat = usePedidoChat(
    pedidoId,
    pedido,
    isAdmin,
    user
  );

  const ejecuciones = usePedidoEjecuciones(
    pedidoId,
    pedido,
    user
  );

  /*
   * Próximamente modificaremos useCotizacionViva para aceptar:
   *
   * pedidoId
   * ejecucionId
   *
   * Cuando ejecucionId es null, utilizará la cotización original.
   */
  const cotizacion = useCotizacionViva(
    pedidoId,
    ejecucionSeleccionada?.id ?? null
  );

  const esCotizacionOriginal =
    !ejecucionSeleccionada?.id;

  const numeroEjecucion =
    ejecucionSeleccionada?.numero ?? 1;

  const tituloCotizacion =
    ejecucionSeleccionada?.titulo ||
    pedido?.titulo ||
    "Sin título";

  const etiquetaCotizacion = esCotizacionOriginal
    ? "Ejecución 1 · Original"
    : `Ejecución ${numeroEjecucion} · Repetición`;

  /*
   * Abre el cotizador indicando a qué ejecución debe pertenecer
   * la cotización.
   */
  const handleCotizar = () => {
    const proyecto = encodeURIComponent(
      pedido?.proyecto || ""
    );

    const titulo = encodeURIComponent(
      tituloCotizacion
    );

    const params = new URLSearchParams({
      proyecto: pedido?.proyecto || "",
      titulo: tituloCotizacion,
      pedidoId,
      numeroEjecucion: String(numeroEjecucion),
    });

    if (ejecucionSeleccionada?.id) {
      params.set(
        "ejecucionId",
        ejecucionSeleccionada.id
      );
    }

    router.push(
      `/cotizador?${params.toString()}`
    );
  };

  /*
   * Selecciona una ejecución y lleva al usuario visualmente
   * hasta la sección de cotización.
   */
  const handleSeleccionarEjecucion = (
    ejecucion: EjecucionCotizable
  ) => {
    if (ejecucion.tipo === "original") {
      setEjecucionSeleccionada(null);
    } else {
      setEjecucionSeleccionada(ejecucion);
    }

    window.setTimeout(() => {
      document
        .getElementById("cotizacion-pedido")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  };

  const handleGenerarPDF =
    async (): Promise<boolean> => {
      try {
        if (!pedidoId) {
          throw new Error("Sin id de pedido");
        }

        if (cotizacion.quoteLines.length === 0) {
          alert(
            `No hay líneas en la cotización de ${etiquetaCotizacion}.`
          );

          return false;
        }

        const folio = await cotizacion.nextFolio();
        const fecha = new Date();

        const filasServicios =
          cotizacion.quoteLines.map((linea) => {
            const data = linea.data;

            const base =
              data.subtotalMXN ?? 0;

            const inflado =
              base *
              (1 +
                (Number(
                  cotizacion.draft.gananciaPct
                ) ||
                  0) /
                  100);

            const detalles =
              cotizacion.buildDetailsForLine(data);

            return {
              servicio:
                data.serviceName ||
                data.serviceId ||
                "Servicio",

              detalles,
              total: inflado,
            };
          });

        const pdfMake = await loadPdfMake();

        const loadLogo =
          async (): Promise<string | null> => {
            try {
              const logoRef = storageRef(
                storage,
                "org/logo.png"
              );

              const url =
                await getDownloadURL(logoRef);

              const response = await fetch(url);
              const blob = await response.blob();

              return await new Promise<string>(
                (resolve, reject) => {
                  const reader = new FileReader();

                  reader.onerror = () =>
                    reject(
                      new Error(
                        "No se pudo leer el logo"
                      )
                    );

                  reader.onload = () =>
                    resolve(
                      String(reader.result)
                    );

                  reader.readAsDataURL(blob);
                }
              );
            } catch {
              return null;
            }
          };

        const logoDataUrl =
          await loadLogo();

        const company =
          cotizacion.branding.companyName ||
          "Bioana SAPI de CV";

        function sectionBlock(
          title: string,
          items: string[]
        ) {
          return {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: title,
                    color: "white",
                    margin: [6, 3, 6, 3],
                  },
                ],
                [
                  {
                    ul: items,
                    margin: [6, 6, 6, 6],
                    fontSize: 8.5,
                  },
                ],
              ],
            },

            layout: {
              fillColor: (
                rowIndex: number
              ) =>
                rowIndex === 0
                  ? "#1ABC80"
                  : null,

              hLineWidth: () => 0.6,
              vLineWidth: () => 0.6,
              hLineColor: () => "#e5e7eb",
              vLineColor: () => "#e5e7eb",
            },
          };
        }

        const docDefinition: any = {
          pageSize: "A4",

          pageMargins: [
            40,
            60,
            40,
            70,
          ],

          content: [
            {
              columns: [
                {
                  width: "*",

                  stack: [
                    ...(logoDataUrl
                      ? [
                          {
                            image: logoDataUrl,
                            width: 120,
                            margin: [
                              0,
                              0,
                              0,
                              6,
                            ],
                          },
                        ]
                      : []),

                    {
                      text: company,
                      bold: true,
                      fontSize: 12,
                    },

                    {
                      text: etiquetaCotizacion,
                      fontSize: 9,
                      color: "#555555",
                      margin: [0, 4, 0, 0],
                    },

                    {
                      text: tituloCotizacion,
                      fontSize: 9,
                      color: "#555555",
                      margin: [0, 2, 0, 0],
                    },
                  ],
                },

                {
                  width: 220,

                  table: {
                    widths: [
                      "auto",
                      "*",
                    ],

                    body: [
                      [
                        {
                          text: "Fecha:",
                          bold: true,
                        },
                        {
                          text:
                            fecha.toLocaleDateString(),
                        },
                      ],

                      [
                        {
                          text: "Cotizado por:",
                          bold: true,
                        },
                        {
                          text:
                            user?.displayName ||
                            user?.email ||
                            "Manuel García",
                        },
                      ],

                      [
                        {
                          text: "Ejecución:",
                          bold: true,
                        },
                        {
                          text:
                            etiquetaCotizacion,
                        },
                      ],
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

                widths: [
                  "*",
                  "*",
                  90,
                ],

                body: [
                  [
                    {
                      text: "Servicio",
                      style: "th",
                    },

                    {
                      text:
                        "Detalles del servicio",
                      style: "th",
                    },

                    {
                      text: "Total",
                      style: "th",
                    },
                  ],

                  ...filasServicios.map(
                    (fila) => [
                      {
                        text: fila.servicio,
                        bold: true,
                      },

                      {
                        ul: fila.detalles.length
                          ? fila.detalles
                          : ["—"],
                      },

                      {
                        text: formatMoney(
                          fila.total
                        ),
                        alignment: "right",
                      },
                    ]
                  ),
                ],
              },

              margin: [0, 6, 0, 10],
            },

            {
              columns: [
                {
                  width: "*",
                  text: "",
                },

                {
                  width: 260,

                  table: {
                    widths: [
                      120,
                      120,
                    ],

                    body: [
                      [
                        {
                          text: "Subtotal:",
                          bold: true,
                        },

                        {
                          text: formatMoney(
                            cotizacion
                              .subtotalConGananciaMXN
                          ),
                          alignment: "right",
                        },
                      ],

                      [
                        {
                          text: "IVA (16%):",
                          bold: true,
                        },

                        {
                          text: formatMoney(
                            cotizacion.ivaMonto
                          ),
                          alignment: "right",
                        },
                      ],

                      [
                        {
                          text: "Envío:",
                          bold: true,
                        },

                        {
                          text: formatMoney(
                            Number(
                              cotizacion.draft
                                .envio
                            ) || 0
                          ),
                          alignment: "right",
                        },
                      ],

                      [
                        {
                          text: "TOTAL:",
                          bold: true,
                        },

                        {
                          text: formatMoney(
                            cotizacion.totalFinal
                          ),
                          bold: true,
                          alignment: "right",
                        },
                      ],
                    ],
                  },

                  layout:
                    "lightHorizontalLines",
                },
              ],

              margin: [0, 0, 0, 16],
            },

            sectionBlock(
              "General Information",
              [
                "Once the deposit payment is made, the order cannot be canceled either entirely or partially.",
                "Pieces with different or extra details mentioned in the quotation are not covered by the quotation.",
              ]
            ),

            {
              text: " ",
            },

            sectionBlock(
              "Conditions",
              [
                "Within 3-5 business days after receiving the deposit.",
                "Delivery will be at Bioana’s offices unless shipping has been agreed upon with Bioana staff.",
              ]
            ),

            {
              text: " ",
            },

            sectionBlock(
              "Payment",
              [
                "To initiate the purchasing process, a purchase order and a 50% deposit are required.",
                "The payment can be made via electronic transfer as defined with Bioana staff.",
              ]
            ),
          ],

          styles: {
            th: {
              bold: true,
            },
          },

          defaultStyle: {
            fontSize: 10,
          },
        };

        const pdfBlob: Blob =
          await new Promise((resolve) => {
            pdfMake
              .createPdf(docDefinition)
              .getBlob((blob: Blob) =>
                resolve(blob)
              );
          });

        /*
         * Los PDF de la original y de cada ejecución se guardan
         * en carpetas separadas.
         */
        const filePath =
          ejecucionSeleccionada?.id
            ? `cotizaciones/${pedidoId}/ejecuciones/${ejecucionSeleccionada.id}/${folio}.pdf`
            : `cotizaciones/${pedidoId}/original/${folio}.pdf`;

        const fileRef = storageRef(
          storage,
          filePath
        );

        await uploadBytes(
          fileRef,
          pdfBlob
        );

        const url =
          await getDownloadURL(fileRef);

        const versionData =
          sanitizeForFirestore({
            folio,
            url,

            pedidoId,

            ejecucionId:
              ejecucionSeleccionada?.id ||
              null,

            numeroEjecucion,
            tipoEjecucion:
              esCotizacionOriginal
                ? "original"
                : "repeticion",

            etiquetaEjecucion:
              etiquetaCotizacion,

            tituloPedido:
              tituloCotizacion,

            fechaLimite:
              ejecucionSeleccionada
                ?.fechaLimite ||
              pedido?.fechaLimite ||
              "",

            fechaEntregaReal:
              ejecucionSeleccionada
                ?.fechaEntregaReal ||
              pedido?.fechaEntregaReal ||
              "",

            cliente:
              cotizacion.draft.cliente ||
              "",

            atencionA:
              cotizacion.draft
                .atencionA || "",

            envio:
              Number(
                cotizacion.draft.envio
              ) || 0,

            notas:
              cotizacion.draft.notas ||
              "",

            gananciaPct:
              Number(
                cotizacion.draft
                  .gananciaPct
              ) || 0,

            subtotalBaseMXN:
              cotizacion
                .subtotalBaseMXN,

            gananciaMonto:
              cotizacion.gananciaMonto,

            subtotalConGananciaMXN:
              cotizacion
                .subtotalConGananciaMXN,

            ivaMonto:
              cotizacion.ivaMonto,

            total:
              cotizacion.totalFinal,

            createdAt:
              serverTimestamp(),

            lines:
              filasServicios,
          });

        /*
         * La versión se guarda dentro del contexto correspondiente.
         */
        const versionRef =
          ejecucionSeleccionada?.id
            ? doc(
                db,
                "pedidos",
                pedidoId,
                "ejecuciones",
                ejecucionSeleccionada.id,
                "quote_versions",
                folio
              )
            : doc(
                db,
                "pedidos",
                pedidoId,
                "quote_versions",
                folio
              );

        await setDoc(
          versionRef,
          versionData
        );

        await cotizacion.loadVersions();

        alert(
          `PDF generado: ${folio} · ${etiquetaCotizacion}`
        );

        return true;
      } catch (error) {
        console.error(
          "[handleGenerarPDF] Error:",
          error
        );

        alert(
          "No se pudo generar el PDF."
        );

        return false;
      }
    };

  if (
    loadingPedido ||
    !pedido
  ) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 text-white/80">
        Cargando…
      </div>
    );
  }

  if (
    pedido.tipoPedido === "fixture"
  ) {
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
      <div className="flex items-center justify-between gap-4">
        <DetalleHeader
          id={pedidoId}
          onBack={() =>
            router.back()
          }
        />

        <button
          type="button"
          onClick={
            ejecuciones.abrirModal
          }
          className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 transition"
        >
          Repetir pedido
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <PedidoResumenCard
          pedido={pedido}
          files={files}
          filesLoading={
            filesLoading
          }
          isAdmin={isAdmin}
          onCotizar={handleCotizar}
        />

        <PedidoChatCard
          chatMessages={
            chat.chatMessages
          }
          newMessage={
            chat.newMessage
          }
          setNewMessage={
            chat.setNewMessage
          }
          handleSendMessage={
            chat.handleSendMessage
          }
          chatEndRef={
            chat.chatEndRef
          }
          nameByEmail={
            chat.nameByEmail
          }
          user={user}
        />
      </div>

      <SpecUpdatesCard
        specUpdates={
          specs.specUpdates
        }
        showSpecForm={
          specs.showSpecForm
        }
        setShowSpecForm={
          specs.setShowSpecForm
        }
        specDesc={
          specs.specDesc
        }
        setSpecDesc={
          specs.setSpecDesc
        }
        specFiles={
          specs.specFiles
        }
        savingSpec={
          specs.savingSpec
        }
        specInputRef={
          specs.specInputRef
        }
        addSpecFiles={
          specs.addSpecFiles
        }
        removeSpecFile={
          specs.removeSpecFile
        }
        moveSpecFile={
          specs.moveSpecFile
        }
        handleSpecSubmit={
          specs.handleSpecSubmit
        }
      />

      <EjecucionesCard
        pedido={pedido}
        ejecuciones={
          ejecuciones.ejecuciones
        }
        loading={
          ejecuciones.loadingEjecuciones
        }
        ejecucionSeleccionadaId={
          ejecucionSeleccionada?.id ??
          null
        }
        onCotizarEjecucion={
          handleSeleccionarEjecucion
        }
      />

      <RepetirPedidoModal
        open={
          ejecuciones.showRepetirModal
        }
        pedido={pedido}
        nuevaFecha={
          ejecuciones.nuevaFecha
        }
        setNuevaFecha={
          ejecuciones.setNuevaFecha
        }
        notas={
          ejecuciones.notas
        }
        setNotas={
          ejecuciones.setNotas
        }
        creando={
          ejecuciones.creandoEjecucion
        }
        onClose={
          ejecuciones.cerrarModal
        }
        onConfirm={
          ejecuciones.crearEjecucion
        }
      />

      <div
        id="cotizacion-pedido"
        className="scroll-mt-24"
      >
        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-5 py-4">
          <div className="text-xs uppercase tracking-wide text-emerald-300/70">
            Cotización seleccionada
          </div>

          <div className="mt-1 font-semibold text-white">
            {etiquetaCotizacion}
          </div>

          <div className="mt-1 text-sm text-white/60">
            {tituloCotizacion}
          </div>

          {!esCotizacionOriginal && (
            <button
              type="button"
              onClick={() =>
                setEjecucionSeleccionada(
                  null
                )
              }
              className="mt-3 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/80 hover:bg-white/[0.09] transition"
            >
              Volver a la cotización original
            </button>
          )}
        </div>

        <CotizacionCard
          pedido={pedido}
          quoteMeta={
            cotizacion.quoteMeta
          }
          quoteLines={
            cotizacion.quoteLines
          }
          loadingQuote={
            cotizacion.loadingQuote
          }
          draft={
            cotizacion.draft
          }
          isGen={
            cotizacion.isGen
          }
          setIsGen={
            cotizacion.setIsGen
          }
          cargarCotizacionViva={
            cotizacion.cargarCotizacionViva
          }
          handleGenerarPDF={
            handleGenerarPDF
          }
          buildDetailsForLine={
            cotizacion.buildDetailsForLine
          }
          subtotalBaseMXN={
            cotizacion
              .subtotalBaseMXN
          }
          gananciaMonto={
            cotizacion.gananciaMonto
          }
          subtotalConGananciaMXN={
            cotizacion
              .subtotalConGananciaMXN
          }
          ivaMonto={
            cotizacion.ivaMonto
          }
          totalFinal={
            cotizacion.totalFinal
          }
        />

        <QuoteDraftCard
          draft={
            cotizacion.draft
          }
          scheduleSave={
            cotizacion.scheduleSave
          }
        />

        <QuoteVersionsCard
          versions={
            cotizacion.versions
          }
        />
      </div>
    </div>
  );
}