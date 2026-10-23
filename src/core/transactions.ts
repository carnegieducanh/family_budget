import { DomainError } from './errors';
import { isValidDate, monthOfDate } from './month';
import { assertMonthEditable } from './monthLock';
import { createRecord, softDelete, touch } from './records';
import type { MutationContext, Transaction, TransactionInput } from './types';

/** Kiểm tra và chuẩn hóa dữ liệu form. Ném DomainError với thông báo tiếng Việt. */
export function validateTransactionInput(
  input: TransactionInput,
  data: MutationContext['data'],
): TransactionInput {
  if (!isValidDate(input.date)) {
    throw new DomainError('Ngày không hợp lệ.');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new DomainError('Số tiền phải là số nguyên yên lớn hơn 0.');
  }
  if (!data.categories.some((c) => c.id === input.categoryId && !c.deleted)) {
    throw new DomainError('Hãy chọn danh mục.');
  }
  if (!data.users.some((u) => u.id === input.paidBy && !u.deleted)) {
    throw new DomainError('Hãy chọn người trả.');
  }
  return { ...input, note: input.note.trim() };
}

export function createTransaction(
  input: TransactionInput,
  ctx: MutationContext,
  id: string,
): Transaction {
  const clean = validateTransactionInput(input, ctx.data);
  assertMonthEditable(monthOfDate(clean.date), ctx.data.months, ctx.now);
  return createRecord<Transaction>(id, { ...clean, createdBy: ctx.userId }, ctx.userId, ctx.now);
}

/** Sửa khoản chi: cả tháng cũ lẫn tháng mới (nếu đổi ngày) đều không được khóa. */
export function updateTransaction(
  existing: Transaction,
  input: TransactionInput,
  ctx: MutationContext,
): Transaction {
  if (existing.deleted) throw new DomainError('Khoản chi này đã bị xóa.');
  const clean = validateTransactionInput(input, ctx.data);
  assertMonthEditable(monthOfDate(existing.date), ctx.data.months, ctx.now);
  assertMonthEditable(monthOfDate(clean.date), ctx.data.months, ctx.now);
  return touch(existing, clean, ctx.userId, ctx.now);
}

export function deleteTransaction(existing: Transaction, ctx: MutationContext): Transaction {
  if (existing.deleted) throw new DomainError('Khoản chi này đã bị xóa.');
  assertMonthEditable(monthOfDate(existing.date), ctx.data.months, ctx.now);
  return softDelete(existing, ctx.userId, ctx.now);
}
