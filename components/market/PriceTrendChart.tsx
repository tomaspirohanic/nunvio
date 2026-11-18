// Asking price per m² by month (one series): bars with a hover tooltip
// (<title>) and the same numbers as a table for screen readers / no-chart use.

type Point = { month: string; avgPerSqm: number; listings: number };

export default function PriceTrendChart({
  points,
  locale,
  currency,
  caption,
  tableLabels,
}: {
  points: Point[];
  locale: string;
  currency: string;
  caption: string;
  tableLabels: { month: string; perSqm: string; listings: string };
}) {
  if (points.length < 2) return null;
  const W = 640;
  const H = 220;
  const padL = 8;
  const padB = 34;
  const padT = 24;
  const max = Math.max(...points.map((p) => p.avgPerSqm));
  const slot = (W - padL * 2) / points.length;
  const barW = Math.min(36, slot * 0.6);
  const money = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  const monthLabel = (m: string) =>
    new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(`${m}-01T00:00:00Z`));
  const last = points[points.length - 1];

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={caption}
      >
        <line x1={padL} x2={W - padL} y1={H - padB} y2={H - padB} stroke="#e5e7eb" />
        {points.map((p, i) => {
          const h = Math.max(4, ((H - padB - padT) * p.avgPerSqm) / max);
          const x = padL + i * slot + (slot - barW) / 2;
          const y = H - padB - h;
          const isLast = i === points.length - 1;
          return (
            <g key={p.month}>
              {/* Hit target is the full slot, bigger than the bar */}
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padB - padT} fill="transparent">
                <title>{`${monthLabel(p.month)}: ${money(p.avgPerSqm)} / m² (${p.listings})`}</title>
              </rect>
              <path
                d={`M${x},${H - padB} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + barW - 4} Q${x + barW},${y} ${x + barW},${y + 4} V${H - padB} Z`}
                fill={isLast ? "#dc2626" : "#fca5a5"}
                pointerEvents="none"
              />
              {/* On narrow screens the SVG scales down: label every other month */}
              {(points.length <= 6 || (points.length - 1 - i) % 2 === 0) && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="18"
                  fill="#6b7280"
                >
                  {monthLabel(p.month)}
                </text>
              )}
            </g>
          );
        })}
        {/* Direct label only on the latest value */}
        <text
          x={padL + (points.length - 1) * slot + slot / 2}
          y={Math.max(20, H - padB - ((H - padB - padT) * last.avgPerSqm) / max - 8)}
          textAnchor="middle"
          fontSize="20"
          fontWeight="600"
          fill="#111827"
        >
          {money(last.avgPerSqm)}
        </text>
      </svg>
      <figcaption className="sr-only">{caption}</figcaption>
      <details className="mt-2 text-sm text-gray-600">
        <summary className="cursor-pointer">{tableLabels.month} / {tableLabels.perSqm}</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-gray-500">
              <th className="py-1 font-medium">{tableLabels.month}</th>
              <th className="py-1 font-medium">{tableLabels.perSqm}</th>
              <th className="py-1 font-medium">{tableLabels.listings}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month} className="border-t border-gray-100">
                <td className="py-1">{p.month}</td>
                <td className="py-1">{money(p.avgPerSqm)}</td>
                <td className="py-1">{p.listings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
