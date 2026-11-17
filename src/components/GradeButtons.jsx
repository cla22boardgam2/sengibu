import { LEVEL_ORDER, LEVEL_SHORT, LEVEL_NAMES } from "../lib/defaults.js";

export const levelsOf = (row) => LEVEL_ORDER.filter((k) => k !== "vg" || row.levels.vg);

export default function GradeButtons({ row, value, onChange, label }) {
  return (
    <div role="group" aria-label={label ?? row.element} className="inline-flex rounded-lg border border-stone-300 overflow-hidden">
      {levelsOf(row).map((k) => (
        <button key={k} type="button" aria-pressed={value === k} title={`${LEVEL_NAMES[k]}: ${row.levels[k]}`}
          onClick={() => onChange(value === k ? null : k)}
          className={`px-2.5 py-1 text-xs border-l first:border-l-0 border-stone-300 ${value === k ? "bg-emerald-700 text-white" : "hover:bg-stone-100"}`}>
          {LEVEL_SHORT[k]}
        </button>
      ))}
    </div>
  );
}
