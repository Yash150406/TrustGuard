import { revokeToken } from "@trustguard/db";
import { db } from "@/db";
import { errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const m = await requireMember("investigation:read");
    await revokeToken(db, { id: (await ctx.params).id, userId: m.userId, now: new Date() });
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
