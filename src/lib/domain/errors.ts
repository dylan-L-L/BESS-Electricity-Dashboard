export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_DRAFT"
  | "NOT_PUBLISHABLE"
  | "INVALID_REJECTION";

export class DomainError extends Error {
  /** Compatibility alias consumed by the HTTP error serializer. */
  public readonly issues: Record<string, string[]>;

  constructor(
    message: string,
    public readonly code: DomainErrorCode,
    public readonly status: number,
    public readonly field_errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.issues = field_errors;
  }
}

export class AuthenticationRequiredError extends DomainError {
  constructor() {
    super("Administrator login is required", "UNAUTHENTICATED", 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor() {
    super("Administrator permission is required", "FORBIDDEN", 403);
  }
}

export class SignalNotFoundError extends DomainError {
  constructor(signalId: string) {
    super(`Signal ${signalId} was not found`, "NOT_FOUND", 404);
  }
}

export class DraftValidationError extends DomainError {
  constructor(fieldErrors: Record<string, string[]>) {
    super("Draft input is invalid", "INVALID_DRAFT", 422, fieldErrors);
  }
}

export class PublishValidationError extends DomainError {
  constructor(fieldErrors: Record<string, string[]>) {
    super(
      "Signal is missing required publication fields",
      "NOT_PUBLISHABLE",
      422,
      fieldErrors,
    );
  }
}

export class RejectionValidationError extends DomainError {
  constructor(fieldErrors: Record<string, string[]>) {
    super(
      "A human rejection reason is required",
      "INVALID_REJECTION",
      422,
      fieldErrors,
    );
  }
}
