// Radial "lead engine" network graph — pure SVG, server-renderable.
// Centre orb = the engine; middle chips = acquisition sources;
// right fan = regions with live lead counts. Styled after dark
// command-centre dashboards: glowing nodes, curved arcs.

export type RadarSource = { label: string; count: number; icon?: string };
export type RadarNode = { label: string; count: number };

export function LeadRadar({
  total,
  sources,
  nodes,
}: {
  total: number;
  sources: RadarSource[];
  nodes: RadarNode[];
}) {
  const W = 980;
  const H = 560;
  const cx = 180;
  const cy = H / 2;

  const chipX = 380;
  const nodeX = 760;
  const n = Math.max(nodes.length, 1);
  const nodeY = (i: number) => 60 + (i * (H - 120)) / Math.max(n - 1, 1);
  const chipY = (i: number) =>
    cy - ((sources.length - 1) * 56) / 2 + i * 56;

  const arc = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Lead acquisition network"
    >
      <defs>
        <radialGradient id="orbGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.95" />
          <stop offset="55%" stopColor="#b91c1c" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#450a0a" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#dc2626" stopOpacity="0" />
          <stop offset="85%" stopColor="#dc2626" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.35" />
        </linearGradient>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* faint concentric rings around the orb */}
      {[80, 130, 180, 230].map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#dc2626"
          strokeOpacity="0.07"
          strokeDasharray="3 6"
        />
      ))}

      {/* arcs: chips -> region nodes */}
      {nodes.map((_, i) =>
        sources.map((_, j) => (
          <path
            key={`${i}-${j}`}
            d={arc(chipX + 130, chipY(j), nodeX - 14, nodeY(i))}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth="1"
            strokeOpacity={0.28}
          />
        ))
      )}

      {/* arcs: orb -> source chips */}
      {sources.map((_, j) => (
        <path
          key={j}
          d={arc(cx + 78, cy, chipX - 10, chipY(j))}
          fill="none"
          stroke="#dc2626"
          strokeWidth="1.4"
          strokeOpacity="0.5"
        />
      ))}

      {/* centre orb */}
      <circle cx={cx} cy={cy} r={110} fill="url(#haloGrad)" />
      <circle
        cx={cx}
        cy={cy}
        r={64}
        fill="url(#orbGrad)"
        filter="url(#glow)"
        className="animate-pulse"
        style={{ animationDuration: "3s" }}
      />
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        fill="#fff"
        fontSize="30"
        fontWeight="800"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="#fecaca" fontSize="12">
        leads in engine
      </text>
      <text
        x={cx}
        y={cy + 92}
        textAnchor="middle"
        fill="#fca5a5"
        fontSize="11"
        letterSpacing="2"
      >
        LEAD ENGINE
      </text>

      {/* source chips */}
      {sources.map((s, j) => (
        <g key={s.label}>
          <rect
            x={chipX - 10}
            y={chipY(j) - 20}
            width="150"
            height="40"
            rx="8"
            fill="#111111"
            stroke="#dc2626"
            strokeOpacity="0.5"
          />
          <text
            x={chipX + 8}
            y={chipY(j) - 2}
            fill="#fbbf24"
            fontSize="15"
            fontWeight="700"
          >
            {s.count.toLocaleString()}
          </text>
          <text x={chipX + 8} y={chipY(j) + 13} fill="#a3a3a3" fontSize="10">
            {s.label}
          </text>
        </g>
      ))}

      {/* region nodes */}
      {nodes.map((node, i) => (
        <g key={node.label}>
          <circle
            cx={nodeX - 14}
            cy={nodeY(i)}
            r={4}
            fill="#fbbf24"
            filter="url(#glow)"
          />
          <text x={nodeX + 2} y={nodeY(i) - 2} fill="#e5e5e5" fontSize="12">
            {node.label.length > 20 ? node.label.slice(0, 20) + "…" : node.label}
          </text>
          <text x={nodeX + 2} y={nodeY(i) + 12} fill="#737373" fontSize="10">
            {node.count.toLocaleString()} leads
          </text>
        </g>
      ))}

      {nodes.length === 0 && (
        <text x={nodeX + 2} y={cy} fill="#737373" fontSize="13">
          No regions yet — run a scan
        </text>
      )}
    </svg>
  );
}
