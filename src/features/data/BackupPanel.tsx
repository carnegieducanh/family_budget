import { useCallback, useEffect, useState } from 'react';
import type { SnapshotInfo } from '../../core/backups';
import { parseDataFile, serializeDataFile } from '../../core/dataFile';
import { toLocalDate } from '../../core/month';
import { can } from '../../core/permissions';
import type { DataFile } from '../../core/types';
import { Button } from '../../components/Button';
import { useReadyData } from '../../state/dataStore';
import { listSnapshots, readSnapshot } from '../../storage/backup';
import {
  chooseFileToOpen,
  chooseFileToSave,
  readUtf8File,
  writeTextFileTo,
} from '../../storage/files';
import styles from './data.module.scss';
import { RestoreDialog } from './RestoreDialog';

type Message = { tone: 'ok' | 'error'; text: string };

const SHOW_FIRST = 8;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Backup: danh sách snapshot, khôi phục (admin), export/import backup JSON (SPEC mục 8, 9). */
export function BackupPanel() {
  const { data, me } = useReadyData();
  const canRestore = can(me, 'backup:restore');
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [restoring, setRestoring] = useState<{ source: string; snapshot: DataFile } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const refresh = useCallback(() => {
    listSnapshots().then(setSnapshots, (e: unknown) =>
      setMessage({ tone: 'error', text: errorMessage(e) }),
    );
  }, []);

  useEffect(refresh, [refresh]);

  async function run(task: () => Promise<void>) {
    setMessage(null);
    try {
      await task();
    } catch (e) {
      setMessage({ tone: 'error', text: errorMessage(e) });
    }
  }

  const exportJson = () =>
    run(async () => {
      const stamp = toLocalDate(new Date()).replace(/-/g, '');
      const path = await chooseFileToSave(
        'json',
        'Lưu file backup',
        `family-budget-backup-${stamp}.json`,
      );
      if (!path) return;
      await writeTextFileTo(path, serializeDataFile(data));
      setMessage({ tone: 'ok', text: `Đã lưu file backup vào ${path}` });
    });

  const importJson = () =>
    run(async () => {
      const path = await chooseFileToOpen('json', 'Chọn file backup để khôi phục');
      if (!path) return;
      setRestoring({ source: path, snapshot: parseDataFile(await readUtf8File(path)) });
    });

  const restoreSnapshot = (info: SnapshotInfo) =>
    run(async () => {
      setRestoring({ source: `lúc ${info.label}`, snapshot: await readSnapshot(info.name) });
    });

  const visible = snapshots && !showAll ? snapshots.slice(0, SHOW_FIRST) : (snapshots ?? []);

  return (
    <div className={styles.block}>
      <div className={styles.controls}>
        <Button onClick={() => void exportJson()}>Lưu file backup (JSON)...</Button>
        {canRestore && (
          <Button onClick={() => void importJson()}>Khôi phục từ file backup...</Button>
        )}
      </div>
      {message && (
        <p className={message.tone === 'ok' ? styles.ok : styles.error} role="status">
          {message.text}
        </p>
      )}

      <p className={styles.hint}>
        Bản backup tự động trên máy này: tạo trước mỗi lần nhận dữ liệu từ máy kia làm thay đổi dữ
        liệu, trước khi import CSV và trước khi khôi phục. Giữ 30 bản gần nhất và bản đầu tiên của
        mỗi tháng trong 12 tháng.
      </p>
      {snapshots === null ? null : snapshots.length === 0 ? (
        <p className={styles.hint}>Chưa có bản backup tự động nào.</p>
      ) : (
        <>
          <ul className={styles.snapshots}>
            {visible.map((info) => (
              <li key={info.name}>
                <span>{info.label}</span>
                {canRestore && (
                  <Button size="sm" variant="ghost" onClick={() => void restoreSnapshot(info)}>
                    Khôi phục...
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {snapshots.length > SHOW_FIRST && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Thu gọn' : `Xem cả ${snapshots.length} bản`}
            </Button>
          )}
        </>
      )}

      {restoring && (
        <RestoreDialog
          source={restoring.source}
          snapshot={restoring.snapshot}
          onClose={() => setRestoring(null)}
          onDone={(text) => {
            setRestoring(null);
            setMessage({ tone: 'ok', text });
            refresh();
          }}
        />
      )}
    </div>
  );
}
