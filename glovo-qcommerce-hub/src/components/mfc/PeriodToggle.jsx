const DEFAULT_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'This Week' },
];

export default function PeriodToggle({ value, onChange, options = DEFAULT_OPTIONS }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface-container border border-outline-variant rounded-md px-2.5 py-1 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-accent-container/40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
