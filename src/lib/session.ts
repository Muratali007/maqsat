import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Family, Profile } from "@/lib/types";

/** Current user + their family (if any). Redirects to /login when signed out. */
export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const user = data.user;

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, families(id, name, invite_code)")
    .eq("user_id", user.id)
    .maybeSingle();
  const family = (membership?.families as unknown as Family | null) ?? null;

  let members: Profile[] = [];
  if (family) {
    const { data: rows } = await supabase.from("family_members").select("user_id").eq("family_id", family.id);
    const ids = (rows ?? []).map((r) => r.user_id as string);
    const { data: profs } = await supabase.from("profiles").select("id, name").in("id", ids);
    members = (profs ?? []) as Profile[];
  }
  const me = members.find((m) => m.id === user.id) ??
    ((await supabase.from("profiles").select("id, name").eq("id", user.id).maybeSingle()).data as Profile | null) ??
    { id: user.id, name: user.email ?? "" };

  return { supabase, user, me, family, members };
}

export function nameOf(members: Profile[], id: string | null | undefined): string {
  if (!id) return "";
  return members.find((m) => m.id === id)?.name ?? "—";
}
