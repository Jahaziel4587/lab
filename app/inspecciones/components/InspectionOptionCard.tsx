import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { inspectionOptionClass } from "../styles";

type InspectionOptionCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
};

export default function InspectionOptionCard({
  title,
  description,
  icon: Icon,
  onClick,
}: InspectionOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={inspectionOptionClass}
    >
      <div
        className="flex h-12 w-12 items-center justify-center
          rounded-2xl border border-emerald-400/20
          bg-emerald-400/10 text-emerald-300"
      >
        <Icon size={23} />
      </div>

      <div className="mt-6 w-full">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white sm:text-xl">
            {title}
          </h2>

          <ArrowRight
            size={20}
            className="shrink-0 text-white/45 transition
              group-hover:translate-x-1 group-hover:text-emerald-300"
          />
        </div>

        <p className="mt-2 text-sm leading-relaxed text-white/60">
          {description}
        </p>
      </div>
    </button>
  );
}