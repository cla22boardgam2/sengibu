export function Card({ title, desc, children, right }) {
  return (
    <section className="bg-white border border-stone-200 rounded-xl p-5 mb-4">
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h2 className="font-semibold text-stone-800">{title}</h2>}
            {desc && <p className="text-sm text-stone-500 mt-0.5">{desc}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-stone-300",
    ghost: "border border-stone-300 text-stone-700 hover:bg-stone-100 disabled:text-stone-300",
    danger: "text-red-600 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputCls =
  "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600";

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  return <div className={`border rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

export function EmptyHint({ children, action }) {
  return (
    <div className="text-center py-10 text-stone-500 text-sm">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
