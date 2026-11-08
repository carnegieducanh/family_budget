// Nơi các máy trao đổi file dữ liệu. App desktop: thư mục Google Drive trên máy
// (`settings.syncFolder` là đường dẫn thư mục). Bản web dùng syncAdapter.web.ts.
export { createDriveFolderAdapter as createSyncAdapter } from '../storage/driveFolderAdapter';
