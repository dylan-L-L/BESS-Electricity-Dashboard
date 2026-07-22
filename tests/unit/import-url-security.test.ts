import { describe, expect, it } from "vitest";

import {
  SafeUrlFetcher,
  UrlFetchError,
  isPublicIpAddress,
  normalizeImportUrl,
  type DnsResolver,
  type HttpTransport,
  type HttpTransportResponse,
  type PinnedHttpRequest,
  type ResolvedAddress,
} from "../../src/lib/imports/url-fetcher";

class FakeResolver implements DnsResolver {
  constructor(private readonly records: Record<string, ResolvedAddress[]>) {}

  async resolve(hostname: string): Promise<ResolvedAddress[]> {
    return this.records[hostname] ?? [];
  }
}

async function* chunks(...values: string[]): AsyncIterable<Uint8Array> {
  for (const value of values) yield Buffer.from(value);
}

function fakeResponse(
  status: number,
  headers: Record<string, string> = {},
  values: string[] = [],
): HttpTransportResponse {
  return { status, headers, body: chunks(...values) };
}

class FakeTransport implements HttpTransport {
  readonly requests: PinnedHttpRequest[] = [];

  constructor(
    private readonly handler: (
      request: PinnedHttpRequest,
      index: number,
    ) => Promise<HttpTransportResponse> | HttpTransportResponse,
  ) {}

  async request(request: PinnedHttpRequest): Promise<HttpTransportResponse> {
    this.requests.push(request);
    return this.handler(request, this.requests.length - 1);
  }
}

function expectCode(code: string) {
  return (error: unknown) => {
    expect(error).toBeInstanceOf(UrlFetchError);
    expect((error as UrlFetchError).code).toBe(code);
    return true;
  };
}

