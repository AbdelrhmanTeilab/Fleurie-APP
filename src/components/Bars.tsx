// Dependency-free bar chart. Values are plain numbers; labels are short strings.
export function Bars({ data, unit = '', height = 130 }: { data: { label: string; value: number }[]; unit?: string; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: height + 22, direction: 'ltr' }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.value}${unit}`} style={{ flex: 1, minWidth: 4, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
          <div style={{ width: '100%', height: Math.max(d.value ? 3 : 1, (d.value / max) * height), background: d.value ? 'var(--primary)' : 'var(--line)', borderRadius: '4px 4px 0 0' }} />
          <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, whiteSpace: 'nowrap' }}>{data.length <= 16 || i % Math.ceil(data.length / 12) === 0 ? d.label : ''}</span>
        </div>))}
    </div>
  );
}
