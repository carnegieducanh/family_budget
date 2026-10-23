import { useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { isCategoryUsed, sortedCategories } from '../../core/categories';
import type { Category } from '../../core/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PageHeader } from '../../components/PageHeader';
import { useDataStore, useReadyData } from '../../state/dataStore';
import styles from './CategoriesScreen.module.scss';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Danh mục (admin): thêm, đổi tên, đổi icon, kéo thả sắp xếp, ẩn hoặc hiện (SPEC mục 8). */
export function CategoriesScreen() {
  const { data } = useReadyData();
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const categories = sortedCategories(data.categories);
  const ids = categories.map((c) => c.id);

  function run(action: () => void): boolean {
    try {
      action();
      setError(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  }

  function move(id: string, toIndex: number) {
    const rest = ids.filter((x) => x !== id);
    const next = [...rest.slice(0, toIndex), id, ...rest.slice(toIndex)];
    run(() => useDataStore.getState().reorderCategories(next));
  }

  function onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    if (dragId && dragId !== targetId) move(dragId, ids.indexOf(targetId));
    setDragId(null);
    setOverId(null);
  }

  return (
    <>
      <PageHeader title="Danh mục" />
      <p className={styles.lead}>
        Kéo biểu tượng ⠿ để sắp xếp. Danh mục đã có khoản chi chỉ ẩn được, không xóa được; danh mục
        ẩn không hiện khi thêm khoản chi mới nhưng các khoản cũ vẫn giữ nguyên.
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Card>
        <ul className={styles.list}>
          {categories.map((category, index) => {
            const used = isCategoryUsed(data, category.id);
            const rowClass = [
              styles.row,
              category.hidden ? styles.hidden : '',
              dragId === category.id ? styles.dragging : '',
              overId === category.id && dragId !== category.id ? styles.over : '',
            ];
            return (
              <li
                key={category.id}
                className={rowClass.filter(Boolean).join(' ')}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOverId(category.id);
                }}
                onDrop={(e) => onDrop(e, category.id)}
              >
                <span
                  className={styles.handle}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', category.id);
                    const row = e.currentTarget.parentElement;
                    if (row) e.dataTransfer.setDragImage(row, 12, 16);
                    setDragId(category.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  title="Kéo để sắp xếp"
                  aria-hidden="true"
                >
                  ⠿
                </span>
                <CategoryFields category={category} onSave={run} />
                {category.hidden && <span className={styles.tag}>Đang ẩn</span>}
                <span className={styles.actions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Đưa ${category.name} lên`}
                    disabled={index === 0}
                    onClick={() => move(category.id, index - 1)}
                  >
                    <Chevron up />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Đưa ${category.name} xuống`}
                    disabled={index === categories.length - 1}
                    onClick={() => move(category.id, index + 1)}
                  >
                    <Chevron />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      run(() =>
                        useDataStore.getState().setCategoryHidden(category.id, !category.hidden),
                      )
                    }
                  >
                    {category.hidden ? 'Hiện' : 'Ẩn'}
                  </Button>
                  {!used && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(category)}>
                      Xóa
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <AddCategory onSave={run} />
      </Card>

      {deleting && (
        <ConfirmDialog
          title="Xóa danh mục?"
          confirmLabel="Xóa"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            run(() => useDataStore.getState().deleteCategory(deleting.id));
            setDeleting(null);
          }}
        >
          Xóa danh mục {deleting.icon} {deleting.name}? Danh mục này chưa có khoản chi nào.
        </ConfirmDialog>
      )}
    </>
  );
}

/** Ô icon và tên, lưu khi rời ô hoặc bấm Enter. */
function CategoryFields({
  category,
  onSave,
}: {
  category: Category;
  onSave: (action: () => void) => boolean;
}) {
  const [icon, setIcon] = useState(category.icon);
  const [name, setName] = useState(category.name);
  const [saved, setSaved] = useState(category);

  // Dữ liệu đổi từ nơi khác (sync, lưu xong): lấy lại giá trị mới.
  if (saved.updatedAt !== category.updatedAt) {
    setSaved(category);
    setIcon(category.icon);
    setName(category.name);
  }

  function commit() {
    if (icon === category.icon && name === category.name) return;
    const ok = onSave(() => useDataStore.getState().updateCategory(category.id, { icon, name }));
    if (!ok) {
      setIcon(category.icon);
      setName(category.name);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      setIcon(category.icon);
      setName(category.name);
    }
  }

  return (
    <>
      <input
        className={styles.icon}
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-label={`Icon của ${category.name}`}
        maxLength={8}
      />
      <input
        className={styles.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-label={`Tên danh mục ${category.name}`}
        maxLength={40}
      />
    </>
  );
}

function AddCategory({ onSave }: { onSave: (action: () => void) => boolean }) {
  const [icon, setIcon] = useState('');
  const [name, setName] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (onSave(() => useDataStore.getState().addCategory({ icon, name }))) {
      setIcon('');
      setName('');
    }
  }

  return (
    <form className={styles.add} onSubmit={submit}>
      <input
        className={styles.icon}
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        placeholder="🙂"
        aria-label="Icon danh mục mới"
        maxLength={8}
      />
      <input
        className={styles.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tên danh mục mới"
        aria-label="Tên danh mục mới"
        maxLength={40}
      />
      <Button type="submit" variant="primary" size="sm">
        + Thêm danh mục
      </Button>
      <span className={styles.hint}>
        Gõ emoji: Win + . (Windows) hoặc Ctrl + Cmd + Space (macOS)
      </span>
    </form>
  );
}

/** Mũi tên lên/xuống vẽ bằng SVG (ký tự ↑↓ bị Windows vẽ bằng font emoji có màu). */
function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d={up ? 'M2.5 7.5 6 4l3.5 3.5' : 'M2.5 4.5 6 8l3.5-3.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
