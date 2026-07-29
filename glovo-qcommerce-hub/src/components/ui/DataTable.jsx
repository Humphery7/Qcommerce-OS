import { useMemo, useState } from 'react';
import clsx from 'clsx';
import EmptyState from './EmptyState';

export default function DataTable({ columns, rows, rowKey, emptyMessage = 'No data to show yet.' }) {
  const [sort, setSort] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = col.sortValue ? col.sortValue(a) : a[col.key];
      const vb = col.sortValue ? col.sortValue(b) : b[col.key];
      const na = typeof va === 'string' ? va.toLowerCase() : va;
      const nb = typeof vb === 'string' ? vb.toLowerCase() : vb;
      if (na === nb) return 0;
      const result = na > nb ? 1 : -1;
      return sort.dir === 'asc' ? result : -result;
    });
    return copy;
  }, [rows, sort, columns]);

  if (!rows || rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null;
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col)}
                className={clsx(
                  'text-[10px] font-semibold uppercase tracking-[0.06em] text-secondary pb-2 px-2 first:pl-0 border-b border-outline-variant',
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.sortable && 'cursor-pointer select-none hover:text-on-surface'
                )}
              >
                <span className="inline-flex items-center gap-0.5">
                  {col.header}
                  {col.sortable && sort?.key === col.key && (
                    <span className="material-symbols-outlined text-[12px]">
                      {sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/50">
          {sortedRows.map((row, i) => (
            <tr key={rowKey ? row[rowKey] : i} className="hover:bg-surface-container-low transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'py-2 px-2 first:pl-0 text-[13px] text-on-surface',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.mono && 'font-mono text-mono-data'
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
