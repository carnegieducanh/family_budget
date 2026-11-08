/**
 * Family Budget — cầu nối giữa bản web trên điện thoại và thư mục FamilyBudget trên Google Drive.
 *
 * Điện thoại không đọc được thư mục Google Drive như app trên máy tính, nên gửi yêu cầu tới
 * script này. Script chạy bằng tài khoản Google của người tạo (admin, chủ thư mục FamilyBudget),
 * chỉ làm 2 việc trong thư mục đó: đọc các file `device-*.json` của các máy, và ghi file
 * `device-<mã máy>.json` của điện thoại. Mỗi yêu cầu phải kèm mã kết nối. Script không xóa gì.
 *
 * Cách cài (chi tiết trong docs/INSTALL.md, mục "Bản web cho iPhone"):
 *   1. script.google.com → Dự án mới → dán toàn bộ file này thay cho nội dung có sẵn → Lưu.
 *   2. Chọn hàm caiDat → Chạy → cấp quyền → xem "Nhật ký thực thi": thư mục và MÃ KẾT NỐI.
 *   3. Triển khai → Tùy chọn triển khai mới → Ứng dụng web; Thực thi dưới dạng: Tôi;
 *      Người có quyền truy cập: Bất kỳ ai → Triển khai → chép URL ứng dụng web.
 *   4. Trên điện thoại: dán URL ứng dụng web và mã kết nối.
 */

// Để trống thì hàm caiDat tự tìm thư mục FamilyBudget có dữ liệu. Nếu caiDat báo thấy nhiều thư
// mục, dán ID của thư mục đúng vào đây (phần cuối link thư mục trên Google Drive:
// https://drive.google.com/drive/folders/<ID>) rồi chạy lại caiDat. Dán ID của thư mục đã chọn
// trong app trên máy tính cũng được: như app, script tự dùng thư mục con FamilyBudget bên trong.
const FOLDER_ID = '';

// Cùng mẫu tên file với app (src/core/deviceFiles.ts).
const DEVICE_FILE_RE = /^device-([A-Za-z0-9-]+?)(\.enc)?\.json$/;

/**
 * Chạy một lần trong trình soạn thảo (và chạy lại sau khi sửa FOLDER_ID): chọn thư mục dữ liệu
 * và tạo mã kết nối. Không thấy file của máy nào thì báo lỗi, không in mã.
 */
function caiDat() {
  const props = PropertiesService.getScriptProperties();
  const folder = findFolder_();
  const count = deviceFiles_(folder, '').length;
  if (count === 0) {
    throw new Error(
      'Thư mục "' +
        folder.getName() +
        '" (' +
        folder.getUrl() +
        ') không có file device-*.json nào, cũng không có thư mục con FamilyBudget chứa các file đó. ' +
        'Hãy để trống FOLDER_ID, hoặc dán ID của thư mục FamilyBudget đang chứa file của các máy.',
    );
  }
  props.setProperty('FOLDER_ID', folder.getId());
  let secret = props.getProperty('SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('SECRET', secret);
  }
  console.log('Thư mục dữ liệu: ' + folder.getName() + ' — ' + folder.getUrl());
  console.log('Số file của các máy: ' + count);
  console.log('MÃ KẾT NỐI: ' + secret);
  console.log('Tiếp theo: Triển khai → Tùy chọn triển khai mới → Ứng dụng web.');
}

/** Đổi mã kết nối (khi lỡ gửi nhầm cho người khác). Điện thoại phải nhập lại mã mới. */
function doiMaKetNoi() {
  PropertiesService.getScriptProperties().deleteProperty('SECRET');
  caiDat();
}

/** Mở URL ứng dụng web trong trình duyệt để thử: chỉ hiện một dòng, không lộ dữ liệu. */
function doGet() {
  return ContentService.createTextOutput(
    'Family Budget: cầu nối đang chạy. Dán link này vào bản web trên điện thoại.',
  );
}

/**
 * Yêu cầu từ bản web: JSON `{ key, action, ... }`.
 * - `list`: nội dung mọi file `device-*.json` trong thư mục, trừ file của máy `exclude`.
 * - `write`: ghi `content` vào file `name` (tạo mới nếu chưa có).
 * Trả về `{ ok: true, ... }` hoặc `{ ok: false, error }`.
 */
