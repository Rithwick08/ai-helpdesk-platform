export default function ComingSoon({ page }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-soc-accent-glow)] border border-[rgba(0,212,255,0.2)] flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-soc-accent)" strokeWidth={1.5} className="w-10 h-10">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l3 3" />
        </svg>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--color-soc-text)]">{page}</h2>
        <p className="text-sm text-[var(--color-soc-text-muted)] mt-2">This module is under construction.</p>
        <p className="text-xs text-[var(--color-soc-text-dim)] mt-1 font-mono">COMING_SOON :: MODULE_LOCKED</p>
      </div>
    </div>
  )
}
