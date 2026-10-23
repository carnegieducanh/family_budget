import type { Category } from '../core/types';

/** Icon + tên danh mục. Danh mục không còn tồn tại hiện "Không rõ". */
export function CategoryLabel({ category }: { category: Category | undefined }) {
  return (
    <span>
      <span aria-hidden="true">{category?.icon ?? '❔'}</span> {category?.name ?? 'Không rõ'}
    </span>
  );
}
