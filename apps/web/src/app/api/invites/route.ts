import { createInviteInput } from "@trustguard/core";
import { createInvite } from "@trustguard/db";
import { db } from "@/db";
import { AppError, errorResponse } from "@/lib/errors";
import { requireMember } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const m = await requireMember("org:invite");
    const input = createInviteInput.safeParse(await req.json().catch(() => null));
    if (!input.success) throw new AppError(400, "Pick a role: admin, analyst or viewer.");
    const code = await createInvite(db, {
      orgId: m.orgId,
      role: input.data.role,
      createdBy: m.userId,
      now: new Date(),
    });
    return Response.json({ url: `${new URL(req.url).origin}/invite/${code}` }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
