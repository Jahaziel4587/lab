"use client";

import { STATUS_OPTIONS } from "../constants";
import { statusPillClass } from "../utils";

type StatusSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function StatusSelect({
  value,
  onChange,
  disabled = false,
}: StatusSelectProps) {
  const currentValue = value || "enviado";

  return (
    <select
      value={currentValue}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={[
        statusPillClass(currentValue),
        "[&>option]:text-black [&>option]:bg-white [&>option]:font-bold",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}