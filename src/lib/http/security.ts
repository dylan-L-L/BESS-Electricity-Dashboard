export class MutationSecurityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Cookie-authenticated writes must originate from this exact origin. Bearer
 * tokens are not ambient browser credentials, but they still use JSON only.
 */
export function assertTrustedJsonMutation(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new MutationSecurityError(
      "Content-Type must be application/json",
      415,
      "JSON_REQUIRED",
    );
  }

  if (/^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "")) return;

  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    throw new MutationSecurityError(
      "Cross-origin admin mutation rejected",
      403,
      "UNTRUSTED_ORIGIN",
    );
  }
}

/**
 * File uploads use multipart/form-data but keep the same exact-origin CSRF
 * boundary as the existing cookie-authenticated JSON mutations.
 */
export function assertTrustedMultipartMutation(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new MutationSecurityError(
      "Content-Type must be multipart/form-data",
      415,
      "MULTIPART_REQUIRED",
    );
  }

  if (/^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "")) return;

  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    throw new MutationSecurityError(
      "Cross-origin admin mutation rejected",
      403,
      "UNTRUSTED_ORIGIN",
    );
  }
}
