import { useMemo, useState } from "react";
import { formatINR, formatDate } from "../../lib/format";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };

function buildPath(points, xScale, yScale) {
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(p.minPrice).toFixed(1)}`
    )
    .join(" ");
}

export function PriceHistoryChart({ points, days = 90, status, error, onRetry }) {
  const [showTable, setShowTable] = useState(false);

  const geometry = useMemo(() => {
    if (!points || points.length === 0) return null;
    const min = Math.min(...points.map((p) => p.minPrice));
    const max = Math.max(...points.map((p) => p.maxPrice ?? p.minPrice));
    const span = max - min || Math.max(max * 0.05, 1);
    const lo = min - span * 0.1;
    const hi = max + span * 0.1;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const xScale = (i) =>
      PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
    const yScale = (v) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;
    const line = buildPath(points, xScale, yScale);
    const area = `${line} L ${xScale(points.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${xScale(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;
    const yTicks = [lo + (hi - lo) * 0.25, (lo + hi) / 2, hi - (hi - lo) * 0.25];
    return { min, max, line, area, xScale, yScale, yTicks, innerH };
  }, [points]);

  if (status === "loading") {
    return (
      <div role="status" aria-label="Loading price history" className="space-y-3">
        <div className="skeleton h-48 w-full" />
        <span className="sr-only">Loading price history…</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div role="alert" className="rounded-lg border border-danger-100 bg-danger-50 p-6 text-center">
        <p className="text-body-sm font-medium text-danger-700">
          {error?.message || "Could not load price history."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-[44px] rounded-md border border-danger-200 bg-white px-4 text-body-sm font-medium text-danger-700 hover:bg-danger-100"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!points || points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center">
        <p className="text-body-sm text-neutral-600">
          No price history recorded yet in the last {days} days. History appears
          after the next price update.
        </p>
      </div>
    );
  }

  const description = `Lowest tracked price over the last ${days} days: from ${formatINR(
    points[0].minPrice
  )} on ${formatDate(points[0].date)} to ${formatINR(
    points[points.length - 1].minPrice
  )} on ${formatDate(points[points.length - 1].date)}. Range ${formatINR(
    geometry.min
  )} to ${formatINR(geometry.max)}.`;

  return (
    <div>
      <figure className="m-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={description}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0071e3" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0071e3" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {geometry.yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={geometry.yScale(tick)}
                y2={geometry.yScale(tick)}
                stroke="#e5e5ea"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={geometry.yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="#6e6e73"
              >
                {Math.round(tick).toLocaleString("en-IN")}
              </text>
            </g>
          ))}

          <path d={geometry.area} fill="url(#priceFill)" />
          <path
            d={geometry.line}
            fill="none"
            stroke="#0071e3"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((p, i) => (
            <circle
              key={p.date}
              cx={geometry.xScale(i)}
              cy={geometry.yScale(p.minPrice)}
              r="3.5"
              fill="#0071e3"
            >
              <title>{`${formatDate(p.date)}: ${formatINR(p.minPrice)}`}</title>
            </circle>
          ))}

          <text
            x={PAD.left}
            y={H - 10}
            fontSize="11"
            fill="#6e6e73"
            textAnchor="start"
          >
            {formatDate(points[0].date)}
          </text>
          <text
            x={W - PAD.right}
            y={H - 10}
            fontSize="11"
            fill="#6e6e73"
            textAnchor="end"
          >
            {formatDate(points[points.length - 1].date)}
          </text>
        </svg>
        <figcaption className="sr-only">{description}</figcaption>
      </figure>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
        className="mt-3 min-h-[44px] text-body-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
      >
        {showTable ? "Hide data table" : "View data table"}
      </button>

      {showTable && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[420px] text-left text-body-sm">
            <caption className="sr-only">
              Daily lowest price over the last {days} days
            </caption>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-caption font-medium uppercase tracking-wide text-neutral-600">
                <th scope="col" className="px-4 py-2.5">Date</th>
                <th scope="col" className="px-4 py-2.5">Lowest</th>
                <th scope="col" className="px-4 py-2.5">Highest</th>
                <th scope="col" className="px-4 py-2.5">Average</th>
                <th scope="col" className="px-4 py-2.5">MRP</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-900">{formatDate(p.date)}</td>
                  <td className="px-4 py-2.5 text-neutral-900">{formatINR(p.minPrice)}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{formatINR(p.maxPrice)}</td>
                  <td className="px-4 py-2.5 text-neutral-700">{formatINR(p.avgPrice)}</td>
                  <td className="px-4 py-2.5 text-neutral-700">
                    {p.maxMrp ? formatINR(p.maxMrp) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
