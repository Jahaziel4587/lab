"use client";

import {
  collection,
  getDocs,
} from "firebase/firestore";
import {
  useEffect,
  useState,
} from "react";

import { db } from
  "@/src/firebase/firebaseConfig";
import type {
  IncomingInspectionContext,
  IncomingLotResponsible,
} from "../types";

function normalizeProjectName(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/^DMR[\s._-]*/i, "")
    .replace(
      /^\d+(?:\.\d+)*[.\s_-]*/,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-MX");
}

export function useIncomingResponsiblePms(
  context:
    IncomingInspectionContext | null,
  enabled = true,
) {
  const [responsiblePms,
    setResponsiblePms] =
    useState<IncomingLotResponsible[]>([]);
  const [loadingPms, setLoadingPms] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled || !context) {
        setResponsiblePms([]);
        setLoadingPms(false);
        return;
      }

      try {
        setLoadingPms(true);
        const snapshot = await getDocs(
          collection(db, "users"),
        );
        const selectedProject =
          normalizeProjectName(
            context.projectName || "",
          );

        const pms = snapshot.docs
          .map((entry) => {
            const data = entry.data();
            const email = String(
              data.email || "",
            ).trim();
            const name = [
              data.nombre,
              data.apellido,
            ]
              .map((value) =>
                String(value || "").trim(),
              )
              .filter(Boolean)
              .join(" ") ||
              String(
                data.displayName || "",
              ).trim() ||
              email;
            const projects = Array.isArray(
              data.pmProjects,
            )
              ? data.pmProjects.map(
                  (value: unknown) =>
                    String(value || ""),
                )
              : [];

            return {
              uid: String(
                data.uid || entry.id,
              ),
              email,
              name,
              projects,
            };
          })
          .filter(
            (pm) =>
              pm.email &&
              pm.projects.length > 0,
          )
          .filter((pm) => {
            if (
              context.sourceType ===
              "entrada_mts"
            ) {
              return true;
            }

            return pm.projects.some(
              (project) =>
                normalizeProjectName(
                  project,
                ) === selectedProject,
            );
          })
          .map(({ uid, email, name }) => ({
            uid,
            email,
            name,
          }))
          .sort((first, second) =>
            first.name.localeCompare(
              second.name,
              "es",
            ),
          );

        if (!cancelled) {
          setResponsiblePms(pms);
        }
      } catch (cause) {
        console.error(
          "Error cargando PM de entrada:",
          cause,
        );
        if (!cancelled) {
          setResponsiblePms([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingPms(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [context, enabled]);

  return {
    responsiblePms,
    loadingPms,
  };
}