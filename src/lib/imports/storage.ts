import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

export const IMPORT_STORAGE_BUCKET = "grid-ledger-imports";
export const MAX_IMPORT_FILE_BYTES = 4 * 1024 * 1024;

export class ImportStorageError extends Error {
  readonly status = 503;
  readonly code = "IMPORT_STORAGE_ERROR";
  readonly retryable = true;

  constructor(message: string) {
    super(message);
    this.name = "ImportStorageError";
  }
}

export function sha256(input: Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

function safeExtension(filename: string): string {
  const extension = extname(filename).toLocaleLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(extension) ? extension : "";
}

export function importObjectPath(input: {
  adminId: string;
  jobId: string;
  filename: string;
}): string {
  return `${input.adminId}/${input.jobId}/${randomUUID()}${safeExtension(input.filename)}`;
}

export class SupabaseImportBlobStore {
  constructor(private readonly client: SupabaseClient) {}

  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void> {
    const { error } = await this.client.storage
      .from(IMPORT_STORAGE_BUCKET)
      .upload(path, bytes, {
        contentType,
        upsert: false,
        cacheControl: "0",
      });
    if (error) throw new ImportStorageError(`原始文件保存失败：${error.message}`);
  }

  async download(path: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage
      .from(IMPORT_STORAGE_BUCKET)
      .download(path);
    if (error || !data) {
      throw new ImportStorageError(`原始文件读取失败：${error?.message ?? "对象不存在"}`);
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async createSignedReadUrl(path: string, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await this.client.storage
      .from(IMPORT_STORAGE_BUCKET)
      .createSignedUrl(path, expiresInSeconds, { download: true });
    if (error || !data?.signedUrl) {
      throw new ImportStorageError(`证据预览地址生成失败：${error?.message ?? "未知错误"}`);
    }
    return data.signedUrl;
  }
}
