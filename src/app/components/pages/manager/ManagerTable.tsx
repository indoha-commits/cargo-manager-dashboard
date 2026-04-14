import type { ManagerContainer, PriorityLevel } from './data';

function priorityBadge(level: PriorityLevel): { label: string; bg: string; color: string } {
  if (level === 'red') return { label: 'ACTION NOW', bg: 'rgba(239,68,68,0.15)', color: 'rgb(220,38,38)' };
  if (level === 'yellow') return { label: 'PREPARE', bg: 'rgba(245,158,11,0.18)', color: 'rgb(180,83,9)' };
  return { label: 'STABLE', bg: 'rgba(34,197,94,0.15)', color: 'rgb(22,163,74)' };
}

export function ManagerTable({ rows }: { rows: ManagerContainer[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-70">
            <th className="px-4 py-3">Container</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const badge = priorityBadge(r.priority_level);
            const statusLabel = r.days_to_release === null
              ? 'Not released'
              : r.days_to_release <= 0
                ? 'Released / overdue'
                : `Release in ${r.days_to_release} day${r.days_to_release === 1 ? '' : 's'}`;
            return (
              <tr key={r.cargo_id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3 font-mono">{r.cargo_id}</td>
                <td className="px-4 py-3">{r.client_name}</td>
                <td className="px-4 py-3">{statusLabel}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 700 }}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ fontWeight: 600 }}>{r.recommended_action}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
