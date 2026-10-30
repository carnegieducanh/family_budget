import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatYen } from '../../core/money';
import { formatMonthLabel } from '../../core/month';
import type { MonthTotal } from '../../core/queries';
import styles from './ReportsScreen.module.scss';

// Một chuỗi số liệu nên một màu: slot 1 (xanh ゆうちょ) của bảng màu đã kiểm cho nền card ở cả
// hai theme (xem CategoryBreakdown). Không cần chú thích vì tiêu đề card đã nói biểu đồ là gì.
const BAR_COLOR = '#009900';

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** "2026-10" → "10/26" cho nhãn trục. */
function shortMonth(month: string): string {
  const [year, mm] = month.split('-');
  return `${Number(mm)}/${year?.slice(2)}`;
}

interface MonthlyChartProps {
  totals: MonthTotal[];
  selected: string;
  onSelect: (month: string) => void;
}

/** Biểu đồ cột tổng chi theo tháng. Bấm vào cột để chọn tháng đó. */
export function MonthlyChart({ totals, selected, onSelect }: MonthlyChartProps) {
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={totals} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            // Biểu đồ hẹp: cách đều bỏ bớt nhãn, luôn giữ nhãn cuối (tháng đang chọn). Để
            // recharts đo đúng chỗ cần: tickFormatter cho nội dung nhãn, class
            // recharts-cartesian-axis-tick-value để nó đọc cỡ chữ của nhãn.
            interval="equidistantPreserveEnd"
            tickFormatter={(value: string) => shortMonth(value)}
            tick={({ x, y, payload }) => (
              <text
                x={x}
                y={Number(y) + 12}
                textAnchor="middle"
                className={`recharts-cartesian-axis-tick-value ${
                  payload.value === selected ? styles.tickSelected : styles.tick
                }`}
              >
                {shortMonth(String(payload.value))}
              </text>
            )}
          />
          <YAxis
            width="auto"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `¥${compact.format(value)}`}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ className: styles.cursor }}
            content={({ active, payload }) => {
              const item = active ? (payload?.[0]?.payload as MonthTotal | undefined) : undefined;
              if (!item) return null;
              return (
                <div className={styles.tooltip}>
                  <strong>{formatYen(item.total)}</strong>
                  <span>{formatMonthLabel(item.month)}</span>
                </div>
              );
            }}
          />
          <Bar
            dataKey="total"
            fill={BAR_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
            className={styles.bar}
            onClick={(entry) => {
              const month = (entry as { payload?: MonthTotal }).payload?.month;
              if (month) onSelect(month);
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