function doPost(e) {
  let result;
  try {
    const request = JSON.parse(e.postData.contents);
    checkKey_(request.key);
    if (request.action === 'list') result = list_(request.exclude);
    else if (request.action === 'write') result = write_(request.name, request.content);
    else throw new Error('Yêu cầu không hợp lệ.');
  } catch (error) {
    result = { ok: false, error: String((error && error.message) || error) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function checkKey_(key) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret)
    throw new Error('Script chưa cài đặt xong: hãy chạy hàm caiDat trong trình soạn thảo.');
  if (typeof key !== 'string' || key !== secret) throw new Error('Sai mã kết nối.');
}

/** Thư mục dữ liệu mà caiDat đã chọn (lưu trong Script Properties). */
function folder_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) throw new Error('Script chưa cài đặt xong: hãy chạy hàm caiDat trong trình soạn thảo.');
  return DriveApp.getFolderById(id);
}

/**
 * Thư mục chứa file của các máy, theo cùng luật với app trên máy tính (resolveDataDir): thư mục
 * tên FamilyBudget, hoặc đã có file device-*.json, thì dùng chính nó; nếu không thì dùng thư mục
 * con FamilyBudget bên trong (nếu có).
 */
function dataFolder_(folder) {
  if (folder.getName().toLowerCase() === 'familybudget') return folder;
  if (deviceFiles_(folder, '').length > 0) return folder;
  const children = folder.getFolders();
  while (children.hasNext()) {
    const child = children.next();
    if (!child.isTrashed() && child.getName().toLowerCase() === 'familybudget') return child;
  }
  return folder;
}

/** Thư mục có dữ liệu: theo FOLDER_ID nếu có, nếu không thì thư mục tên FamilyBudget duy nhất có file của các máy. */
function findFolder_() {
  if (FOLDER_ID) return dataFolder_(DriveApp.getFolderById(FOLDER_ID));
  const found = [];
  const folders = DriveApp.getFoldersByName('FamilyBudget');
  while (folders.hasNext()) {
    const folder = folders.next();
    if (!folder.isTrashed() && deviceFiles_(folder, '').length > 0) found.push(folder);
  }
  if (found.length === 1) return found[0];
  if (found.length === 0) {
    throw new Error(
      'Không thấy thư mục FamilyBudget nào có file device-*.json trong Google Drive của tài khoản này. ' +
        'Hãy chạy script bằng tài khoản đã tạo dữ liệu (admin), hoặc dán ID thư mục vào FOLDER_ID.',
    );
  }
  throw new Error(
    'Thấy ' +
      found.length +
      ' thư mục FamilyBudget có dữ liệu:\n' +
      found.map((folder) => folder.getUrl()).join('\n') +
      '\nMở app trên máy tính → Cài đặt → Sync để biết thư mục đang dùng, rồi dán ID của nó vào FOLDER_ID.',
  );
}

/**
 * File `device-*.json` (chưa xóa) trong thư mục, bỏ file của máy `exclude`. Trùng tên (Drive cho
 * phép) thì lấy file sửa gần nhất.
 */
function deviceFiles_(folder, exclude) {
  const latest = {};
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    const match = DEVICE_FILE_RE.exec(name);
    if (!match || match[1] === exclude || file.isTrashed()) continue;
    const previous = latest[name];
    if (!previous || file.getLastUpdated() > previous.getLastUpdated()) latest[name] = file;
  }
  return Object.keys(latest)
    .sort()
    .map((name) => latest[name]);
}

function list_(exclude) {
  const files = deviceFiles_(folder_(), typeof exclude === 'string' ? exclude : '');
  return {
    ok: true,
    files: files.map((file) => ({
      name: file.getName(),
      content: file.getBlob().getDataAsString('UTF-8'),
      modified: file.getLastUpdated().toISOString(),
    })),
  };
}

function write_(name, content) {
  const match = typeof name === 'string' ? DEVICE_FILE_RE.exec(name) : null;
  if (!match) throw new Error('Tên file không hợp lệ.');
  if (typeof content !== 'string' || content === '') throw new Error('Nội dung trống.');
  // Nội dung phải là JSON, và là dữ liệu của đúng máy mang tên file: không bao giờ ghi đè file
  // của máy khác.
  const data = JSON.parse(content);
  if (data && typeof data.deviceId === 'string' && data.deviceId !== match[1]) {
    throw new Error('Nội dung không khớp tên file.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const folder = folder_();
    const [target] = deviceFiles_(folder, '').filter((file) => file.getName() === name);
    if (target) target.setContent(content);
    else folder.createFile(name, content, 'application/json');
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}
