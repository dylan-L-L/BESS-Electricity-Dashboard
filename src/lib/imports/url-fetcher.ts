import { lookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";

import ipaddr from "ipaddr.js";
import { Client } from "undici";

export const DEFAULT_URL_FETCH_LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 3,
  connectTimeoutMs: 10_000,
  headersTimeoutMs: 10_000,
  bodyTimeoutMs: 20_000,
  totalTimeoutMs: 30_000,
} as const;

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal"];
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

export type UrlFetchErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "URL_CREDENTIALS_FORBIDDEN"
  | "PORT_FORBIDDEN"
  | "HOST_FORBIDDEN"
  | "DNS_LOOKUP_FAILED"
  | "NON_PUBLIC_ADDRESS"
  | "TOO_MANY_REDIRECTS"
  | "REDIRECT_WITHOUT_LOCATION"
  | "HTTP_ERROR"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "UNSUPPORTED_CONTENT_ENCODING"
  | "RESPONSE_TOO_LARGE"
  | "TIMEOUT"
  | "NETWORK_ERROR";

export class UrlFetchError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    readonly code: UrlFetchErrorCode,
    message: string,
    readonly cause?: unknown,
    readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = "UrlFetchError";
    const retryableHttpStatus =
      code === "HTTP_ERROR" &&
      upstreamStatus !== undefined &&
      (upstreamStatus === 408 ||
        upstreamStatus === 429 ||
        (upstreamStatus >= 500 && upstreamStatus <= 599));
    this.retryable =
      retryableHttpStatus ||
      ["DNS_LOOKUP_FAILED", "TIMEOUT", "NETWORK_ERROR"].includes(code);
    this.status = this.retryable ? 502 : 422;
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface DnsResolver {
  resolve(hostname: string): Promise<ResolvedAddress[]>;
}

export interface PinnedHttpRequest {
  url: URL;
  address: ResolvedAddress;
  headers: Readonly<Record<string, string>>;
  signal: AbortSignal;
  connectTimeoutMs: number;
  headersTimeoutMs: number;
  bodyTimeoutMs: number;
  maxBytes: number;
}

export interface HttpTransportResponse {
  status: number;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: AsyncIterable<Uint8Array>;
  close?: () => void | Promise<void>;
}

export interface HttpTransport {
  request(request: PinnedHttpRequest): Promise<HttpTransportResponse>;
}

export interface SafeUrlFetcherOptions {
  resolver?: DnsResolver;
  transport?: HttpTransport;
  maxBytes?: number;
  maxRedirects?: number;
  connectTimeoutMs?: number;
  headersTimeoutMs?: number;
  bodyTimeoutMs?: number;
  totalTimeoutMs?: number;
  userAgent?: string;
}

interface UrlFetchLimits {
  maxBytes: number;
  maxRedirects: number;
  connectTimeoutMs: number;
  headersTimeoutMs: number;
  bodyTimeoutMs: number;
  totalTimeoutMs: number;
}

export interface SafeUrlFetchResult {
  requestedUrl: string;
  normalizedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  status: number;
  contentType: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  body: Uint8Array;
}

class NodeDnsResolver implements DnsResolver {
  async resolve(hostname: string): Promise<ResolvedAddress[]> {
    try {
      const records = await lookup(hostname, { all: true, verbatim: true });
      return records
        .filter(
          (record): record is { address: string; family: 4 | 6 } =>
            record.family === 4 || record.family === 6,
        )
        .map(({ address, family }) => ({ address, family }));
    } catch (error) {
      throw new UrlFetchError(
        "DNS_LOOKUP_FAILED",
        `无法解析主机 ${hostname}`,
        error,
      );
    }
  }
}

class UndiciPinnedTransport implements HttpTransport {
  async request(request: PinnedHttpRequest): Promise<HttpTransportResponse> {
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) {
        callback(null, [request.address]);
        return;
      }

      callback(null, request.address.address, request.address.family);
    };

    const client = new Client(request.url.origin, {
      connect: {
        lookup: pinnedLookup,
        timeout: request.connectTimeoutMs,
      },
      headersTimeout: request.headersTimeoutMs,
      bodyTimeout: request.bodyTimeoutMs,
      maxResponseSize: request.maxBytes,
      pipelining: 0,
    });

    try {
      const response = await client.request({
        method: "GET",
        path: `${request.url.pathname}${request.url.search}`,
        headers: request.headers,
        signal: request.signal,
        maxRedirections: 0,
        headersTimeout: request.headersTimeoutMs,
        bodyTimeout: request.bodyTimeoutMs,
      });

      return {
        status: response.statusCode,
        headers: response.headers,
        body: response.body,
        close: async () => {
          response.body.destroy();
          await client.destroy();
        },
      };
    } catch (error) {
      await client.destroy().catch(() => undefined);
      throw error;
    }
  }
}

function hostnameWithoutBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostnameWithoutBrackets(hostname)
    .toLowerCase()
    .replace(/\.$/, "");

  return (
    BLOCKED_HOSTS.has(normalized) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

/** Only globally-routable unicast addresses are accepted. */
export function isPublicIpAddress(input: string): boolean {
  const value = hostnameWithoutBrackets(input).split("%")[0];

  try {
    let address = ipaddr.parse(value);
    if (
      "isIPv4MappedAddress" in address &&
      address.isIPv4MappedAddress()
    ) {
      address = address.toIPv4Address();
    }
    return address.range() === "unicast";
  } catch {
    return false;
  }
}

export function normalizeImportUrl(input: string): string {
  if (input.trim().length > 4_096) {
    throw new UrlFetchError("INVALID_URL", "URL 长度不能超过 4096 个字符");
  }
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch (error) {
    throw new UrlFetchError("INVALID_URL", "请输入有效的网页 URL", error);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlFetchError(
      "UNSUPPORTED_PROTOCOL",
      "URL 仅支持 HTTP 或 HTTPS",
    );
  }
  if (url.username || url.password) {
    throw new UrlFetchError(
      "URL_CREDENTIALS_FORBIDDEN",
      "URL 不能包含用户名或密码",
    );
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new UrlFetchError(
      "PORT_FORBIDDEN",
      "URL 仅允许使用 80 或 443 端口",
    );
  }

  const hostname = hostnameWithoutBrackets(url.hostname)
    .toLowerCase()
    .replace(/\.$/, "");
  if (!hostname || isBlockedHostname(hostname)) {
    throw new UrlFetchError("HOST_FORBIDDEN", "该主机不允许导入");
  }

  // Reassigning hostname also removes a trailing dot while preserving IDNA.
  url.hostname = hostname;
  url.hash = "";
  if (!url.pathname) url.pathname = "/";
  const normalized = url.toString();
  if (normalized.length > 4_096) {
    throw new UrlFetchError("INVALID_URL", "URL 长度不能超过 4096 个字符");
  }
  return normalized;
}

export async function resolvePublicTarget(
  url: URL,
  resolver: DnsResolver,
): Promise<ResolvedAddress[]> {
  const hostname = hostnameWithoutBrackets(url.hostname);
  const literalFamily = ipaddr.isValid(hostname)
    ? ipaddr.parse(hostname).kind() === "ipv4"
      ? 4
      : 6
    : null;
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await resolver.resolve(hostname);

  if (addresses.length === 0) {
    throw new UrlFetchError(
      "DNS_LOOKUP_FAILED",
      `主机 ${hostname} 没有可用的 IP 地址`,
    );
  }

  const unsafe = addresses.find(({ address }) => !isPublicIpAddress(address));
  if (unsafe) {
    throw new UrlFetchError(
      "NON_PUBLIC_ADDRESS",
      `主机 ${hostname} 解析到了非公网地址`,
    );
  }

  return addresses;
}

function getHeader(
  headers: Readonly<Record<string, string | string[] | undefined>>,
  name: string,
): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readLimitedBody(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maxBytes) {
      throw new UrlFetchError(
        "RESPONSE_TOO_LARGE",
        `网页内容超过 ${maxBytes} 字节限制`,
      );
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, total);
}

export class SafeUrlFetcher {
  private readonly resolver: DnsResolver;
  private readonly transport: HttpTransport;
  private readonly limits: UrlFetchLimits;
  private readonly userAgent: string;