describe("URL import security", () => {
  it("normalizes HTTP URLs and rejects credentials, unsafe schemes and ports", () => {
    expect(
      normalizeImportUrl("  HTTPS://Example.COM:443/a/../policy?q=1#section  "),
    ).toBe("https://example.com/policy?q=1");
    expect(() => normalizeImportUrl("ftp://example.com/a")).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_PROTOCOL" }),
    );
    expect(() => normalizeImportUrl("https://a:b@example.com/")).toThrowError(
      expect.objectContaining({ code: "URL_CREDENTIALS_FORBIDDEN" }),
    );
    expect(() => normalizeImportUrl("https://example.com:8080/")).toThrowError(
      expect.objectContaining({ code: "PORT_FORBIDDEN" }),
    );
    expect(() => normalizeImportUrl("http://localhost/")).toThrowError(
      expect.objectContaining({ code: "HOST_FORBIDDEN" }),
    );
  });

  it("classifies IPv4, IPv6 and IPv4-mapped IPv6 addresses", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
    ]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
  });

  it("rejects a hostname if any DNS result is non-public", async () => {
    const transport = new FakeTransport(() => {
      throw new Error("transport must not be called");
    });
    const fetcher = new SafeUrlFetcher({
      resolver: new FakeResolver({
        "mixed.example": [
          { address: "93.184.216.34", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ],
      }),
      transport,
    });

    await expect(fetcher.fetch("https://mixed.example/a")).rejects.toSatisfy(
      expectCode("NON_PUBLIC_ADDRESS"),
    );
    expect(transport.requests).toHaveLength(0);
  });

  it("pins the request to a validated address and sends no credentials", async () => {
    const transport = new FakeTransport(() =>
      fakeResponse(
        200,
        { "content-type": "text/html; charset=utf-8" },
        ["<article>ok</article>"],
      ),
    );
    const fetcher = new SafeUrlFetcher({
      resolver: new FakeResolver({
        "policy.example": [{ address: "93.184.216.34", family: 4 }],
      }),
      transport,
    });

    const result = await fetcher.fetch("https://policy.example/document");
    expect(Buffer.from(result.body).toString()).toContain("ok");
    expect(transport.requests[0].address).toEqual({
      address: "93.184.216.34",
      family: 4,
    });
    expect(transport.requests[0].headers).not.toHaveProperty("cookie");
    expect(transport.requests[0].headers).not.toHaveProperty("authorization");
    expect(transport.requests[0].headers["accept-encoding"]).toBe("identity");
  });

  it("revalidates every redirect and blocks a redirect to a private host", async () => {
    const transport = new FakeTransport(() =>
      fakeResponse(302, { location: "http://private.example/metadata" }),
    );
    const fetcher = new SafeUrlFetcher({
      resolver: new FakeResolver({
        "public.example": [{ address: "93.184.216.34", family: 4 }],
        "private.example": [{ address: "169.254.169.254", family: 4 }],
      }),
      transport,
    });

    await expect(fetcher.fetch("https://public.example/start")).rejects.toSatisfy(
      expectCode("NON_PUBLIC_ADDRESS"),
    );
    expect(transport.requests).toHaveLength(1);
  });

  it("follows a bounded safe redirect and validates the final HTML", async () => {
    const transport = new FakeTransport((_request, index) =>
      index === 0
        ? fakeResponse(302, { location: "/final" })
        : fakeResponse(200, { "content-type": "text/html" }, ["done"]),
    );
    const fetcher = new SafeUrlFetcher({
      resolver: new FakeResolver({
        "public.example": [{ address: "93.184.216.34", family: 4 }],
      }),
      transport,
    });

    const result = await fetcher.fetch("https://public.example/start");
    expect(result.finalUrl).toBe("https://public.example/final");
    expect(result.redirectChain).toEqual(["https://public.example/final"]);
    expect(transport.requests).toHaveLength(2);
  });

  it.each([408, 429, 500, 503, 599])(
    "marks upstream HTTP %i as retryable while preserving its status",
    async (upstreamStatus) => {
      const fetcher = new SafeUrlFetcher({
        resolver: new FakeResolver({
          "public.example": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: new FakeTransport(() => fakeResponse(upstreamStatus)),
      });

      await expect(fetcher.fetch("https://public.example/")).rejects.toMatchObject({
        code: "HTTP_ERROR",
        retryable: true,
        status: 502,
        upstreamStatus,
        message: `网页返回 HTTP ${upstreamStatus}`,
      });
    },
  );

  it.each([400, 401, 403, 404, 422])(
    "keeps upstream HTTP %i non-retryable and maps it to 422",
    async (upstreamStatus) => {
      const fetcher = new SafeUrlFetcher({
        resolver: new FakeResolver({
          "public.example": [{ address: "93.184.216.34", family: 4 }],
        }),
        transport: new FakeTransport(() => fakeResponse(upstreamStatus)),
      });

      await expect(fetcher.fetch("https://public.example/")).rejects.toMatchObject({
        code: "HTTP_ERROR",
        retryable: false,
        status: 422,
        upstreamStatus,
        message: `网页返回 HTTP ${upstreamStatus}`,
      });
    },
  );

  it("rejects oversized responses from headers and from streamed bytes", async () => {
    const resolver = new FakeResolver({
      "public.example": [{ address: "93.184.216.34", family: 4 }],
    });
    const byHeader = new SafeUrlFetcher({
      resolver,
      maxBytes: 4,
      transport: new FakeTransport(() =>
        fakeResponse(200, {
          "content-type": "text/html",
          "content-length": "5",
        }),
      ),
    });
    await expect(byHeader.fetch("https://public.example/")).rejects.toSatisfy(
      expectCode("RESPONSE_TOO_LARGE"),
    );

    const byStream = new SafeUrlFetcher({
      resolver,
      maxBytes: 4,
      transport: new FakeTransport(() =>
        fakeResponse(200, { "content-type": "text/html" }, ["12", "345"]),
      ),
    });
    await expect(byStream.fetch("https://public.example/")).rejects.toSatisfy(
      expectCode("RESPONSE_TOO_LARGE"),
    );
  });

  it("turns an aborted transport into a deterministic timeout error", async () => {
    const transport = new FakeTransport(
      (request) =>
        new Promise<HttpTransportResponse>((_resolve, reject) => {
          request.signal.addEventListener("abort", () => reject(new Error("abort")), {
            once: true,
          });
        }),
    );
    const fetcher = new SafeUrlFetcher({
      resolver: new FakeResolver({
        "public.example": [{ address: "93.184.216.34", family: 4 }],
      }),
      transport,
      totalTimeoutMs: 5,
    });

    await expect(fetcher.fetch("https://public.example/")).rejects.toSatisfy(
      expectCode("TIMEOUT"),
    );
  });
});
