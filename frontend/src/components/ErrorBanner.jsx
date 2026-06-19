/**
 * ErrorBanner.jsx
 * Dismissible inline banner for surface-level API errors.
 * Shows a retry button that calls the provided onRetry callback.
 */
export default function ErrorBanner({ message, onRetry, onDismiss }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 px-4 py-3 rounded-xl
                 bg-[var(--color-soc-amber-glow)] border border-[var(--color-soc-amber)]
                 text-[var(--color-soc-amber)] fade-in"
    >
      {/* Warning icon */}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 flex-shrink-0 mt-0.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">Backend Unreachable</p>
        <p className="text-xs mt-0.5 opacity-80">{message}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-bold px-2.5 py-1 rounded-lg
                       bg-[var(--color-soc-amber)] text-[var(--color-soc-bg)]
                       hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-[var(--color-soc-amber-glow)] transition-colors"
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
