import { Pie, PieChart, Tooltip } from 'recharts';
import { formatYen } from '../../core/money';
import type { CategorySpending } from '../../core/queries';
import type { Category } from '../../core/types';
import { useColorScheme } from '../../components/useColorScheme';
import styles from './CategoryBreakdown.module.scss';

// Bảng màu phân loại đã kiểm bằng validator của skill dataviz cho nền card của app
// (sáng #ffffff, tối #171b21): đạt mọi cổng CVD và normal-vision với các cặp kề nhau,
// kể cả cặp nối vòng slot 5 ↔ slot 1. Ba màu ở chế độ sáng dưới 3:1 so với nền nên
// danh sách số liệu bên cạnh biểu đồ là bắt buộc, không chỉ để trang trí.
const SLOT_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
} as const;
const REST_COLOR = '#898781';

/** Tối đa 5 danh mục có màu riêng; phần còn lại gộp thành một lát xám (≤ 6 lát). */
const MAX_SLICES = 5;

interface Slice {
  key: string;
  label: string;
  icon: string;
  amount: number;
  fill: string;
}

interface CategoryBreakdownProps {
  spending: CategorySpending[];
  categories: readonly Category[];
}

export function CategoryBreakdown({ spending, categories }: CategoryBreakdownProps) {
  const scheme = useColorScheme();
  const total = spending.reduce((sum, item) => sum + item.amount, 0);
  if (total === 0) return <p className={styles.empty}>Chưa có khoản chi nào trong tháng.</p>;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const colors = SLOT_COLORS[scheme];
  const grouped = spending.length > MAX_SLICES;
  const colored = grouped ? spending.slice(0, MAX_SLICES) : spending;
  const rest = grouped ? spending.slice(MAX_SLICES) : [];

  // Màu theo thứ hạng trong tháng: danh sách bên cạnh luôn ghi tên nên màu không đứng một mình.
  const rows: Slice[] = spending.map((item, index) => {
    const category = byId.get(item.categoryId);
    return {
      key: item.categoryId,
      label: category?.name ?? 'Không rõ',
      icon: category?.icon ?? '❔',
      amount: item.amount,
      fill: index < colored.length ? (colors[index] ?? REST_COLOR) : REST_COLOR,
    };
  });
  const slices: Slice[] = rows.slice(0, colored.length);
  if (rest.length > 0) {
    slices.push({
      key: 'rest',
      label: `${rest.length} danh mục còn lại`,
      icon: '',
      amount: rest.reduce((sum, item) => sum + item.amount, 0),
      fill: REST_COLOR,
    });
  }

  const percent = (amount: number) => {
    const value = (amount / total) * 100;
    return value < 1 ? '<1%' : `${Math.round(value)}%`;
  };

  return (
    <div className={styles.layout}>
      <div className={styles.donut}>
        <PieChart width={180} height={180}>
          <Pie
            data={slices}
            dataKey="amount"
            nameKey="label"
            innerRadius={54}
            outerRadius={86}
            startAngle={90}
            endAngle={-270}
            isAnimationActive={false}
          />
          <Tooltip
            content={(props) => {
              const slice = props.active ? (props.payload?.[0]?.payload as Slice) : undefined;
              if (!slice) return null;
              return (
                <div className={styles.tooltip}>
                  <span className={styles.swatch} style={{ background: slice.fill }} />
                  {slice.icon} {slice.label}: <strong>{formatYen(slice.amount)}</strong> (
                  {percent(slice.amount)})
                </div>
              );
            }}
          />
        </PieChart>
      </div>

      <table className={styles.legend}>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <span className={styles.swatch} style={{ background: row.fill }} />
              </td>
              <td className={styles.name}>
                <span aria-hidden="true">{row.icon}</span> {row.label}
              </td>
              <td className={styles.num}>{formatYen(row.amount)}</td>
              <td className={`${styles.num} ${styles.pct}`}>{percent(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
