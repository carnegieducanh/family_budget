import { DomainError } from './errors';
import { isValidMonth, toMonth } from './month';
import { active, createRecord, softDelete, touch } from './records';
import type { DataFile, MutationContext, RecurringTemplate, Transaction } from './types';

// Chi tiêu định kỳ (SPEC mục 6): mỗi mẫu đang bật tự tạo một khoản cho tháng hiện tại.

export type RecurringInput = Pick<
  RecurringTemplate,
  'name' | 'amount' | 'categoryId' | 'paidBy' | 'dayOfMonth' | 'startMonth' | 'active'
>;

/** Id cố định của khoản sinh từ mẫu, để hai máy cùng sinh thì sau merge chỉ còn một. */
export function recurringTransactionId(templateId: string, month: string): string {
  return `rec-${templateId}-${month}`;
}

export function validateRecurringInput(input: RecurringInput, data: DataFile): RecurringInput {
  const name = input.name.trim();
  if (!name) throw new DomainError('Hãy nhập tên khoản định kỳ.');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new DomainError('Số tiền phải là số nguyên yên lớn hơn 0.');
  }
  if (!active(data.categories).some((c) => c.id === input.categoryId)) {
    throw new DomainError('Hãy chọn danh mục.');
  }
  if (!active(data.users).some((u) => u.id === input.paidBy)) {
    throw new DomainError('Hãy chọn người trả.');
  }
  if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 28) {
    throw new DomainError('Ngày trong tháng phải từ 1 đến 28.');
  }
  if (!isValidMonth(input.startMonth)) throw new DomainError('Tháng bắt đầu không hợp lệ.');
  return { ...input, name };
}

export function createRecurring(
  input: RecurringInput,
  ctx: MutationContext,
  id: string,
): RecurringTemplate {
  const clean = validateRecurringInput(input, ctx.data);
  return createRecord<RecurringTemplate>(id, clean, ctx.userId, ctx.now);
}

export function updateRecurring(
  existing: RecurringTemplate,
  input: RecurringInput,
  ctx: MutationContext,
): RecurringTemplate {
  if (existing.deleted) throw new DomainError('Mẫu định kỳ này đã bị xóa.');
  return touch(existing, validateRecurringInput(input, ctx.data), ctx.userId, ctx.now);
}

export function deleteRecurring(existing: RecurringTemplate, ctx: MutationContext) {
  if (existing.deleted) throw new DomainError('Mẫu định kỳ này đã bị xóa.');
  return softDelete(existing, ctx.userId, ctx.now);
}

/**
 * Các khoản cần sinh cho tháng hiện tại: mẫu đang bật, đã tới tháng bắt đầu, và chưa có
 * khoản id `rec-<mẫu>-<tháng>` (kể cả đã xóa mềm, nên khoản người dùng đã xóa không bị
 * sinh lại). Chỉ sinh cho tháng hiện tại, không sinh bù các tháng trước.
 *
 * Khoản sinh ra ghi người nhập là người sửa mẫu gần nhất, để hai máy sinh ra cùng một nội dung.
 */
export function generateRecurring(data: DataFile, now: Date): Transaction[] {
  const month = toMonth(now);
  const existing = new Set(data.transactions.map((t) => t.id));
  return active(data.recurring)
    .filter((template) => template.active && template.startMonth <= month)
    .filter((template) => !existing.has(recurringTransactionId(template.id, month)))
    .map((template) =>
      createRecord<Transaction>(
        recurringTransactionId(template.id, month),
        {
          date: `${month}-${String(template.dayOfMonth).padStart(2, '0')}`,
          amount: template.amount,
          categoryId: template.categoryId,
          note: template.name,
          paidBy: template.paidBy,
          createdBy: template.updatedBy,
          recurringId: template.id,
        },
        template.updatedBy,
        now,
      ),
    );
}
