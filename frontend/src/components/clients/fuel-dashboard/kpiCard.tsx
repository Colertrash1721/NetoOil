type KpiCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: string;
};

export function KpiCard({ title, value, detail, icon }: KpiCardProps) {
  return (
    <article className="rounded-[26px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl text-cyan-200">
          <i className={`bx ${icon}`} />
        </div>
      </div>
    </article>
  );
}
