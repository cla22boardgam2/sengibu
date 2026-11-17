export default function ChipPicker({ chips, selected = {}, onToggle, groupBy }) {
  const groups = groupBy ? [...new Set(chips.map((c) => c.group))] : [null];
  return (
    <div className="space-y-1.5">
      {groups.map((g) => (
        <div key={g ?? "all"} className="flex flex-wrap items-center gap-1.5">
          {g && <span className="text-xs text-stone-500 w-16 shrink-0">{g}</span>}
          {chips.filter((c) => !g || c.group === g).map((c) => {
            const on = !!selected[c.id];
            const neg = c.negative;
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => onToggle(c.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  on
                    ? neg ? "bg-amber-500 border-amber-500 text-white" : "bg-emerald-700 border-emerald-700 text-white"
                    : neg ? "border-amber-300 text-amber-800 hover:bg-amber-50" : "border-stone-300 text-stone-700 hover:bg-stone-100"
                }`}>
                {c.text}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
