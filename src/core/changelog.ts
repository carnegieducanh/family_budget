// Ghi chú phát hành trong docs/CHANGELOG.md: mỗi phiên bản một mục `## x.y.z`, nội dung là các
// dòng `- ...`. Workflow phát hành lấy đúng mục này làm ghi chú của bản cập nhật, nên ghi chú
// từ plugin-updater và ghi chú đóng gói sẵn trong app cùng một dạng.

/** Nội dung mục `## <version>` (tới mục `## ` kế tiếp); null nếu không có hoặc rỗng. */
export function changelogSection(markdown: string, version: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || null;
}

/** Các ý của ghi chú: bỏ dấu `- ` đầu dòng và dòng trống. */
export function releaseNoteItems(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s+/, ''))
    .filter(Boolean);
}
