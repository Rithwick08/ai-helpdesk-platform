/**
 * SkeletonCard.jsx
 * Shimmer placeholder that mirrors the MetricCard dimensions.
 * Used while API data is loading.
 */
export function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 bg-[var(--color-soc-card)] border border-[var(--color-soc-border-subtle)] space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="shimmer h-2.5 w-24 rounded-full" />
          <div className="shimmer h-8 w-16 rounded-md" />
        </div>
        <div className="shimmer w-11 h-11 rounded-xl flex-shrink-0" />
      </div>
      <div className="shimmer h-2 w-32 rounded-full" />
    </div>
  )
}

/**
 * SkeletonRow.jsx
 * Shimmer table row placeholder.
 */
export function SkeletonRow({ cols = 7 }) {
  return (
    <tr className="border-b border-[var(--color-soc-border-subtle)]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer h-2.5 rounded-full" style={{ width: `${50 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  )
}

/**
 * SkeletonList.jsx
 * Shimmer list item placeholder.
 */
export function SkeletonList({ rows = 5 }) {
  return (
    <ul className="divide-y divide-[var(--color-soc-border-subtle)]">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="shimmer w-6 h-6 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="shimmer h-2.5 rounded-full w-full" />
            <div className="shimmer h-2 rounded-full w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  )
}
