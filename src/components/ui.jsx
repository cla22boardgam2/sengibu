export function Card({ title, desc, children, right }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 p-5 sm:p-6 mb-4">
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && <h2 className="font-semibold text-slate-800">{title}</h2>}
            {desc && <p className="text-sm text-slate-500 mt-0.5">{desc}</p>}
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
    primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none",
    ghost: "bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 disabled:text-slate-300 disabled:hover:bg-white",
    danger: "text-red-600 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export const inputCls =
  "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600";

export function Notice({ tone = "info", children }) {
  const tones = {
    info: "bg-indigo-50 text-indigo-900 border-indigo-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  return <div className={`border rounded-lg px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>;
}

export function EmptyHint({ children, action }) {
  return (
    <div className="text-center py-10 text-slate-500 text-sm">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
