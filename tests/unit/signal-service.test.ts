import { describe, expect, it } from "vitest";

import {
  AuthenticationRequiredError,
  ForbiddenError,
  PublishValidationError,
} from "../../src/lib/domain/errors";
import {
  formatMetricValue,
  formatNullable,
} from "../../src/lib/domain/format";
import {
  NORMALIZED_STATUS_LABELS,
  normalizedStatusLabel,
} from "../../src/lib/domain/status";
import { SignalService } from "../../src/lib/services/signal-service";
import type { Actor } from "../../src/lib/types";
import {
  formatNullableNumber as formatPublicMetric,
  normalizedStatusLabel as publicStatusLabel,
} from "../../src/components/public/formatters";
import {
  InMemorySignalRepository,
  LeakyPublicSignalRepository,
  makeSignal,
} from "../helpers/in-memory-signal-repository";

const admin: Actor = { id: "admin-1", role: "admin" };
const viewer: Actor = { id: "viewer-1", role: "viewer" };
const fixedClock = () => new Date("2026-07-22T09:30:00.000Z");

describe("SignalService authorization", () => {
  it("rejects publishing when the user is not logged in", async () => {
    const repository = new InMemorySignalRepository([makeSignal()]);
    const service = new SignalService(repository, fixedClock);

    await expect(
      service.publish(null, "signal-fixture", "Human checked"),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });

  it("rejects publishing when the user is not an administrator", async () => {
    const repository = new InMemorySignalRepository([makeSignal()]);
    const service = new SignalService(repository, fixedClock);

    await expect(
      service.publish(viewer, "signal-fixture", "Human checked"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("public signal boundary", () => {
  it("returns published signals only, even if a repository leaks rows", async () => {
    const repository = new LeakyPublicSignalRepository([
      makeSignal({ id: "published", review_status: "published" }),
      makeSignal({ id: "pending", review_status: "pending_review" }),
      makeSignal({ id: "ai-draft", review_status: "ai_draft" }),
      makeSignal({ id: "rejected", review_status: "rejected" }),
    ]);
    const service = new SignalService(repository, fixedClock);

    const result = await service.listPublic();

    expect(result.map((signal) => signal.id)).toEqual(["published"]);
  });

  it("does not expose a draft through the public detail method", async () => {
    const repository = new LeakyPublicSignalRepository([
      makeSignal({ id: "draft", review_status: "pending_review" }),
    ]);
    const service = new SignalService(repository, fixedClock);

    await expect(service.getPublicById("draft")).resolves.toBeNull();
  });
});

describe("publication validation", () => {
  it("does not publish when required fields are missing", async () => {
    const repository = new InMemorySignalRepository();
    const service = new SignalService(repository, fixedClock);
    const draft = await service.saveDraft(admin, {
      title: "Incomplete policy",
      normalized_status: null,
    });

    await expect(
      service.publish(admin, draft.id, "I reviewed this manually"),
    ).rejects.toBeInstanceOf(PublishValidationError);

    expect((await repository.getAdminById(draft.id))?.review_status).toBe(
      "pending_review",
    );
  });

  it("records reviewer identity, review time and confirmation on publish", async () => {
    const repository = new InMemorySignalRepository([
      makeSignal({
        id: "ready",
        review_status: "pending_review",
        published_at: null,
        reviewer_id: null,
        reviewed_at: null,
        reviewer_note: null,
      }),
    ]);
    const service = new SignalService(repository, fixedClock);

    const published = await service.publish(
      admin,
      "ready",
      "  Source and status manually confirmed  ",
    );

    expect(published).toMatchObject({
      review_status: "published",
      reviewer_id: "admin-1",
      reviewer_note: "Source and status manually confirmed",
      reviewed_at: "2026-07-22T09:30:00.000Z",
      published_at: "2026-07-22T09:30:00.000Z",
    });
  });

  it("rejects a signal with an explicit human reason and removes publication", async () => {
    const repository = new InMemorySignalRepository([makeSignal({ id: "bad" })]);
    const service = new SignalService(repository, fixedClock);

    const rejected = await service.reject(
      admin,
      "bad",
      "Source does not support the claimed status",
    );

    expect(rejected).toMatchObject({
      review_status: "rejected",
      published_at: null,
      reviewer_id: "admin-1",
      reviewed_at: "2026-07-22T09:30:00.000Z",
      reviewer_note: "Source does not support the claimed status",
    });
    await expect(service.getPublicById("bad")).resolves.toBeNull();
  });

  it("will not publish a non-HTTP source link", async () => {
    const repository = new InMemorySignalRepository([
      makeSignal({
        id: "unsafe-source",
        review_status: "pending_review",
        source_url: "javascript:alert(1)",
      }),
    ]);
    const service = new SignalService(repository, fixedClock);

    await expect(
      service.publish(admin, "unsafe-source", "Checked"),
    ).rejects.toBeInstanceOf(PublishValidationError);
  });
});

describe("display semantics", () => {
  it("formats null as an em dash and preserves a real zero", () => {
    expect(formatNullable(null)).toBe("—");
    expect(formatNullable(0)).toBe("0");
    expect(formatMetricValue(null, "GW")).toBe("—");
    expect(formatMetricValue(0, "GW")).toBe("0 GW");
    expect(formatPublicMetric(null)).toBe("—");
    expect(formatPublicMetric(0)).toBe("0");
  });

  it("keeps Draft, Filed, Approved and Effective as distinct labels", () => {
    expect([
      normalizedStatusLabel("draft"),
      normalizedStatusLabel("filed"),
      normalizedStatusLabel("approved"),
      normalizedStatusLabel("effective"),
    ]).toEqual(["Draft", "Filed", "Approved", "Effective"]);

    expect(new Set(Object.values(NORMALIZED_STATUS_LABELS)).size).toBe(
      Object.values(NORMALIZED_STATUS_LABELS).length,
    );

    expect([
      publicStatusLabel("draft"),
      publicStatusLabel("filed"),
      publicStatusLabel("approved"),
      publicStatusLabel("effective"),
    ]).toEqual([
      "Draft / 草案",
      "Filed / 已提交",
      "Approved / 已批准",
      "Effective / 已生效",
    ]);
  });
});
