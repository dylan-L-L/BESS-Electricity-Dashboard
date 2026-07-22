import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

const required = [
  "APP_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const appUrl = process.env.APP_URL.replace(/\/$/, "");
const appOrigin = new URL(appUrl).origin;
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `grid-ledger-import-e2e-${runId}@example.com`;
const password = `Import-E2E-${runId}-Strong!`;
const metricKey = `e2e_import_${runId.replaceAll("-", "_")}`;

function clientOptions(authorization) {
  return {
    global: {
      headers: {
        Origin: appOrigin,
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  };
}

const service = createClient(supabaseUrl, serviceRoleKey, clientOptions());
const anon = createClient(supabaseUrl, anonKey, clientOptions());
const publicAnon = createClient(supabaseUrl, anonKey, clientOptions());

let userId;
let viewerUserId;
let jobId;
let itemId;
let metricId;
let storagePath;
let signalJobId;
let signalItemId;
let signalId;
let signalStoragePath;
let updatedWorkbookJobId;
let updatedWorkbookStoragePath;
let updatedWorkbookItemId;
let correctedWorkbookJobId;
let correctedWorkbookStoragePath;
let adminDb;
let testError;
const cleanupErrors = [];

async function request(path, init = {}) {
  return fetch(`${appUrl}${path}`, {
    ...init,
    headers: {
      Origin: appOrigin,
      ...(init.headers ?? {}),
    },
  });
}

async function json(path, init = {}) {
  const response = await request(path, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function cleanupStep(label, operation) {
  try {
    const result = await operation();
    if (result?.error) throw result.error;
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    cleanupErrors.push(`${label}: ${detail}`);
  }
}

try {
  const { data: created, error: createError } =
    await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
  assert.ifError(createError);
  assert.ok(created.user?.id, "Supabase Auth should create the temporary import admin");
  userId = created.user.id;

  const { data: login, error: loginError } =
    await anon.auth.signInWithPassword({ email, password });
  assert.ifError(loginError);
  assert.ok(login.session?.access_token, "Admin login should return a real access token");
  const accessToken = login.session.access_token;
  const bearerHeaders = { Authorization: `Bearer ${accessToken}` };
  const jsonHeaders = {
    ...bearerHeaders,
    "content-type": "application/json",
  };
  adminDb = createClient(supabaseUrl, anonKey, clientOptions(accessToken));

  const viewerEmail = `grid-ledger-import-viewer-e2e-${runId}@example.com`;
  const { data: createdViewer, error: createViewerError } =
    await service.auth.admin.createUser({
      email: viewerEmail,
      password,
      email_confirm: true,
    });
  assert.ifError(createViewerError);
  assert.ok(createdViewer.user?.id, "Supabase Auth should create a non-admin user");
  viewerUserId = createdViewer.user.id;
  const viewerAuth = createClient(supabaseUrl, anonKey, clientOptions());
  const { data: viewerLogin, error: viewerLoginError } =
    await viewerAuth.auth.signInWithPassword({ email: viewerEmail, password });
  assert.ifError(viewerLoginError);
  assert.ok(
    viewerLogin.session?.access_token,
    "Non-admin login should return a real access token",
  );
  const viewerJsonHeaders = {
    Authorization: `Bearer ${viewerLogin.session.access_token}`,
    "content-type": "application/json",
  };

  const anonymousForm = new FormData();
  anonymousForm.set("input_type", "excel");
  anonymousForm.set("file", new Blob(["header\nvalue\n"], { type: "text/csv" }), "anonymous.csv");
  const anonymousImport = await json("/api/admin/imports", {
    method: "POST",
    body: anonymousForm,
  });
  assert.equal(
    anonymousImport.response.status,
    401,
    `Anonymous import should be rejected: ${JSON.stringify(anonymousImport.body)}`,
  );

  const regionsResult = await json("/api/public/regions");
  assert.equal(regionsResult.response.status, 200, JSON.stringify(regionsResult.body));
  const shandong = regionsResult.body.data.find(
    (region) => region.code === "CN-SD" || region.slug === "shandong",
  );
  assert.ok(shandong?.id, "Shandong seed region should exist");

  const sourceUrl = `https://example.com/grid-ledger-import-e2e/${runId}`;
  const headers = [
    "region_code",
    "metric_key",
    "label",
    "value",
    "unit",
    "period_label",
    "as_of_date",
    "source_name",
    "source_url",
    "notes",
  ];
  const values = [
    "CN-SD",
    metricKey,
    `[E2E DEMO] 山东导入指标 ${runId}`,
    "0",
    "元/kW·月",
    "E2E",
    "2026-07-22",
    "Grid Ledger HTTP E2E synthetic CSV",
    sourceUrl,
    "仅用于端到端测试，不代表真实市场数据。",
  ];
  const csv = `${headers.map(csvCell).join(",")}\n${values.map(csvCell).join(",")}\n`;
  const uploadForm = new FormData();
  uploadForm.set("input_type", "excel");
  uploadForm.set(
    "file",
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `grid-ledger-import-e2e-${runId}.csv`,
  );
  const upload = await json("/api/admin/imports", {
    method: "POST",
    headers: bearerHeaders,
    body: uploadForm,
  });
  assert.equal(upload.response.status, 201, JSON.stringify(upload.body));
  assert.equal(upload.body.data.duplicate, false);
  const uploadedJob = upload.body.data.job;
  jobId = uploadedJob.id;
  storagePath = uploadedJob.storage_path;
  assert.equal(uploadedJob.input_type, "excel");
  assert.equal(uploadedJob.status, "pending");
  assert.ok(storagePath, "Uploaded CSV should be stored in the private import bucket");
  const preview = uploadedJob.input_metadata.workbook_preview;
  assert.equal(preview.sheets.length, 1);
  assert.equal(preview.sheets[0].name, "Sheet1");
  assert.deepEqual(preview.sheets[0].headers, headers);
  assert.equal(preview.sheets[0].rows[0].row_number, 2);
  assert.equal(preview.sheets[0].rows[0].values[3], 0);

  const beforeApproval = await json(
    `/api/public/market-metrics?region_id=${encodeURIComponent(shandong.id)}`,
  );
  assert.equal(beforeApproval.response.status, 200, JSON.stringify(beforeApproval.body));
  assert.ok(
    !beforeApproval.body.data.some((metric) => metric.metric_key === metricKey),
    "CSV staging data must not appear in the public market-metrics API",
  );

  const mapping = Object.fromEntries(headers.map((header) => [header, header]));
  const processed = await json(`/api/admin/imports/${jobId}/process`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      sheet_name: "Sheet1",
      target_type: "market_metric",
      mapping,
    }),
  });
  assert.equal(processed.response.status, 200, JSON.stringify(processed.body));
  assert.equal(processed.body.data.job.status, "review");

  const { data: stagedItems, error: stagedItemsError } = await adminDb
    .from("import_items")
    .select("*")
    .eq("import_job_id", jobId)
    .order("item_index");
  assert.ifError(stagedItemsError);
  assert.equal(stagedItems.length, 1, "One CSV data row should create one staging item");
  const stagedItem = stagedItems[0];
  itemId = stagedItem.id;
  assert.equal(stagedItem.review_status, "pending_review");
  assert.equal(stagedItem.target_type, "market_metric");
  assert.equal(stagedItem.sheet_name, "Sheet1");
  assert.equal(stagedItem.source_row_number, 2);
  assert.deepEqual(stagedItem.source_location, { sheet: "Sheet1", row: 2 });
  assert.equal(stagedItem.draft_data.metric_key, metricKey);
  assert.equal(stagedItem.draft_data.value, 0, "A CSV zero must remain numeric zero");
  assert.equal(stagedItem.ai_provider, null, "Deterministic CSV processing must not call AI");
  assert.equal(stagedItem.ai_model, null, "Deterministic CSV processing must not call AI");
  assert.equal(stagedItem.ai_response_id, null, "Deterministic CSV processing must not call AI");
  assert.equal(stagedItem.prompt_version, "deterministic-excel-mapping-v1");
  assert.equal(stagedItem.evidence[0].sheet, "Sheet1");
  assert.equal(stagedItem.evidence[0].row, 2);

  const duplicateForm = new FormData();
  duplicateForm.set("input_type", "excel");
  duplicateForm.set(
    "file",
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `same-content-different-name-${runId}.csv`,
  );
  const duplicateUpload = await json("/api/admin/imports", {
    method: "POST",
    headers: bearerHeaders,
    body: duplicateForm,
  });
  assert.equal(
    duplicateUpload.response.status,
    200,
    JSON.stringify(duplicateUpload.body),
  );
  assert.equal(duplicateUpload.body.data.duplicate, true);
  assert.equal(
    duplicateUpload.body.data.job.id,
    jobId,
    "The same CSV bytes must resolve to the original import job",
  );
  const { count: itemCountAfterDuplicate, error: duplicateCountError } =
    await adminDb
      .from("import_items")
      .select("id", { count: "exact", head: true })
      .eq("import_job_id", jobId);
  assert.ifError(duplicateCountError);
  assert.equal(
    itemCountAfterDuplicate,
    1,
    "Duplicate upload must not create another import item",
  );

  const updatedValues = [
    ...values,
  ];
  updatedValues[1] = `${metricKey}_updated`;
  updatedValues[2] = `[E2E DEMO] 山东导入指标新增行 ${runId}`;
  const updatedCsv = `${headers.map(csvCell).join(",")}\n${values.map(csvCell).join(",")}\n${updatedValues.map(csvCell).join(",")}\n`;
  const updatedWorkbookForm = new FormData();
  updatedWorkbookForm.set("input_type", "excel");
  updatedWorkbookForm.set(
    "file",
    new Blob([updatedCsv], { type: "text/csv;charset=utf-8" }),
    `grid-ledger-import-e2e-${runId}.csv`,
  );
  const updatedWorkbookUpload = await json("/api/admin/imports", {
    method: "POST",
    headers: bearerHeaders,
    body: updatedWorkbookForm,
  });
  assert.equal(
    updatedWorkbookUpload.response.status,
    201,
    JSON.stringify(updatedWorkbookUpload.body),
  );
  updatedWorkbookJobId = updatedWorkbookUpload.body.data.job.id;
  updatedWorkbookStoragePath = updatedWorkbookUpload.body.data.job.storage_path;
  assert.notEqual(updatedWorkbookJobId, jobId);

  const updatedWorkbookProcessed = await json(
    `/api/admin/imports/${updatedWorkbookJobId}/process`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        sheet_name: "Sheet1",
        target_type: "market_metric",
        mapping,
      }),
    },
  );
  assert.equal(
    updatedWorkbookProcessed.response.status,
    200,
    JSON.stringify(updatedWorkbookProcessed.body),
  );
  const rowDeduplication =
    updatedWorkbookProcessed.body.data.job.input_metadata.excel_row_deduplication;
  assert.equal(rowDeduplication.source_row_count, 2);
  assert.equal(rowDeduplication.skipped_duplicate_count, 1);
  assert.equal(rowDeduplication.created_item_count, 1);
  assert.deepEqual(rowDeduplication.historical_job_ids, [jobId]);
  assert.equal(rowDeduplication.skipped_rows[0].source_row_number, 2);

  const { data: updatedWorkbookItems, error: updatedWorkbookItemsError } =
    await adminDb
      .from("import_items")
      .select("*")
      .eq("import_job_id", updatedWorkbookJobId)
      .order("item_index");
  assert.ifError(updatedWorkbookItemsError);
  assert.equal(
    updatedWorkbookItems.length,
    1,
    "An updated same-source workbook should stage only its genuinely new row",
  );
  updatedWorkbookItemId = updatedWorkbookItems[0].id;
  assert.equal(updatedWorkbookItems[0].source_row_number, 3);
  assert.equal(updatedWorkbookItems[0].draft_data.metric_key, `${metricKey}_updated`);

  const rejectUpdatedRow = await json(
    `/api/admin/import-items/${updatedWorkbookItemId}/reject`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        reviewer_note: "E2E：模拟映射需要修正，拒绝后应允许相同原始行重新导入。",
      }),
    },
  );
  assert.equal(
    rejectUpdatedRow.response.status,
    200,
    JSON.stringify(rejectUpdatedRow.body),
  );

  const correctedValues = [...updatedValues];
  correctedValues[1] = `${metricKey}_corrected`;
  correctedValues[2] = `[E2E DEMO] 山东导入指标修正新增行 ${runId}`;
  const correctedCsv = `${headers.map(csvCell).join(",")}\n${values.map(csvCell).join(",")}\n${updatedValues.map(csvCell).join(",")}\n${correctedValues.map(csvCell).join(",")}\n`;
  const correctedWorkbookForm = new FormData();
  correctedWorkbookForm.set("input_type", "excel");
  correctedWorkbookForm.set(
    "file",
    new Blob([correctedCsv], { type: "text/csv;charset=utf-8" }),
    `grid-ledger-import-e2e-${runId}.csv`,
  );
  const correctedWorkbookUpload = await json("/api/admin/imports", {
    method: "POST",
    headers: bearerHeaders,
    body: correctedWorkbookForm,
  });
  assert.equal(
    correctedWorkbookUpload.response.status,
    201,
    JSON.stringify(correctedWorkbookUpload.body),
  );
  correctedWorkbookJobId = correctedWorkbookUpload.body.data.job.id;
  correctedWorkbookStoragePath = correctedWorkbookUpload.body.data.job.storage_path;

  const correctedWorkbookProcessed = await json(
    `/api/admin/imports/${correctedWorkbookJobId}/process`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        sheet_name: "Sheet1",
        target_type: "market_metric",
        mapping,
      }),
    },
  );
  assert.equal(
    correctedWorkbookProcessed.response.status,
    200,
    JSON.stringify(correctedWorkbookProcessed.body),
  );
  const correctedDeduplication =
    correctedWorkbookProcessed.body.data.job.input_metadata.excel_row_deduplication;
  assert.equal(correctedDeduplication.source_row_count, 3);
  assert.equal(correctedDeduplication.skipped_duplicate_count, 1);
  assert.equal(correctedDeduplication.created_item_count, 2);
  assert.equal(correctedDeduplication.skipped_rows[0].source_row_number, 2);

  const { data: correctedWorkbookItems, error: correctedWorkbookItemsError } =
    await adminDb
      .from("import_items")
      .select("id,source_row_number,draft_data")
      .eq("import_job_id", correctedWorkbookJobId)
      .order("item_index");
  assert.ifError(correctedWorkbookItemsError);
  assert.deepEqual(
    correctedWorkbookItems.map((item) => item.source_row_number),
    [3, 4],
    "Rejected row 3 must be eligible for re-import while active row 2 stays skipped",
  );

  const { data: anonymousItems, error: anonymousItemsError } = await publicAnon
    .from("import_items")
    .select("id")
    .eq("id", itemId);
  assert.ok(
    anonymousItemsError || anonymousItems?.length === 0,
    "Anonymous Data API access must not reveal private import_items",
  );
  const nonexistentPublicImportRoute = await request(`/api/public/import-items/${itemId}`);
  assert.equal(nonexistentPublicImportRoute.status, 404);

  const forbiddenApprove = await json(`/api/admin/import-items/${itemId}/approve`, {
    method: "POST",
    headers: viewerJsonHeaders,
    body: JSON.stringify({
      target_type: "market_metric",
      draft_data: stagedItem.draft_data,
      reviewer_note: "普通用户不得批准此条目。",
    }),
  });
  assert.equal(
    forbiddenApprove.response.status,
    403,
    `Authenticated non-admin approval must be forbidden: ${JSON.stringify(forbiddenApprove.body)}`,
  );
  assert.equal(forbiddenApprove.body.error.code, "ADMIN_REQUIRED");

  const approve = await json(`/api/admin/import-items/${itemId}/approve`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      target_type: "market_metric",
      draft_data: stagedItem.draft_data,
      reviewer_note: "已人工核对 CSV 原始行、地区、单位、零值和来源；仅批准为未发布草稿。",
    }),
  });
  assert.equal(approve.response.status, 200, JSON.stringify(approve.body));
  assert.equal(approve.body.data.import_item_id, itemId);
  assert.equal(approve.body.data.target_type, "market_metric");
  assert.equal(approve.body.data.already_approved, false);
  metricId = approve.body.data.record_id;
  assert.ok(metricId, "Approval should create a formal market_metric record");

  const { data: metric, error: metricError } = await adminDb
    .from("market_metrics")
    .select("*")
    .eq("id", metricId)
    .single();
  assert.ifError(metricError);
  assert.equal(metric.metric_key, metricKey);
  assert.equal(metric.region_id, shandong.id);
  assert.equal(metric.value, 0);
  assert.equal(metric.is_published, false, "Import approval must never publish a metric");

  const afterApproval = await json(
    `/api/public/market-metrics?region_id=${encodeURIComponent(shandong.id)}`,
  );
  assert.equal(afterApproval.response.status, 200, JSON.stringify(afterApproval.body));
  assert.ok(
    !afterApproval.body.data.some((candidate) => candidate.id === metricId),
    "Approved-but-unpublished metric must remain absent from the public API",
  );
  const { data: anonymousMetrics, error: anonymousMetricsError } = await publicAnon
    .from("market_metrics")
    .select("id")
    .eq("id", metricId);
  assert.ifError(anonymousMetricsError);
  assert.deepEqual(
    anonymousMetrics,
    [],
    "Market metric RLS must hide the unpublished approved record",
  );

  const { data: provenance, error: provenanceError } = await adminDb
    .from("import_items")
    .select(
      "id,import_job_id,review_status,reviewed_by,reviewed_at,reviewer_note,approved_signal_id,approved_market_metric_id,approved_record_id",
    )
    .eq("id", itemId)
    .single();
  assert.ifError(provenanceError);
  assert.equal(provenance.import_job_id, jobId);
  assert.equal(provenance.review_status, "approved");
  assert.equal(provenance.reviewed_by, userId);
  assert.ok(provenance.reviewed_at);
  assert.match(provenance.reviewer_note, /人工核对/);
  assert.equal(provenance.approved_signal_id, null);
  assert.equal(provenance.approved_market_metric_id, metricId);
  assert.equal(provenance.approved_record_id, metricId);

  const signalTitle = `[E2E DEMO] 山东政策导入 ${runId}`;
  const signalSourceUrl = `${appUrl}/api/public/regions`;
  const signalHeaders = [
    "region_code",
    "signal_type",
    "title",
    "summary",
    "category",
    "original_status",
    "normalized_status",
    "event_date",
    "effective_date",
    "impact_channel",
    "impact_direction",
    "impact_level",
    "source_name",
    "source_url",
  ];
  const signalValues = [
    "CN-SD",
    "policy",
    signalTitle,
    "仅用于真实 HTTP 端到端测试，不代表真实政策或市场数据。",
    "E2E Demo",
    "Filed",
    "filed",
    "2026-07-22",
    "",
    "交易规则",
    "neutral",
    "demo",
    "Grid Ledger HTTP E2E local source",
    signalSourceUrl,
  ];
  const signalCsv = `${signalHeaders.map(csvCell).join(",")}\n${signalValues.map(csvCell).join(",")}\n`;
  const signalUploadForm = new FormData();
  signalUploadForm.set("input_type", "excel");
  signalUploadForm.set(
    "file",
    new Blob([signalCsv], { type: "text/csv;charset=utf-8" }),
    `grid-ledger-signal-import-e2e-${runId}.csv`,
  );
  const signalUpload = await json("/api/admin/imports", {
    method: "POST",
    headers: bearerHeaders,
    body: signalUploadForm,
  });
  assert.equal(signalUpload.response.status, 201, JSON.stringify(signalUpload.body));
  assert.equal(signalUpload.body.data.duplicate, false);
  signalJobId = signalUpload.body.data.job.id;
  signalStoragePath = signalUpload.body.data.job.storage_path;
  assert.ok(signalStoragePath, "Signal CSV should be stored in the private import bucket");
  const signalPreview = signalUpload.body.data.job.input_metadata.workbook_preview;
  assert.deepEqual(signalPreview.sheets[0].headers, signalHeaders);
  assert.equal(signalPreview.sheets[0].rows[0].row_number, 2);

  const signalMapping = Object.fromEntries(
    signalHeaders.map((header) => [header, header]),
  );
  const signalProcessed = await json(`/api/admin/imports/${signalJobId}/process`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      sheet_name: "Sheet1",
      target_type: "signal",
      mapping: signalMapping,
    }),
  });
  assert.equal(
    signalProcessed.response.status,
    200,
    JSON.stringify(signalProcessed.body),
  );
  assert.equal(signalProcessed.body.data.job.status, "review");

  const { data: signalItems, error: signalItemsError } = await adminDb
    .from("import_items")
    .select("*")
    .eq("import_job_id", signalJobId)
    .order("item_index");
  assert.ifError(signalItemsError);
  assert.equal(signalItems.length, 1, "One Signal CSV row should create one item");
  const signalItem = signalItems[0];
  signalItemId = signalItem.id;
  assert.equal(signalItem.review_status, "pending_review");
  assert.equal(signalItem.target_type, "signal");
  assert.equal(signalItem.sheet_name, "Sheet1");
  assert.equal(signalItem.source_row_number, 2);
  assert.equal(signalItem.draft_data.region_code, "CN-SD");
  assert.equal(signalItem.draft_data.title, signalTitle);
  assert.equal(signalItem.draft_data.original_status, "Filed");
  assert.equal(signalItem.draft_data.normalized_status, "filed");
  assert.equal(signalItem.ai_provider, null, "Signal CSV processing must not call AI");
  assert.equal(signalItem.ai_model, null, "Signal CSV processing must not call AI");
  assert.equal(signalItem.ai_response_id, null, "Signal CSV processing must not call AI");
  assert.equal(signalItem.prompt_version, "deterministic-excel-mapping-v1");
  assert.equal(signalItem.evidence[0].sheet, "Sheet1");
  assert.equal(signalItem.evidence[0].row, 2);

  const signalApprove = await json(
    `/api/admin/import-items/${signalItemId}/approve`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        target_type: "signal",
        draft_data: signalItem.draft_data,
        reviewer_note: "已人工核对山东归属、Filed 状态、摘要和原文链接；仅创建待发布草稿。",
      }),
    },
  );
  assert.equal(
    signalApprove.response.status,
    200,
    JSON.stringify(signalApprove.body),
  );
  assert.equal(signalApprove.body.data.import_item_id, signalItemId);
  assert.equal(signalApprove.body.data.target_type, "signal");
  assert.equal(signalApprove.body.data.already_approved, false);
  signalId = signalApprove.body.data.record_id;
  assert.ok(signalId, "Signal approval should create a formal Signal record");

  const { data: pendingSignal, error: pendingSignalError } = await adminDb
    .from("signals")
    .select("*")
    .eq("id", signalId)
    .single();
  assert.ifError(pendingSignalError);
  assert.equal(pendingSignal.region_id, shandong.id);
  assert.equal(pendingSignal.title, signalTitle);
  assert.equal(pendingSignal.original_status, "Filed");
  assert.equal(pendingSignal.normalized_status, "filed");
  assert.equal(
    pendingSignal.review_status,
    "pending_review",
    "Import approval must create an unpublished Signal draft",
  );
  assert.equal(pendingSignal.published_at, null);

  const pendingSignalList = await json(
    `/api/public/signals?region_id=${encodeURIComponent(shandong.id)}&q=${encodeURIComponent(runId)}`,
  );
  assert.equal(
    pendingSignalList.response.status,
    200,
    JSON.stringify(pendingSignalList.body),
  );
  assert.ok(
    !pendingSignalList.body.data.some((candidate) => candidate.id === signalId),
    "Approved-but-unpublished Signal must not appear in the public list",
  );
  const pendingSignalDetail = await request(`/api/public/signals/${signalId}`);
  assert.equal(pendingSignalDetail.status, 404);
  const { data: anonymousPendingSignals, error: anonymousPendingSignalError } =
    await publicAnon.from("signals").select("id").eq("id", signalId);
  assert.ifError(anonymousPendingSignalError);
  assert.deepEqual(
    anonymousPendingSignals,
    [],
    "Signal RLS must hide the approved-but-unpublished import",
  );

  const publishSignal = await json(`/api/admin/signals/${signalId}/publish`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      reviewer_note: "已人工复核导入证据并确认发布；Filed 不等于 Approved。",
    }),
  });
  assert.equal(
    publishSignal.response.status,
    200,
    JSON.stringify(publishSignal.body),
  );
  assert.equal(publishSignal.body.data.review_status, "published");
  assert.equal(publishSignal.body.data.reviewer_id, userId);
  assert.ok(publishSignal.body.data.published_at);
  assert.equal(
    publishSignal.body.data.normalized_status,
    "filed",
    "Publishing must not reinterpret Filed as Approved",
  );

  const publishedSignalList = await json(
    `/api/public/signals?region_id=${encodeURIComponent(shandong.id)}&q=${encodeURIComponent(runId)}`,
  );
  assert.equal(
    publishedSignalList.response.status,
    200,
    JSON.stringify(publishedSignalList.body),
  );
  const publicSignal = publishedSignalList.body.data.find(
    (candidate) => candidate.id === signalId,
  );
  assert.ok(publicSignal, "Published imported Signal should appear in Shandong query");
  assert.equal(publicSignal.title, signalTitle);
  assert.equal(publicSignal.normalized_status, "filed");

  const publishedSignalDetail = await json(`/api/public/signals/${signalId}`);
  assert.equal(
    publishedSignalDetail.response.status,
    200,
    JSON.stringify(publishedSignalDetail.body),
  );
  assert.equal(publishedSignalDetail.body.data.id, signalId);
  assert.equal(publishedSignalDetail.body.data.title, signalTitle);
  assert.equal(publishedSignalDetail.body.data.source_url, signalSourceUrl);
  const signalDetailPage = await request(`/signals/${signalId}`);
  assert.equal(signalDetailPage.status, 200);
  const signalDetailHtml = await signalDetailPage.text();
  assert.match(signalDetailHtml, new RegExp(runId));
  assert.ok(
    signalDetailHtml.includes(signalSourceUrl),
    "Published Signal detail page should render the source link",
  );

  const { data: signalProvenance, error: signalProvenanceError } = await adminDb
    .from("import_items")
    .select(
      "id,import_job_id,review_status,reviewed_by,approved_signal_id,approved_market_metric_id,approved_record_id",
    )
    .eq("id", signalItemId)
    .single();
  assert.ifError(signalProvenanceError);
  assert.equal(signalProvenance.import_job_id, signalJobId);
  assert.equal(signalProvenance.review_status, "approved");
  assert.equal(signalProvenance.reviewed_by, userId);
  assert.equal(signalProvenance.approved_signal_id, signalId);
  assert.equal(signalProvenance.approved_market_metric_id, null);
  assert.equal(signalProvenance.approved_record_id, signalId);

  process.stdout.write(
    "Import HTTP E2E passed: auth boundaries → Metric CSV private draft/unpublished approval → duplicate reuse → Signal CSV private draft → publish → Shandong public list/detail → provenance → cleanup\n",
  );
} catch (error) {
  testError = error;
} finally {
  if (storagePath) {
    await cleanupStep("private Storage object", () =>
      service.storage.from("grid-ledger-imports").remove([storagePath]),
    );
  }
  if (signalStoragePath) {
    await cleanupStep("Signal private Storage object", () =>
      service.storage.from("grid-ledger-imports").remove([signalStoragePath]),
    );
  }
  if (updatedWorkbookStoragePath) {
    await cleanupStep("updated workbook private Storage object", () =>
      service.storage
        .from("grid-ledger-imports")
        .remove([updatedWorkbookStoragePath]),
    );
  }
  if (correctedWorkbookStoragePath) {
    await cleanupStep("corrected workbook private Storage object", () =>
      service.storage
        .from("grid-ledger-imports")
        .remove([correctedWorkbookStoragePath]),
    );
  }
  if (itemId) {
    await cleanupStep("import item", () =>
      service.from("import_items").delete().eq("id", itemId),
    );
  }
  if (signalItemId) {
    await cleanupStep("Signal import item", () =>
      service.from("import_items").delete().eq("id", signalItemId),
    );
  }
  if (updatedWorkbookJobId) {
    await cleanupStep("updated workbook import item", () =>
      service.from("import_items").delete().eq("import_job_id", updatedWorkbookJobId),
    );
  }
  if (correctedWorkbookJobId) {
    await cleanupStep("corrected workbook import items", () =>
      service.from("import_items").delete().eq("import_job_id", correctedWorkbookJobId),
    );
  }
  if (metricId) {
    await cleanupStep("market metric", () =>
      service.from("market_metrics").delete().eq("id", metricId),
    );
  }
  if (signalId) {
    await cleanupStep("published imported Signal", () =>
      service.from("signals").delete().eq("id", signalId),
    );
  }
  if (jobId) {
    await cleanupStep("import job", () =>
      service.from("import_jobs").delete().eq("id", jobId),
    );
  }
  if (signalJobId) {
    await cleanupStep("Signal import job", () =>
      service.from("import_jobs").delete().eq("id", signalJobId),
    );
  }
  if (updatedWorkbookJobId) {
    await cleanupStep("updated workbook import job", () =>
      service.from("import_jobs").delete().eq("id", updatedWorkbookJobId),
    );
  }
  if (correctedWorkbookJobId) {
    await cleanupStep("corrected workbook import job", () =>
      service.from("import_jobs").delete().eq("id", correctedWorkbookJobId),
    );
  }
  if (viewerUserId) {
    await cleanupStep("temporary non-admin auth user", () =>
      service.auth.admin.deleteUser(viewerUserId),
    );
  }
  if (userId) {
    await cleanupStep("temporary auth user", () =>
      service.auth.admin.deleteUser(userId),
    );
  }
}

if (cleanupErrors.length) {
  process.stderr.write(
    `Import HTTP E2E cleanup was safely limited to this run's exact IDs/paths and encountered:\n- ${cleanupErrors.join("\n- ")}\n`,
  );
}
if (testError) throw testError;
if (cleanupErrors.length) {
  throw new AggregateError(cleanupErrors, "Import HTTP E2E cleanup did not fully complete");
}
