"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getEntitlements } from "@kch/payments";
import { plans } from "@/app.config";
import { countCodes, createCode, deleteCode, updateCode } from "@/lib/codes";
import { FREE_CODE_LIMIT } from "@/lib/limits";
import { normalizeUrl } from "@/lib/validate";
import { requireSession } from "@/lib/session";

export type FormState = { error?: string; upgrade?: boolean; saved?: boolean } | undefined;

export async function createCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const targetUrl = normalizeUrl(String(formData.get("targetUrl") ?? ""));

  if (!name) return { error: "Give the code a name so you can find it later." };
  if (!targetUrl) return { error: "Enter a valid web address, like example.com/menu." };

  const ent = await getEntitlements(user.id, plans);
  if (!ent.isPaid && (await countCodes(user.id)) >= FREE_CODE_LIMIT) {
    return {
      error: `The free plan includes ${FREE_CODE_LIMIT} codes. Upgrade for unlimited codes and scan analytics.`,
      upgrade: true,
    };
  }

  const code = await createCode({ userId: user.id, name, targetUrl });
  revalidatePath("/dashboard");
  redirect(`/dashboard/codes/${code.id}`);
}

export async function updateCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireSession();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const targetUrl = normalizeUrl(String(formData.get("targetUrl") ?? ""));

  if (!name) return { error: "Name cannot be empty." };
  if (!targetUrl) return { error: "Enter a valid web address, like example.com/menu." };

  const updated = await updateCode(id, user.id, { name, targetUrl });
  if (!updated) return { error: "Code not found." };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/codes/${id}`);
  return { saved: true };
}

export async function deleteCodeAction(formData: FormData) {
  const { user } = await requireSession();
  const id = String(formData.get("id") ?? "");
  await deleteCode(id, user.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