  constructor(options: SafeUrlFetcherOptions = {}) {
    this.resolver = options.resolver ?? new NodeDnsResolver();
    this.transport = options.transport ?? new UndiciPinnedTransport();
    this.limits = {
      maxBytes: options.maxBytes ?? DEFAULT_URL_FETCH_LIMITS.maxBytes,
      maxRedirects:
        options.maxRedirects ?? DEFAULT_URL_FETCH_LIMITS.maxRedirects,
      connectTimeoutMs:
        options.connectTimeoutMs ?? DEFAULT_URL_FETCH_LIMITS.connectTimeoutMs,
      headersTimeoutMs:
        options.headersTimeoutMs ?? DEFAULT_URL_FETCH_LIMITS.headersTimeoutMs,
      bodyTimeoutMs:
        options.bodyTimeoutMs ?? DEFAULT_URL_FETCH_LIMITS.bodyTimeoutMs,
      totalTimeoutMs:
        options.totalTimeoutMs ?? DEFAULT_URL_FETCH_LIMITS.totalTimeoutMs,
    };
    this.userAgent =
      options.userAgent ?? "GridLedgerImporter/1.0 (+https://grid-ledger.invalid)";
  }

  async fetch(input: string): Promise<SafeUrlFetchResult> {
    const requestedUrl = input;
    const normalizedUrl = normalizeImportUrl(input);
    let currentUrl = new URL(normalizedUrl);
    const redirectChain: string[] = [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.limits.totalTimeoutMs);
    timeout.unref?.();

    try {
      for (let redirectCount = 0; ; redirectCount += 1) {
        const addresses = await resolvePublicTarget(currentUrl, this.resolver);
        // The actual socket is pinned to this already-validated address.
        const address = addresses[0];
        const response = await this.transport.request({
          url: currentUrl,
          address,
          signal: controller.signal,
          connectTimeoutMs: this.limits.connectTimeoutMs,
          headersTimeoutMs: this.limits.headersTimeoutMs,
          bodyTimeoutMs: this.limits.bodyTimeoutMs,
          maxBytes: this.limits.maxBytes,
          headers: {
            accept: "text/html,application/xhtml+xml;q=0.9",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.5",
            "accept-encoding": "identity",
            "user-agent": this.userAgent,
          },
        });

        try {
          if (isRedirectStatus(response.status)) {
            if (redirectCount >= this.limits.maxRedirects) {
              throw new UrlFetchError(
                "TOO_MANY_REDIRECTS",
                `网页重定向次数超过 ${this.limits.maxRedirects} 次`,
              );
            }
            const location = getHeader(response.headers, "location");
            if (!location) {
              throw new UrlFetchError(
                "REDIRECT_WITHOUT_LOCATION",
                "网页返回重定向但没有 Location",
              );
            }
            const redirected = normalizeImportUrl(
              new URL(location, currentUrl).toString(),
            );
            currentUrl = new URL(redirected);
            redirectChain.push(redirected);
            continue;
          }

          if (response.status < 200 || response.status >= 300) {
            throw new UrlFetchError(
              "HTTP_ERROR",
              `网页返回 HTTP ${response.status}`,
              undefined,
              response.status,
            );
          }

          const contentEncoding = (
            getHeader(response.headers, "content-encoding") ?? "identity"
          ).toLowerCase();
          if (contentEncoding !== "identity") {
            throw new UrlFetchError(
              "UNSUPPORTED_CONTENT_ENCODING",
              `网页返回了不支持的压缩格式 ${contentEncoding}`,
            );
          }

          const contentType = (
            getHeader(response.headers, "content-type") ?? ""
          ).toLowerCase();
          if (
            !contentType.startsWith("text/html") &&
            !contentType.startsWith("application/xhtml+xml")
          ) {
            throw new UrlFetchError(
              "UNSUPPORTED_CONTENT_TYPE",
              "URL 没有返回 HTML 网页",
            );
          }

          const contentLength = getHeader(response.headers, "content-length");
          if (contentLength && /^\d+$/.test(contentLength)) {
            if (Number(contentLength) > this.limits.maxBytes) {
              throw new UrlFetchError(
                "RESPONSE_TOO_LARGE",
                `网页内容超过 ${this.limits.maxBytes} 字节限制`,
              );
            }
          }

          const body = await readLimitedBody(
            response.body,
            this.limits.maxBytes,
          );
          return {
            requestedUrl,
            normalizedUrl,
            finalUrl: currentUrl.toString(),
            redirectChain,
            status: response.status,
            contentType,
            headers: response.headers,
            body,
          };
        } finally {
          await response.close?.();
        }
      }
    } catch (error) {
      if (error instanceof UrlFetchError) throw error;
      if (controller.signal.aborted) {
        throw new UrlFetchError("TIMEOUT", "网页读取超时", error);
      }
      throw new UrlFetchError("NETWORK_ERROR", "网页读取失败", error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
