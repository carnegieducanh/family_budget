import dayjs from 'dayjs';

// Ngày lưu dạng YYYY-MM-DD và tháng dạng YYYY-MM, đều theo giờ local (SPEC mục 3, 4).
// Hai dạng chuỗi này so sánh được trực tiếp bằng <, >.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** Ngày local của thời điểm `now`, dạng YYYY-MM-DD. */
export function toLocalDate(now: Date): string {
  return dayjs(now).format('YYYY-MM-DD');
}

/** Tháng local của thời điểm `now`, dạng YYYY-MM. */
export function toMonth(now: Date): string {
  return dayjs(now).format('YYYY-MM');
}

/** Tháng đã qua theo giờ local, tức là từ ngày 1 của tháng sau trở đi. */
export function isPastMonth(month: string, now: Date): boolean {
  return month < toMonth(now);
}

/** Ngày cuối của tháng, dạng YYYY-MM-DD. */
export function lastDayOfMonth(month: string): string {
  return dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD');
}

/** Tháng mà một ngày YYYY-MM-DD thuộc về. */
export function monthOfDate(date: string): string {
  return date.slice(0, 7);
}

export function isValidDate(date: string): boolean {
  return DATE_RE.test(date) && dayjs(date).format('YYYY-MM-DD') === date;
}

export function isValidMonth(month: string): boolean {
  return MONTH_RE.test(month) && isValidDate(`${month}-01`);
}

export function addMonths(month: string, count: number): string {
  return dayjs(`${month}-01`).add(count, 'month').format('YYYY-MM');
}

/** "2026-10" → "Tháng 10/2026" */
export function formatMonthLabel(month: string): string {
  return `Tháng ${formatMonthShort(month)}`;
}

/** "10/2026", cho ô bảng mà tiêu đề cột đã ghi "Tháng". */
export function formatMonthShort(month: string): string {
  const [year, mm] = month.split('-');
  return `${Number(mm)}/${year}`;
}

/** "2026-10-05" → "05/10/2026" */
export function formatDate(date: string): string {
  const [year, mm, dd] = date.split('-');
  return `${dd}/${mm}/${year}`;
}

/** Thời điểm ISO → "14:05 25/10/2026" theo giờ local. */
export function formatDateTime(iso: string): string {
  return dayjs(iso).format('HH:mm DD/MM/YYYY');
}

/** Khoảng thời gian từ `iso` đến `now`: "vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước". */
export function formatTimeAgo(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}
