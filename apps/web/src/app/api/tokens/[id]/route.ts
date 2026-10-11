import { idSchema } from "@trustguard/core";
import { revokeToken } from "@trustguard/db";
import { db } from "@/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const m = await requireMember("investigation:read");
    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) throw new AppError(400, "That token id isn't valid.");
    await revokeToken(db, { id: id.data, userId: m.userId, now: new Date() });
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
