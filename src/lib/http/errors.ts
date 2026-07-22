import { NextResponse } from "next/server";

type HttpLikeError = Error & {
  status?: number;
  code?: string;
  issues?: unknown;
  field_errors?: Record<string, string[]>;
};

export function errorResponse(error: unknown) {
  const candidate = error as HttpLikeError;
  const status = candidate?.status ?? 500;
  const code = candidate?.code ?? (status === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");

  return NextResponse.json(
    {
      error: {
        code,
        message: status === 500 ? "服务器暂时无法完成请求" : candidate.message,
        ...(candidate.issues ? { issues: candidate.issues } : {}),
        ...(candidate.field_errors && Object.keys(candidate.field_errors).length
          ? { fields: candidate.field_errors }
          : {}),
      },
    },
    { status },
  );
}
