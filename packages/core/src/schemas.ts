import { z } from "zod";
import { normalizeTarget, TargetError } from "./url";

export const targetSchema = z.string().transform((value, ctx) => {
  try {
    return normalizeTarget(value);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: e instanceof TargetError ? e.message : "Invalid URL." });
    return z.NEVER;
  }
});

export const createInvestigationInput = z.object({ target: targetSchema });
export const createInviteInput = z.object({ role: z.enum(["admin", "analyst", "viewer"]) });
export const createTokenInput = z.object({ name: z.string().trim().min(1).max(60) });
