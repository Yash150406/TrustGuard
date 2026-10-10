import { createTokenInput } from "@trustguard/core";
import { createToken, hit, listTokens } from "@trustguard/db";
import { db } from "@/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function GET() {
  try {
    const m = await requireMember("investigation:read");
    return Response.json(await listTokens(db, m.userId));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const m = await requireMember("investigation:read");
    const rl = await hit(db, {
      key: `token-create:${m.userId}`,
      limit: 10,
      windowMs: 3_600_000,
      now: new Date(),
    });
    if (!rl.allowed) throw new AppError(429, "Too many tokens created. Try again later.");
    const input = createTokenInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new AppError(400, "Give the token a name up to 60 characters.");
    const t = await createToken(db, { userId: m.userId, orgId: m.orgId, name: input.data.name });
    return Response.json(t, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
