// Biểu đồ cột doanh thu/chi phí theo tháng (mục 10 Tổng quan). SVG thuần, nhẹ.
import { moneyShort } from '@/lib/format';

export function BarChart({
  data,
}: {
  data: { month: number; revenue: number; expense: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.expense)));
  const barW = 14;
  const gap = 8;
  const groupW = barW * 2 + gap;
  const chartH = 88;
  const width = data.length * (groupW + 10);

  return (
    <div className="overflow-x-auto no-scrollbar">
      <svg width={width} height={chartH + 22} className="block">
        {data.map((d, i) => {
          const x = i * (groupW + 10) + 4;
          const rH = (d.revenue / max) * chartH;
          const eH = (d.expense / max) * chartH;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={chartH - rH}
                width={barW}
                height={rH}
                rx={3}
                fill="var(--teal)"
              />
              <rect
                x={x + barW + 2}
                y={chartH - eH}
                width={barW}
                height={eH}
                rx={3}
                fill="var(--pend-line)"
              />
              <text
                x={x + barW}
                y={chartH + 14}
                textAnchor="middle"
                fontSize="9"
                fill="var(--ink-3)"
              >
                T{d.month}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-3 text-[10px] text-[var(--ink-3)] mt-1">
        <span className="flex items-center gap-1">
          <i className="w-2.5 h-2.5 rounded-sm bg-[var(--teal)] inline-block" /> Doanh thu
        </span>
        <span className="flex items-center gap-1">
          <i className="w-2.5 h-2.5 rounded-sm bg-[var(--pend-line)] inline-block" /> Chi phí
        </span>
        <span className="ml-auto">cao nhất ≈ {moneyShort(max)}</span>
      </div>
    </div>
  );
}
