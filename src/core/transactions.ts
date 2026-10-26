import { DomainError } from './errors';
import { isValidDate } from './month';
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
  return createRecord<Transaction>(id, { ...clean, createdBy: ctx.userId }, ctx.userId, ctx.now);
}

export function updateTransaction(
  existing: Transaction,
  input: TransactionInput,
  ctx: MutationContext,
): Transaction {
  if (existing.deleted) throw new DomainError('Khoản chi này đã bị xóa.');
  const clean = validateTransactionInput(input, ctx.data);
  return touch(existing, clean, ctx.userId, ctx.now);
}

export function deleteTransaction(existing: Transaction, ctx: MutationContext): Transaction {
  if (existing.deleted) throw new DomainError('Khoản chi này đã bị xóa.');
  return softDelete(existing, ctx.userId, ctx.now);
}
