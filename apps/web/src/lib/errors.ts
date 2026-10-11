export class AppError extends Error {
  constructor(
    public status: number,
    public publicMessage: string,
  ) {
    super(publicMessage);
  }
}

export function redact(text: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((t, s) => t.split(s).join("[redacted]"), text);
}

// Env vars whose values must never reach a log line.
const SECRET_VARS = ["DATABASE_URL", "AUTH_SECRET", "AUTH_GITHUB_SECRET", "AUTH_GOOGLE_SECRET"];

// Logs the full error (message and stack) for debugging, with secret values blanked.
export function logError(id: string, err: unknown): void {
  const text = err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err);
  const secrets = SECRET_VARS.map((k) => process.env[k] ?? "");
  secrets.push(...databasePassword());
  console.error(`[${id}]`, redact(text, secrets));
}

// The password on its own (raw and URL-decoded) can show up in driver errors.
function databasePassword(): string[] {
  try {
    const raw = new URL(process.env.DATABASE_URL ?? "").password;
    return raw ? [raw, decodeURIComponent(raw)] : [];
  } catch {
    return [];
  }
}

// Only AppError messages are written for users. Anything else could carry upstream
// text (API keys, connection strings), so clients get a generic message and an id.
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.publicMessage }, { status: err.status });
  }
  const id = crypto.randomUUID();
  logError(id, err);
  return Response.json(
    { error: "Something went wrong. Try again in a moment.", id },
    { status: 500 },
  );
}
