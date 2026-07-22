import { describe, expect, it } from "vitest";

import {
  assertTrustedJsonMutation,
  assertTrustedMultipartMutation,
} from "@/lib/http/security";

describe("admin mutation request boundary", () => {
  it("accepts same-origin JSON cookie requests", () => {
    const request = new Request("https://grid-ledger.example/api/admin/signals", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://grid-ledger.example" },
    });
    expect(() => assertTrustedJsonMutation(request)).not.toThrow();
  });

  it("accepts JSON bearer requests without an Origin header", () => {
    const request = new Request("https://grid-ledger.example/api/admin/signals", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-token" },
    });
    expect(() => assertTrustedJsonMutation(request)).not.toThrow();
  });

  it("rejects text/plain and cross-origin cookie requests", () => {
    const plain = new Request("https://grid-ledger.example/api/admin/signals", {
      method: "POST",
      headers: { "content-type": "text/plain", origin: "https://grid-ledger.example" },
    });
    const crossOrigin = new Request("https://grid-ledger.example/api/admin/signals", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
    });
    expect(() => assertTrustedJsonMutation(plain)).toThrow(/application\/json/);
    expect(() => assertTrustedJsonMutation(crossOrigin)).toThrow(/Cross-origin/);
  });

  it("accepts only same-origin multipart uploads for cookie sessions", () => {
    const trusted = new Request("https://grid-ledger.example/api/admin/imports", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        origin: "https://grid-ledger.example",
      },
    });
    const crossOrigin = new Request("https://grid-ledger.example/api/admin/imports", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test",
        origin: "https://evil.example",
      },
    });

    expect(() => assertTrustedMultipartMutation(trusted)).not.toThrow();
    expect(() => assertTrustedMultipartMutation(crossOrigin)).toThrow(/Cross-origin/);
  });
});
