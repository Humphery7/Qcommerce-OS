import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '../ui/EmptyState';

const SERIES = [
  { key: 'ultrafreshAvailability', name: 'UltraFresh', color: '#FFC244' },
  { key: 'losf1Availability', name: 'LOSF1 (Lagos)', color: '#00A082' },
  { key: 'mnlf1Availability', name: 'MNLF1 (Manila)', color: '#375aa5' }
];

function EndLabel({ x, y, value, fill }) {
  if (value == null) return null;
  return (
    <text x={x + 8} y={y + 4} textAnchor="start" fill={fill} fontSize={11} fontWeight={700}>
      {`${value.toFixed(1)}%`}
    </text>
  );
}

export default function AvailabilityTrendChart({ data }) {
  if (!data || data.length === 0) {
    return <EmptyState message="No trend data available for this period yet." />;
  }

  // Convert 0–1 decimal values → 0–100 so all formatters are straightforward
  const chartData = data.map((row) => {
    const out = { label: row.label };
    SERIES.forEach((s) => {
      const raw = row[s.key];
      out[s.key] = raw != null ? +(raw * 100).toFixed(2) : null;
    });
    return out;
  });

  // Tight Y-axis domain with a 3-point pad above/below
  const allValues = chartData.flatMap((row) =>
    SERIES.map((s) => row[s.key]).filter((v) => v != null)
  );
  const minVal = allValues.length ? Math.floor(Math.min(...allValues) - 3) : 0;
  const maxVal = allValues.length ? Math.ceil(Math.max(...allValues) + 3) : 100;
  const yDomain = [Math.max(0, minVal), Math.min(100, maxVal)];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 20, right: 76, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
          axisLine={{ stroke: 'var(--outline-variant)' }}
          tickLine={false}
        />
        <YAxis
          domain={yDomain}
          tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
          width={54}
        />
        <Tooltip
          formatter={(value, name) => [`${value != null ? value.toFixed(1) : '—'}%`, name]}
          contentStyle={{
            borderRadius: 6,
            border: '1px solid var(--outline-variant)',
            fontSize: 12,
            background: 'var(--surface-container-lowest)',
            color: 'var(--on-surface)',
          }}
        />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: s.color, stroke: 'var(--surface-container-lowest)', strokeWidth: 2 }}
            label={({ x, y, index, value }) =>
              index === chartData.length - 1
                ? <EndLabel x={x} y={y} value={value} fill={s.color} />
                : null
            }
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
