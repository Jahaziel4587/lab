import type { Project } from "./catalog";

const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Resolve historical labels without removing the E prefix from real E projects. */
export function resolveProject(label: string, projects: Project[]): Project | undefined {
  const value = normalized(label);
  const exact = projects.find(p => normalized(p.label) === value || normalized(p.code) === value);
  if (exact) return exact;
  // Hero Cap was previously saved as E020. Its current catalog code is 020.
  if (/^e020\s*[.\-]\s*hero cap$/.test(value)) {
    return projects.find(p => p.code === "020" && normalized(p.name) === "hero cap");
  }
  const code = label.trim().match(/^(E?\d{3})(?=\s*[.\-]|\s|$)/i)?.[1].toUpperCase();
  return code ? projects.find(p => p.code.toUpperCase() === code) : undefined;
}

export function displayProjectLabel(label: string, projects: Project[]): string {
  const project = resolveProject(label, projects);
  return project ? (project.code === "OTRO" ? project.name : `${project.code}.${project.name}`) : label;
}

export function fixtureTitle(projectLabel: string, title: string, projects: Project[]): string {
  if (!title.trim()) return "";
  const project = resolveProject(projectLabel, projects);
  const code = project?.code === "OTRO" ? "Otro" : project?.code ||
    projectLabel.trim().match(/^(E?\d{3})(?=\s*[.\-]|\s|$)/i)?.[1].toUpperCase() ||
    projectLabel.trim().split(/[.]/)[0] || "SIN PROYECTO";
  return `FXT. ${code}. ${title.trim()}`;
}
