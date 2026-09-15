"use client";

import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  FolderKanban,
  LoaderCircle,
} from "lucide-react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import CatalogList, {
  type CatalogListItem,
} from "../components/CatalogList";
import FindingTypeSelector from "../components/FindingTypeSelector";
import InspectionOptionCard from "../components/InspectionOptionCard";
import ProcessComponentList from "../components/ProcessComponentList";

import { useInspectionCatalog } from "../hooks/useInspectionCatalog";
import { useProcessComponents } from "../hooks/useProcessComponents";

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
  const params = useParams<{ tipo: string }>();
  const searchParams = useSearchParams();

  const tipo = params.tipo;
  const origin = searchParams.get("origen");
  const projectId = searchParams.get("proyecto");
  const wiId = searchParams.get("wi");
  const processComponentId =
    searchParams.get("componente");
  const findingType =
    searchParams.get("hallazgo");

  const validInspectionType =
    isInspectionType(tipo);

  const isEntrada = tipo === "entrada";

  /*
   * Los proyectos se consultan cuando:
   *
   * - Estamos en inspección de proceso.
   * - Entrada está en la rama Proyectos.
   * - Ya existe un proyecto en la URL.
   */
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

  /*
   * Decide qué catálogo de WI debe consultarse.
   */
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

  /*
   * Convertimos los proyectos de Box al formato
   * utilizado por CatalogList.
   */
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

  /*
   * Convertimos las WI de Box al formato
   * utilizado por CatalogList.
   */
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

  /*
   * Componentes manuales de las WI de proceso.
   *
   * El hook siempre debe ejecutarse, pero solamente
   * consulta Firebase cuando estamos dentro de una
   * WI válida de proceso.
   */
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
   * Esta validación debe estar después de todos
   * los hooks para respetar las reglas de React.
   */
  if (!validInspectionType) {
    return (
      <main className={inspectionPageClass}>
        <section className={inspectionPanelClass}>
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

  const goBack = () => {
    /*
     * Hallazgo seleccionado:
     * regresar a la selección de hallazgo.
     */
    if (findingType) {
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
     * componente → componentes del proyecto.
     *
     * Proceso:
     * WI → lista de WI del proyecto.
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

    query.set(
      "hallazgo",
      selectedFinding,
    );

    router.push(
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
    retry: () => void,
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

          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-xl
              border border-red-300/20
              bg-red-300/10 px-4 py-2
              text-sm text-red-100
              transition hover:bg-red-300/15"
          >
            Intentar nuevamente
          </button>
        </div>
      </div>
    </div>
  );

  const renderFindingSelection = () => (
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
     * Lista de WI del proyecto.
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

    /*
     * Carga de una WI abierta directamente
     * mediante su URL.
     */
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

    /*
     * Si la WI ya no está disponible en Box.
     */
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
     * Pantalla provisional del hallazgo.
     */
    if (
      findingType &&
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
            {findingType ===
            "anormalidad"
              ? "Anormalidad"
              : "No conformidad"}
          </p>

          {!isEntrada &&
            selectedProcessComponent && (
              <p
                className="mt-3 font-medium
                  text-white"
              >
                {
                  selectedProcessComponent
                    .title
                }
              </p>
            )}

          <p
            className="mt-3 text-sm
              text-white/65"
          >
            En el siguiente módulo
            construiremos esta función.
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
     * Si se abrió directamente la URL de un
     * componente, esperamos a que Firebase
     * termine de cargarlo.
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

    /*
     * El ID del componente existe en la URL,
     * pero no existe en Firebase.
     */
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
      return (
        "Registro y consulta de " +
        "anormalidades."
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
        "Selecciona el tipo de " +
        "hallazgo."
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