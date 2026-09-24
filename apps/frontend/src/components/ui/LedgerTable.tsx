import type { ReactNode } from 'react'

export interface LedgerColumn<T> {
  key: string
  label: string
  render: (row: T, index: number) => ReactNode
  className?: string
}

export interface LedgerTableProps<T> {
  columns: LedgerColumn<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string
  emptyMessage?: string
  caption?: string
}

/** Numbered monospace-row ledger table with a `text-label` sticky-feel header. */
export function LedgerTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No entries.',
  caption,
}: LedgerTableProps<T>) {
  if (rows.length === 0) {
    return <p className="py-6 text-body text-ink-soft">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-body text-body">
        {caption !== undefined && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-rule-strong">
            <th scope="col" className="py-2 pr-4 text-left text-label uppercase tracking-wide text-ink-soft">
              #
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="py-2 pr-4 text-left text-label uppercase tracking-wide text-ink-soft"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="border-b border-rule">
              <td className="py-2 pr-4 font-mono text-mono text-ink-soft">{index + 1}</td>
              {columns.map((column) => (
                <td key={column.key} className={`py-2 pr-4 ${column.className ?? ''}`}>
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
