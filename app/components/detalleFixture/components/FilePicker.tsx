import type { RefObject } from "react";
import { FiTrash2, FiUpload } from "react-icons/fi";

export default function FilePicker({
  label,
  files,
  inputRef,
  onChange,
  onRemove,
  accept,
}: {
  label: string;
  files: File[];
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  accept?: string;
}) {
  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10">
        <FiUpload /> {label}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="border-b border-white/10 px-4 py-3 text-xs text-white/55">
            Archivos seleccionados: {files.length}
          </div>

          <ul className="divide-y divide-white/10">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-white/75"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-white/85">
                    {file.name}
                  </p>
                  <p className="text-xs text-white/45">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="shrink-0 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-red-200 transition hover:bg-red-400/20"
                >
                  <FiTrash2 />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}