"use client";

import { useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  FolderKanban,
  LoaderCircle,
} from "lucide-react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import AnomalyList from
  "../anormalidades/components/AnomalyList";
import AnomalyReportForm from
  "../anormalidades/components/AnomalyReportForm";
import AnomalyThread from
  "../anormalidades/components/AnomalyThread";
import { useAnomalies } from
  "../anormalidades/hooks/useAnomalies";
import { useAnomalyThread } from
  "../anormalidades/hooks/useAnomalyThread";
import type { InspectionAnomaly } from
  "../anormalidades/types";
import { buildAnomalyContext } from
  "../anormalidades/utils";

import CatalogList, {
  type CatalogListItem,
} from "../components/CatalogList";
import FindingTypeSelector from
  "../components/FindingTypeSelector";
import InspectionOptionCard from
  "../components/InspectionOptionCard";
import ProcessComponentList from
  "../components/ProcessComponentList";

import { useInspectionCatalog } from
  "../hooks/useInspectionCatalog";
import { useProcessComponents } from
  "../hooks/useProcessComponents";

import {
  inspectionBackButtonClass,
  inspectionPageClass,
  inspectionPanelClass,
} from "../styles";

import {
  isInspectionType,
  type InspectionCatalogScope,
} from "../types";

export default function InspectionTypePage() {
  const router = useRouter();
  const params =
    useParams<{ tipo: string }>();
  const searchParams =
    useSearchParams();

  const tipo = params.tipo;
  const origin =
    searchParams.get("origen");
  const projectId =
    searchParams.get("proyecto");
  const wiId =
    searchParams.get("wi");
  const processComponentId =
    searchParams.get("componente");
  const findingType =
    searchParams.get("hallazgo");

  const anomalyAction =
    searchParams.get("accion");
  const anomalyId =
    searchParams.get("anomalia");
  const reportSent =
    searchParams.get("enviado") === "1";

  const validInspectionType =
    isInspectionType(tipo);
  const isEntrada =
    tipo === "entrada";

  const shouldLoadProjects =
    validInspectionType &&
    (
      tipo === "proceso" ||
      origin === "proyectos" ||
      Boolean(projectId)
    );

  const projectsCatalog =
    useInspectionCatalog({
      scope: "projects",
      enabled: shouldLoadProjects,
    });

  const workInstructionScope:
    InspectionCatalogScope | null =
      (() => {
        if (!validInspectionType) {
          return null;
        }

        if (
          tipo === "entrada" &&
          origin === "mts"
        ) {
          return "mts";
        }

        if (
          tipo === "entrada" &&
          projectId
        ) {
          return "incoming";
        }

        if (
          tipo === "proceso" &&
          projectId
        ) {
          return "process";
        }

        return null;
      })();

  const workInstructionsCatalog =
    useInspectionCatalog({
      scope: workInstructionScope,
      projectId,
      enabled:
        workInstructionScope !== null,
    });

  const projectItems:
    CatalogListItem[] =
      projectsCatalog.projects.map(
        (project) => ({
          id: project.id,
          title: project.title,
          description:
            "Proyecto disponible en el DMR",
        }),
      );

  const workInstructionItems:
    CatalogListItem[] =
      workInstructionsCatalog
        .workInstructions
        .map((workInstruction) => ({
          id: workInstruction.id,
          title: workInstruction.title,
          description:
            isEntrada
              ? "Componente de inspección de entrada"
              : "Work instruction de proceso",
        }));

  const selectedProject =
    projectsCatalog.projects.find(
      (project) =>
        project.id === projectId,
    );

  const selectedWi =
    workInstructionsCatalog
      .workInstructions
      .find(
        (workInstruction) =>
          workInstruction.id === wiId,
      );

  const processComponentsState =
    useProcessComponents({
      projectId,
      projectName:
        selectedProject?.title,
      wiCode:
        selectedWi?.id,
      wiTitle:
        selectedWi?.title,
      enabled:
        validInspectionType &&
        !isEntrada &&
        Boolean(
          projectId &&
          selectedProject &&
          selectedWi,
        ),
    });

  const processComponents:
    CatalogListItem[] =
      processComponentsState
        .components
        .map((component) => ({
          id: component.id,
          title: component.title,
          description:
            "Componente registrado manualmente",
        }));

  const selectedProcessComponent =
    processComponents.find(
      (component) =>
        component.id ===
        processComponentId,
    );

  /*
   * Crea una identidad estable para las
   * anormalidades del elemento seleccionado.
   */
  const anomalyContext =
  useMemo(
    () =>
      buildAnomalyContext({
        isEntrada,
        origin,
        projectId,
        projectName:
          selectedProject?.title,
        wiCode:
          selectedWi?.id,
        wiTitle:
          selectedWi?.title,
        processComponentId,
        processComponentTitle:
          selectedProcessComponent?.title,
      }),
    [
      isEntrada,
      origin,
      projectId,
      selectedProject?.title,
      selectedWi?.id,
      selectedWi?.title,
      processComponentId,
      selectedProcessComponent?.title,
    ],
  );
  const anomaliesState =
    useAnomalies({
      context: anomalyContext,
      enabled:
        validInspectionType &&
        findingType === "anormalidad" &&
        Boolean(anomalyContext),
    });

  const selectedAnomaly =
    anomaliesState.anomalies.find(
      (anomaly) =>
        anomaly.id === anomalyId,
    );

  const anomalyThreadState =
    useAnomalyThread({
      scopeKey:
        anomalyContext?.scopeKey,
      anomalyId,
      enabled:
        validInspectionType &&
        findingType ===
          "anormalidad" &&
        Boolean(
          anomalyContext &&
          anomalyId,
        ),
    });

  /*
   * Todos los hooks están antes de esta
   * validación para respetar las reglas
   * de React.
   */
  if (!validInspectionType) {
    return (
      <main className={inspectionPageClass}>
        <section
          className={inspectionPanelClass}
        >
          <h1 className="text-2xl font-semibold">
            Tipo de inspección no válido
          </h1>

          <button
            type="button"
            onClick={() =>
              router.replace(
                "/inspecciones",
              )
            }
            className={
              `${inspectionBackButtonClass} mt-6`
            }
          >
            <ArrowLeft size={17} />
            Regresar a inspecciones
          </button>
        </section>
      </main>
    );
  }

  const buildCurrentQuery = ({
    includeFinding = true,
  }: {
    includeFinding?: boolean;
  } = {}) => {
    const query =
      new URLSearchParams();

    if (origin) {
      query.set(
        "origen",
        origin,
      );
    }

    if (projectId) {
      query.set(
        "proyecto",
        projectId,
      );
    }

    if (wiId) {
      query.set(
        "wi",
        wiId,
      );
    }

    if (processComponentId) {
      query.set(
        "componente",
        processComponentId,
      );
    }

    if (
      includeFinding &&
      findingType
    ) {
      query.set(
        "hallazgo",
        findingType,
      );
    }

    return query;
  };

  const goBack = () => {
    /*
     * Chat o detalle de una anormalidad
     * → lista de anormalidades.
     */
    if (anomalyId) {
      const query =
        buildCurrentQuery();

      router.push(
        `/inspecciones/${tipo}` +
          `?${query.toString()}`,
      );
      return;
    }

    /*
     * Formulario o confirmación
     * → lista de anormalidades si existen.
     *
     * Si todavía no hay títulos, regresa a
     * la selección del tipo de hallazgo.
     */
    if (
      findingType === "anormalidad" &&
      (
        anomalyAction ||
        reportSent
      )
    ) {
      if (
        anomaliesState.hasAnomalies
      ) {
        const query =
          buildCurrentQuery();

        router.push(
          `/inspecciones/${tipo}` +
            `?${query.toString()}`,
        );
      } else {
        const query =
          buildCurrentQuery({
            includeFinding: false,
          });

        router.push(
          `/inspecciones/${tipo}` +
            `?${query.toString()}`,
        );
      }

      return;
    }

    /*
     * Hallazgo → selección del tipo
     * de hallazgo.
     */
    if (findingType) {
      const query =
        buildCurrentQuery({
          includeFinding: false,
        });

      router.push(
        `/inspecciones/${tipo}` +
          `?${query.toString()}`,
      );
      return;
    }

    /*
     * Proceso:
     * componente → lista de componentes.
     */
    if (
      !isEntrada &&
      processComponentId &&
      projectId &&
      wiId
    ) {
      const query =
        new URLSearchParams({
          proyecto: projectId,
          wi: wiId,
        });

      router.push(
        "/inspecciones/proceso" +
          `?${query.toString()}`,
      );
      return;
    }

    /*
     * Entrada MTS:
     * componente → lista MTS.
     */
    if (
      isEntrada &&
      wiId &&
      origin === "mts"
    ) {
      router.push(
        "/inspecciones/entrada" +
          "?origen=mts",
      );
      return;
    }

    /*
     * Entrada:
     * componente → lista del proyecto.
     *
     * Proceso:
     * WI → lista de WI.
     */
    if (
      wiId &&
      projectId
    ) {
      const query =
        new URLSearchParams();

      if (origin) {
        query.set(
          "origen",
          origin,
        );
      }

      query.set(
        "proyecto",
        projectId,
      );

      router.push(
        `/inspecciones/${tipo}` +
          `?${query.toString()}`,
      );
      return;
    }

    /*
     * Proyecto → lista de proyectos.
     */
    if (projectId) {
      router.push(
        isEntrada
          ? "/inspecciones/entrada" +
              "?origen=proyectos"
          : "/inspecciones/proceso",
      );
      return;
    }

    /*
     * MTS/Proyectos → Entrada.
     */
    if (origin) {
      router.push(
        "/inspecciones/entrada",
      );
      return;
    }

    router.push("/inspecciones");
  };

  const selectProject = (
    project: CatalogListItem,
  ) => {
    const query =
      new URLSearchParams();

    if (isEntrada) {
      query.set(
        "origen",
        "proyectos",
      );
    }

    query.set(
      "proyecto",
      project.id,
    );

    router.push(
      `/inspecciones/${tipo}` +
        `?${query.toString()}`,
    );
  };

  const selectWi = (
    wi: CatalogListItem,
  ) => {
    const query =
      new URLSearchParams();

    if (origin) {
      query.set(
        "origen",
        origin,
      );
    }

    if (projectId) {
      query.set(
        "proyecto",
        projectId,
      );
    }

    query.set(
      "wi",
      wi.id,
    );

    router.push(
      `/inspecciones/${tipo}` +
        `?${query.toString()}`,
    );
  };

  const selectProcessComponent = (
    component: CatalogListItem,
  ) => {
    if (!projectId || !wiId) {
      return;
    }

    const query =
      new URLSearchParams({
        proyecto: projectId,
        wi: wiId,
        componente: component.id,
      });

    router.push(
      "/inspecciones/proceso" +
        `?${query.toString()}`,
    );
  };

  const handleAddProcessComponent =
    async (title: string) => {
      await processComponentsState
        .addComponent(title);
    };

  const handleEditProcessComponent =
    async (
      componentId: string,
      title: string,
    ) => {
      await processComponentsState
        .editComponent(
          componentId,
          title,
        );
    };

  const selectFindingType = (
    selectedFinding:
      | "anormalidad"
      | "no_conformidad",
  ) => {
    const query =
      buildCurrentQuery({
        includeFinding: false,
      });

    query.set(
      "hallazgo",
      selectedFinding,
    );

    router.push(
      `/inspecciones/${tipo}` +
        `?${query.toString()}`,
    );
  };

  const openNewAnomalyReport =
    () => {
      const query =
        buildCurrentQuery();

      query.set(
        "accion",
        "nueva",
      );

      router.push(
        `/inspecciones/${tipo}` +
          `?${query.toString()}`,
      );
    };

  const selectAnomaly = (
    anomaly: InspectionAnomaly,
  ) => {
    const query =
      buildCurrentQuery();

    query.set(
      "anomalia",
      anomaly.id,
    );

    router.push(
      `/inspecciones/${tipo}` +
        `?${query.toString()}`,
    );
  };

  const cancelNewAnomalyReport =
    () => {
      if (
        anomaliesState.hasAnomalies
      ) {
        const query =
          buildCurrentQuery();

        router.push(
          `/inspecciones/${tipo}` +
            `?${query.toString()}`,
        );
        return;
      }

      const query =
        buildCurrentQuery({
          includeFinding: false,
        });

      router.push(
        `/inspecciones/${tipo}` +
          `?${query.toString()}`,
      );
    };

  const submitNewAnomalyReport =
    async (
      input: Parameters<
        typeof anomaliesState.createNewReport
      >[0],
    ) => {
      await anomaliesState
        .createNewReport(input);

      const query =
        buildCurrentQuery();

      query.set(
        "enviado",
        "1",
      );

      router.replace(
        `/inspecciones/${tipo}` +
          `?${query.toString()}`,
      );
    };

  const renderLoading = (
    message: string,
  ) => (
    <div
      className="flex min-h-36 flex-col
        items-center justify-center
        rounded-2xl border
        border-white/10 bg-black/15 p-6"
    >
      <LoaderCircle
        size={26}
        className="animate-spin
          text-emerald-300"
      />

      <p
        className="mt-3 text-sm
          text-white/55"
      >
        {message}
      </p>
    </div>
  );

  const renderError = (
    message: string,
    retry?: () => void,
  ) => (
    <div
      className="rounded-2xl border
        border-red-400/20
        bg-red-400/[0.06] p-5"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          size={20}
          className="mt-0.5 shrink-0
            text-red-300"
        />

        <div>
          <p
            className="font-medium
              text-red-100"
          >
            No fue posible cargar
            la información
          </p>

          <p
            className="mt-1 text-sm
              text-red-100/65"
          >
            {message}
          </p>

          {retry && (
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-xl
                border border-red-300/20
                bg-red-300/10 px-4 py-2
                text-sm text-red-100
                transition
                hover:bg-red-300/15"
            >
              Intentar nuevamente
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderFindingSelection =
    () => (
      <FindingTypeSelector
        onSelectAnomaly={() =>
          selectFindingType(
            "anormalidad",
          )
        }
        onSelectNonConformity={() =>
          selectFindingType(
            "no_conformidad",
          )
        }
      />
    );

  const renderAnomalyContent =
    () => {
      if (!anomalyContext) {
        return renderError(
          "Falta información del componente inspeccionado.",
        );
      }

      if (anomaliesState.loading) {
        return renderLoading(
          "Cargando anormalidades...",
        );
      }

      if (anomaliesState.error) {
        return renderError(
          anomaliesState.error,
        );
      }

      /*
       * Confirmación posterior al envío.
       */
      if (reportSent) {
        return (
          <div
            className="rounded-2xl border
              border-emerald-400/25
              bg-emerald-400/[0.07]
              p-6"
          >
            <div
              className="flex items-start
                gap-4"
            >
              <div
                className="flex h-11 w-11
                  shrink-0 items-center
                  justify-center rounded-2xl
                  border border-emerald-400/25
                  bg-emerald-400/10
                  text-emerald-300"
              >
                <CheckCircle2
                  size={22}
                />
              </div>

              <div>
                <h2
                  className="text-lg
                    font-semibold text-white"
                >
                  Reporte guardado
                </h2>

                <p
                  className="mt-2 text-sm
                    leading-relaxed
                    text-white/60"
                >
                  La anormalidad y sus
                  fotografías quedaron
                  guardadas. El reporte está
                  pendiente de que el PM asigne
                  un título y tome la decisión.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      anomaliesState
                        .hasAnomalies
                    ) {
                      const query =
                        buildCurrentQuery();

                      router.replace(
                        `/inspecciones/${tipo}` +
                          `?${query.toString()}`,
                      );
                    } else {
                      const query =
                        buildCurrentQuery({
                          includeFinding:
                            false,
                        });

                      router.push(
                        `/inspecciones/${tipo}` +
                          `?${query.toString()}`,
                      );
                    }
                  }}
                  className="mt-5 min-h-11
                    rounded-xl border
                    border-emerald-400/30
                    bg-emerald-400/10
                    px-5 text-sm font-medium
                    text-emerald-200
                    transition
                    hover:bg-emerald-400/15"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        );
      }

      /*
       * Detalle, historial y conversación
       * de la anormalidad seleccionada.
       */
      if (anomalyId) {
        if (
          anomalyThreadState.loading
        ) {
          return renderLoading(
            "Cargando conversación...",
          );
        }

        if (anomalyThreadState.error) {
          return renderError(
            anomalyThreadState.error,
          );
        }

        if (!anomalyThreadState.anomaly) {
          return (
            <div
              className="rounded-2xl border
                border-amber-400/20
                bg-amber-400/[0.06]
                p-5"
            >
              <p
                className="font-medium
                  text-amber-100"
              >
                No se encontró la anormalidad
              </p>

              <p
                className="mt-2 text-sm
                  text-amber-100/65"
              >
                El reporte solicitado no existe
                o ya no está disponible.
              </p>
            </div>
          );
        }

        return (
          <AnomalyThread
            anomaly={
              anomalyThreadState.anomaly
            }
            occurrences={
              anomalyThreadState.occurrences
            }
            messages={
              anomalyThreadState.messages
            }
            canDecide={
              anomalyThreadState.canDecide
            }
            sending={
              anomalyThreadState.sending
            }
            savingDecision={
              anomalyThreadState
                .savingDecision
            }
            onSendMessage={
              anomalyThreadState.sendMessage
            }
            onSaveDecision={
              anomalyThreadState.saveDecision
            }
          />
        );
      }

      /*
       * Si se eligió “Reportar nueva” o todavía
       * no existen títulos, se abre el formulario.
       */
      if (
        anomalyAction === "nueva" ||
        !anomaliesState.hasAnomalies
      ) {
        return (
          <AnomalyReportForm
            responsiblePms={
              anomaliesState
                .responsiblePms
            }
            loadingPms={
              anomaliesState.loadingPms
            }
            saving={
              anomaliesState.saving
            }
            onSubmit={
              submitNewAnomalyReport
            }
            onCancel={
              cancelNewAnomalyReport
            }
          />
        );
      }

      return (
        <AnomalyList
          anomalies={
            anomaliesState.anomalies
          }
          loading={
            anomaliesState.loading
          }
          error={
            anomaliesState.error
          }
          onSelect={
            selectAnomaly
          }
          onReportNew={
            openNewAnomalyReport
          }
        />
      );
    };

  const renderContent = () => {
    /*
     * Inicio de Entrada.
     */
    if (
      isEntrada &&
      !origin &&
      !projectId &&
      !wiId
    ) {
      return (
        <div
          className="grid grid-cols-1
            gap-4 md:grid-cols-2"
        >
          <InspectionOptionCard
            title="MTS"
            description={
              "Componentes compartidos " +
              "entre distintos proyectos."
            }
            icon={Boxes}
            onClick={() =>
              router.push(
                "/inspecciones/entrada" +
                  "?origen=mts",
              )
            }
          />

          <InspectionOptionCard
            title="Proyectos"
            description={
              "Componentes específicos " +
              "de un proyecto disponible " +
              "en el DMR."
            }
            icon={FolderKanban}
            onClick={() =>
              router.push(
                "/inspecciones/entrada" +
                  "?origen=proyectos",
              )
            }
          />
        </div>
      );
    }

    /*
     * Catálogo MTS.
     */
    if (
      isEntrada &&
      origin === "mts" &&
      !wiId
    ) {
      if (
        workInstructionsCatalog.loading
      ) {
        return renderLoading(
          "Cargando componentes MTS...",
        );
      }

      if (
        workInstructionsCatalog.error
      ) {
        return renderError(
          workInstructionsCatalog.error,
          workInstructionsCatalog.reload,
        );
      }

      return (
        <CatalogList
          items={workInstructionItems}
          emptyMessage={
            "No hay componentes MTS " +
            "disponibles en Box."
          }
          onSelect={selectWi}
        />
      );
    }

    /*
     * Lista de proyectos.
     */
    if (
      !projectId &&
      !wiId
    ) {
      if (projectsCatalog.loading) {
        return renderLoading(
          "Cargando proyectos del DMR...",
        );
      }

      if (projectsCatalog.error) {
        return renderError(
          projectsCatalog.error,
          projectsCatalog.reload,
        );
      }

      return (
        <CatalogList
          items={projectItems}
          emptyMessage={
            "No hay proyectos " +
            "disponibles en el DMR."
          }
          onSelect={selectProject}
        />
      );
    }

    /*
     * WI del proyecto.
     */
    if (
      projectId &&
      !wiId
    ) {
      if (
        workInstructionsCatalog.loading
      ) {
        return renderLoading(
          isEntrada
            ? "Cargando componentes..."
            : "Cargando instrucciones " +
                "de proceso...",
        );
      }

      if (
        workInstructionsCatalog.error
      ) {
        return renderError(
          workInstructionsCatalog.error,
          workInstructionsCatalog.reload,
        );
      }

      return (
        <CatalogList
          items={workInstructionItems}
          emptyMessage={
            isEntrada
              ? workInstructionsCatalog
                    .folderFound === false
                ? "No se encontró la carpeta " +
                  "Incoming Inspection WI."
                : "La carpeta no contiene " +
                  "componentes WI válidos."
              : workInstructionsCatalog
                    .folderFound === false
                ? "No se encontró la carpeta " +
                  "In process WI."
                : "La carpeta no contiene " +
                  "IPWI válidas."
          }
          onSelect={selectWi}
        />
      );
    }

    if (
      wiId &&
      workInstructionsCatalog.loading
    ) {
      return renderLoading(
        "Cargando work instruction...",
      );
    }

    if (
      wiId &&
      workInstructionsCatalog.error
    ) {
      return renderError(
        workInstructionsCatalog.error,
        workInstructionsCatalog.reload,
      );
    }

    if (
      wiId &&
      !selectedWi
    ) {
      return (
        <div
          className="rounded-2xl border
            border-amber-400/20
            bg-amber-400/[0.06] p-5"
        >
          <p
            className="font-medium
              text-amber-100"
          >
            No se encontró la work instruction
          </p>

          <p
            className="mt-2 text-sm
              text-amber-100/65"
          >
            Es posible que haya sido retirada
            o movida en Box.
          </p>
        </div>
      );
    }

    /*
     * Antes de abrir un hallazgo de proceso
     * esperamos a cargar el componente.
     */
    if (
      !isEntrada &&
      selectedWi &&
      processComponentId &&
      processComponentsState.loading
    ) {
      return renderLoading(
        "Cargando componente...",
      );
    }

    /*
     * Anormalidades.
     */
    if (
      findingType === "anormalidad" &&
      selectedWi &&
      (
        isEntrada ||
        selectedProcessComponent
      )
    ) {
      return renderAnomalyContent();
    }

    /*
     * No conformidades permanecen pendientes.
     */
    if (
      findingType === "no_conformidad" &&
      selectedWi
    ) {
      return (
        <div
          className="rounded-2xl border
            border-emerald-400/20
            bg-emerald-400/[0.06] p-6"
        >
          <p
            className="text-xs font-semibold
              uppercase tracking-wider
              text-emerald-300"
          >
            No conformidad
          </p>

          <p
            className="mt-3 text-sm
              text-white/65"
          >
            En el siguiente módulo
            construiremos el registro
            de lotes.
          </p>
        </div>
      );
    }

    /*
     * Entrada:
     * WI → tipo de hallazgo.
     */
    if (
      isEntrada &&
      selectedWi
    ) {
      return renderFindingSelection();
    }

    /*
     * Proceso:
     * WI → componentes manuales.
     */
    if (
      !isEntrada &&
      selectedWi &&
      !processComponentId
    ) {
      return (
        <ProcessComponentList
          components={
            processComponents
          }
          loading={
            processComponentsState.loading
          }
          saving={
            processComponentsState.saving
          }
          error={
            processComponentsState.error
          }
          canEdit={
            processComponentsState.canEdit
          }
          onSelect={
            selectProcessComponent
          }
          onAdd={
            handleAddProcessComponent
          }
          onEdit={
            handleEditProcessComponent
          }
        />
      );
    }

    /*
     * Proceso:
     * componente → tipo de hallazgo.
     */
    if (
      !isEntrada &&
      selectedWi &&
      selectedProcessComponent
    ) {
      return (
        <div>
          <div
            className="mb-5 rounded-2xl
              border border-emerald-400/20
              bg-emerald-400/[0.06] p-4"
          >
            <p
              className="text-xs uppercase
                tracking-wider text-white/45"
            >
              Componente de proceso
            </p>

            <p
              className="mt-2 font-semibold
                text-white"
            >
              {
                selectedProcessComponent
                  .title
              }
            </p>
          </div>

          {renderFindingSelection()}
        </div>
      );
    }

    if (
      !isEntrada &&
      selectedWi &&
      processComponentId &&
      !selectedProcessComponent
    ) {
      return (
        <div
          className="rounded-2xl border
            border-amber-400/20
            bg-amber-400/[0.06] p-5"
        >
          <p
            className="font-medium
              text-amber-100"
          >
            No se encontró el componente
          </p>

          <p
            className="mt-2 text-sm
              text-amber-100/65"
          >
            El componente pudo haber sido
            eliminado o la dirección ya no
            es válida.
          </p>
        </div>
      );
    }

    return (
      <div
        className="rounded-2xl border
          border-amber-400/20
          bg-amber-400/[0.06] p-5"
      >
        <p
          className="text-sm
            text-amber-100/80"
        >
          No fue posible encontrar
          la selección.
        </p>
      </div>
    );
  };

  const getTitle = () => {
    if (
      findingType === "anormalidad"
    ) {
      if (reportSent) {
        return "Reporte enviado";
      }

      if (
        anomalyAction === "nueva" ||
        (
          !anomaliesState.loading &&
          !anomaliesState.hasAnomalies
        )
      ) {
        return "Reportar anormalidad";
      }

      if (selectedAnomaly) {
        return (
          selectedAnomaly.title ||
          "Reporte pendiente de título"
        );
      }

      return "Anormalidades";
    }

    if (
      findingType === "no_conformidad"
    ) {
      return "No conformidades";
    }

    if (selectedProcessComponent) {
      return selectedProcessComponent.title;
    }

    if (selectedWi) {
      return selectedWi.title;
    }

    if (selectedProject) {
      return selectedProject.title;
    }

    if (
      isEntrada &&
      origin === "mts"
    ) {
      return "Componentes MTS";
    }

    if (
      isEntrada &&
      origin === "proyectos"
    ) {
      return "Proyectos";
    }

    return isEntrada
      ? "Inspección de entrada"
      : "Inspección de proceso";
  };

  const getDescription = () => {
    if (
      findingType === "anormalidad"
    ) {
      if (reportSent) {
        return (
          "El reporte quedó guardado " +
          "correctamente."
        );
      }

      if (
        anomalyAction === "nueva" ||
        (
          !anomaliesState.loading &&
          !anomaliesState.hasAnomalies
        )
      ) {
        return (
          "Agrega la evidencia y selecciona " +
          "al PM responsable."
        );
      }

      if (selectedAnomaly) {
        return (
          "Consulta los reportes y la decisión " +
          "registrada para esta anormalidad."
        );
      }

      return (
        "Selecciona un título existente o " +
        "reporta una nueva anormalidad."
      );
    }

    if (
      findingType === "no_conformidad"
    ) {
      return (
        "Registro y consulta de " +
        "no conformidades."
      );
    }

    if (selectedProcessComponent) {
      return (
        "Selecciona el tipo de hallazgo."
      );
    }

    if (selectedWi) {
      return isEntrada
        ? "Selecciona el tipo de hallazgo."
        : "Selecciona o agrega un " +
            "componente de proceso.";
    }

    if (selectedProject) {
      return isEntrada
        ? "Selecciona el componente " +
            "que vas a inspeccionar."
        : "Selecciona la IPWI que " +
            "estás utilizando.";
    }

    if (
      isEntrada &&
      origin === "mts"
    ) {
      return "Selecciona el componente MTS.";
    }

    if (
      (
        isEntrada &&
        origin === "proyectos"
      ) ||
      !isEntrada
    ) {
      return "Selecciona un proyecto.";
    }

    return (
      "Selecciona de dónde proviene " +
      "el componente."
    );
  };

  return (
    <main className={inspectionPageClass}>
      <button
        type="button"
        onClick={goBack}
        className={
          inspectionBackButtonClass
        }
      >
        <ArrowLeft size={17} />
        Regresar
      </button>

      <section
        className={
          `${inspectionPanelClass} mt-5`
        }
      >
        <p
          className="text-xs font-semibold
            uppercase tracking-[0.22em]
            text-emerald-300"
        >
          {isEntrada
            ? "Entrada"
            : "Proceso"}
        </p>

        <h1
          className="mt-3 text-2xl
            font-semibold sm:text-3xl"
        >
          {getTitle()}
        </h1>

        <p
          className="mt-3 max-w-2xl
            text-sm leading-relaxed
            text-white/65 sm:text-base"
        >
          {getDescription()}
        </p>

        <div className="mt-7">
          {renderContent()}
        </div>
      </section>
    </main>
  );
}