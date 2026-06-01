interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
}

export default function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg p-6 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-4xl font-mono text-zinc-100">{value}</p>
      {subtext && <p className="text-xs text-zinc-600 mt-1">{subtext}</p>}
    </div>
  );
}
