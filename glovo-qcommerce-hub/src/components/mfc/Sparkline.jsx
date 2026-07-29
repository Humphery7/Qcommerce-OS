import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';

export default function Sparkline({ data, dataKey = 'value', color = '#00a082', width = 96, height = 28, valueSuffix = '' }) {
  if (!data || data.length === 0) return <span className="text-secondary text-[12px]">—</span>;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(1)}${valueSuffix}`}
            labelFormatter={() => ''}
            contentStyle={{
              borderRadius: 4,
              border: '1px solid var(--outline-variant)',
              fontSize: 11,
              padding: '2px 6px',
              background: 'var(--surface-container-lowest)',
              color: 'var(--on-surface)'
            }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
