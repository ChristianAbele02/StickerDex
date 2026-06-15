interface ProgressBarProps {
  pct: number;
  /** Optional override color (defaults to a green->emerald scale). */
  color?: string;
  height?: number;
  label?: string;
}

export function ProgressBar({ pct, color, height = 8, label }: ProgressBarProps) {
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: color ?? 'linear-gradient(90deg, #22c55e, #10b981)',
          }}
        />
      </div>
    </div>
  );
}
