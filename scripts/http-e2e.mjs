import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const required = [
  "APP_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const appUrl = process.env.APP_URL.replace(/\/$/, "");
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `grid-ledger-e2e-${runId}@example.com`;
const password = `E2E-${runId}-Strong!`;

const authAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicAnon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
let signalId;
let adminDb;

async function json(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  const { data: created, error: createError } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  assert.ifError(createError);
  assert.ok(created.user?.id, "Supabase Auth should create the E2E admin");
  userId = created.user.id;

  const { data: login, error: loginError } = await anon.auth.signInWithPassword({ email, password });
  assert.ifError(loginError);
  assert.ok(login.session?.access_token, "Admin login should return a real access token");
  const accessToken = login.session.access_token;
  const bearerHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
  adminDb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anonymousAdminPage = await fetch(`${appUrl}/admin`, { redirect: "manual" });
  assert.ok([303, 307, 308].includes(anonymousAdminPage.status));
  assert.equal(new URL(anonymousAdminPage.headers.get("location"), appUrl).pathname, "/admin/login");

  const anonymousAdminApi = await json(`${appUrl}/api/admin/signals`);
  assert.equal(anonymousAdminApi.response.status, 401);

  const authorizedAdminPage = await fetch(`${appUrl}/admin`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(authorizedAdminPage.status, 200);
  assert.match(await authorizedAdminPage.text(), /管理员工作台/);

  const regionsResult = await json(`${appUrl}/api/public/regions`);
  assert.equal(regionsResult.response.status, 200);
  const shandong = regionsResult.body.data.find((region) => region.slug === "shandong");
  assert.ok(shandong?.id, "Shandong seed region should exist");

  const title = `DEMO 山东 HTTP E2E ${runId}`;
  const sourceUrl = `${appUrl}/api/public/regions`;
  const draftResult = await json(`${appUrl}/api/admin/signals`, {
    method: "POST",
    headers: bearerHeaders,
    body: JSON.stringify({
      region_id: shandong.id,
      signal_type: "policy",
      title,
      summary: "仅用于真实 HTTP/Supabase 端到端测试，不代表真实政策或市场数据。",
      category: "E2E Demo",
      original_status: "Filed",
      normalized_status: "filed",
      event_date: "2026-07-22",
      source_url: sourceUrl,
      source_name: "Grid Ledger local E2E source",
      reviewer_note: "",
      is_demo: true,
    }),
  });
  assert.equal(draftResult.response.status, 201, JSON.stringify(draftResult.body));
  signalId = draftResult.body.data.id;
  assert.equal(draftResult.body.data.review_status, "pending_review");

  const draftDetail = await fetch(`${appUrl}/api/public/signals/${signalId}`);
  assert.equal(draftDetail.status, 404);
  const draftList = await json(`${appUrl}/api/public/signals?region_id=${shandong.id}`);
  assert.equal(draftList.response.status, 200);
  assert.ok(!draftList.body.data.some((signal) => signal.id === signalId));

  const { data: anonymousRows, error: anonymousReadError } = await publicAnon
    .from("signals")
    .select("id,review_status")
    .eq("id", signalId);
  assert.ifError(anonymousReadError);
  assert.deepEqual(anonymousRows, [], "RLS must hide the draft from direct Data API reads");

  const { error: invalidPublishError } = await adminDb
    .from("signals")
    .update({ review_status: "published" })
    .eq("id", signalId);
  assert.ok(invalidPublishError, "The database publication constraint must reject missing human confirmation");

  const publishResult = await json(`${appUrl}/api/admin/signals/${signalId}/publish`, {
    method: "POST",
    headers: bearerHeaders,
    body: JSON.stringify({ reviewer_note: "已人工确认地区、状态、摘要和原文链接" }),
  });
  assert.equal(publishResult.response.status, 200, JSON.stringify(publishResult.body));
  assert.equal(publishResult.body.data.review_status, "published");
  assert.equal(publishResult.body.data.reviewer_id, userId);

  const publishedList = await json(`${appUrl}/api/public/signals?region_id=${shandong.id}&q=${encodeURIComponent(runId)}`);
  assert.equal(publishedList.response.status, 200);
  const publicSignal = publishedList.body.data.find((signal) => signal.id === signalId);
  assert.ok(publicSignal, "Published Signal should be visible on the Shandong public query");
  assert.equal("reviewer_id" in publicSignal, false, "Viewer API must omit internal reviewer UUIDs");
  assert.equal("created_by" in publicSignal, false, "Viewer API must omit creator UUIDs");

  const regionPage = await fetch(`${appUrl}/regions/shandong`);
  assert.equal(regionPage.status, 200);
  assert.match(await regionPage.text(), new RegExp(runId));

  const detailPage = await fetch(`${appUrl}/signals/${signalId}`);
  assert.equal(detailPage.status, 200);
  const detailHtml = await detailPage.text();
  assert.match(detailHtml, new RegExp(runId));
  assert.ok(detailHtml.includes(sourceUrl), "Detail page should render the original-source link");

  const originalSource = await fetch(sourceUrl);
  assert.equal(originalSource.status, 200, "The original-source link should be visitable");

  process.stdout.write("HTTP E2E passed: Auth → draft isolation → publish → Shandong page → source link\n");
} finally {
  if (signalId && adminDb) {
    await adminDb.from("signals").delete().eq("id", signalId);
  }
  if (userId) {
    await authAdmin.auth.admin.deleteUser(userId);
  }
}
