"use client";
import { findingLabel } from "../types";
import type { IncomingLotReport } from "../types";
export type SelectedReportPhoto = { reportId: string; photoIndex: number };
export default function OfficialReportPhotoSelector({ reports, selected, onChange, placement }: { reports: IncomingLotReport[]; selected: SelectedReportPhoto[]; onChange: (value: SelectedReportPhoto[]) => void; placement: string }) {
  const groups = reports.filter(report => report.photos?.length);
  return <fieldset className="rounded-2xl border border-white/10 p-4">
    <legend className="px-2 text-sm font-medium text-white">Fotos para el formato oficial ({selected.length}/48)</legend>
    <p className="mb-3 text-xs text-white/50">Selecciona las fotos que quieras incluir. {placement} Puedes generar el reporte sin fotos.</p>
    <button type="button" onClick={() => onChange([])} className="mb-3 text-xs text-emerald-300">Quitar selección</button>
    {!groups.length && <p className="text-sm text-white/50">Este lote no tiene fotos adjuntas.</p>}
    <div className="max-h-80 space-y-4 overflow-y-auto">
      {groups.map(report => <div key={report.id}><p className="mb-2 text-sm text-white/75">{findingLabel(report.kind)} · {report.title}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{report.photos.map((photo, photoIndex) => {
        const checked = selected.some(p => p.reportId === report.id && p.photoIndex === photoIndex);
        return <label key={`${report.id}:${photoIndex}`} className={`cursor-pointer rounded-xl border p-2 ${checked ? "border-emerald-400 bg-emerald-400/10" : "border-white/10"}`}><img src={photo.url} alt={`${report.title}, foto ${photoIndex + 1}`} loading="lazy" className="h-24 w-full rounded-lg object-contain"/><span className="mt-2 flex items-center gap-2 text-xs text-white/70"><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 48} onChange={() => onChange(checked ? selected.filter(p => !(p.reportId === report.id && p.photoIndex === photoIndex)) : [...selected, { reportId: report.id, photoIndex }])}/>Foto {photoIndex + 1}</span></label>;
      })}</div></div>)}
    </div>
  </fieldset>;
}
