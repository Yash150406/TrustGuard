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

// Only AppError messages are written for users. Anything else could carry upstream
// text (API keys, connection strings), so clients get a generic message and an id.
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.publicMessage }, { status: err.status });
  }
  const id = crypto.randomUUID();
  console.error(`[${id}]`, err instanceof Error ? err.name : "UnknownError");
  return Response.json(
    { error: "Something went wrong. Try again in a moment.", id },
    { status: 500 },
  );
}
