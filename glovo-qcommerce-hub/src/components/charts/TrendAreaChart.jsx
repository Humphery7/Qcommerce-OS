import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import EmptyState from '../ui/EmptyState';

export default function TrendAreaChart({ data, series, height = 240, valueFormatter = (v) => v, yTickFormatter }) {
  if (!data || data.length === 0 || !series || series.length === 0) {
    return <EmptyState message="No trend data available yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient id={`trend-grad-${s.key}`} key={s.key} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--outline-variant)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
          axisLine={{ stroke: 'var(--outline-variant)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--on-surface-variant)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={yTickFormatter || ((v) => v)}
          width={36}
        />
        <Tooltip
          formatter={(value, name) => [valueFormatter(value), name]}
          contentStyle={{
            borderRadius: 6,
            border: '1px solid var(--outline-variant)',
            fontSize: 12,
            background: 'var(--surface-container-lowest)',
            color: 'var(--on-surface)'
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.5}
            fill={`url(#trend-grad-${s.key})`}
            dot={false}
            activeDot={{ r: 3.5 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
