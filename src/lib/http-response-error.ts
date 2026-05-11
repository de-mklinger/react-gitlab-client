export class HttpResponseError extends Error {
  public readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? "HTTP response error: " + status);
    this.status = status;
  }

  public isNotFound(): boolean {
    return this.status === 404;
  }
}
