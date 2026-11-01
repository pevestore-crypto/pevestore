import type { Metadata } from "next";
import { Suspense } from "react";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/admin/team-schema";
import { requireOwner } from "@/lib/auth/dal";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { type Member, MemberRow, NewMemberForm } from "./team-ui";

export const metadata: Metadata = { title: "Equipo" };

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Equipo</h1>
      <p className="mt-1 text-sm text-muted">Quién puede entrar al panel. Solo el dueño gestiona esta sección.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-2xl bg-background" />}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  const me = await requireOwner();
  const db = createSupabaseServiceClient();
  const { data: rows } = await db.from("admin_users").select("user_id, full_name, role, must_change_password").order("created_at");
  const members: Member[] = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data } = await db.auth.admin.getUserById(r.user_id);
      return {
        userId: r.user_id,
        fullName: r.full_name,
        email: data.user?.email ?? "—",
        role: r.role,
        mustChangePassword: r.must_change_password,
        lastSignIn: data.user?.last_sign_in_at ?? null,
        isMe: r.user_id === me.id,
      };
    }),
  );

  return (
    <div className="mt-6 space-y-4">
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
        {members.map((m) => <MemberRow key={m.userId} m={m} />)}
      </ul>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        {(["owner", "staff"] as const).map((r) => (
          <div key={r} className="rounded-xl bg-background p-3">
            <dt className="font-semibold">{ROLE_LABEL[r]}</dt>
            <dd className="text-muted">{ROLE_HINT[r]}</dd>
          </div>
        ))}
      </dl>
      <NewMemberForm />
    </div>
  );
}
