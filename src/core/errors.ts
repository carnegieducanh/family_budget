/** Lỗi nghiệp vụ. `message` là tiếng Việt, hiển thị thẳng cho người dùng. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
