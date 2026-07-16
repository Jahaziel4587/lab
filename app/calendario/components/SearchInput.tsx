"use client";

import { FiSearch, FiX } from "react-icons/fi";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className = "",
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/25"
      />

      {value.trim() !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          title="Limpiar búsqueda"
        >
          <FiX />
        </button>
      )}
    </div>
  );
}