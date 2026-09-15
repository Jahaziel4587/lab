import { ArrowRight, FolderOpen } from "lucide-react";

export type CatalogListItem = {
  id: string;
  title: string;
  description?: string;
};

type CatalogListProps = {
  items: CatalogListItem[];
  emptyMessage: string;
  onSelect: (item: CatalogListItem) => void;
};

export default function CatalogList({
  items,
  emptyMessage,
  onSelect,
}: CatalogListProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed
          border-white/15 bg-black/15 p-7 text-center"
      >
        <FolderOpen
          size={28}
          className="mx-auto text-white/40"
        />

        <p className="mt-3 text-sm text-white/55">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className="group flex min-h-16 w-full items-center
            justify-between gap-4 rounded-2xl border
            border-white/10 bg-white/[0.04] px-4 py-4
            text-left transition hover:border-emerald-400/30
            hover:bg-white/[0.07] sm:px-5"
        >
          <div className="min-w-0">
            <p className="font-medium text-white/90">
              {item.title}
            </p>

            {item.description && (
              <p className="mt-1 text-xs text-white/50">
                {item.description}
              </p>
            )}
          </div>

          <ArrowRight
            size={18}
            className="shrink-0 text-white/35 transition
              group-hover:translate-x-1 group-hover:text-emerald-300"
          />
        </button>
      ))}
    </div>
  );
}