interface TagFilterBarProps {
  tags: string[];
  tagFilters: Record<string, boolean>;
  onToggle: (tag: string, checked: boolean) => void;
}

export function TagFilterBar({
  tags,
  tagFilters,
  onToggle,
}: TagFilterBarProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 border border-slate-700 bg-slate-900 px-4 py-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Tags
      </div>
      <div className="flex flex-wrap gap-3">
        {tags.map((tag) => (
          <label key={tag} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={tagFilters[tag] ?? true}
              onChange={(e) => onToggle(tag, e.target.checked)}
              className="h-4 w-4 border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
            />
            <span>{`#${tag}`}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
