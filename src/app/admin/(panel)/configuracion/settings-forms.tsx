"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, Field, FormError, Toggle, dangerButton, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/admin/form-ui";
import type { ActionResult } from "@/lib/admin/catalog-schema";
import { BANKS, type BankAccountInput, type BusinessInput, type OrderRulesInput, WEEKDAYS } from "@/lib/admin/settings-schema";
import { addBlockedDate, deleteBankAccount, publishTerms, removeBlockedDate, saveBankAccount, saveBusiness, saveOrderRules } from "./actions";

/** Estado común: guardar con una acción del servidor y mostrar errores o "Guardado". */
function useSave() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setSaved(false);
      const r = await fn();
      if (!r.ok) return setErrors(r.errors);
      setErrors({});
      setSaved(true);
      after?.();
      router.refresh();
    });
  return { errors, saved, pending, run, setSaved };
}

function SaveBar({ pending, saved, label = "Guardar" }: { pending: boolean; saved: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={pending} className={primaryButton}>{pending ? "Guardando…" : label}</button>
      {saved && <span role="status" className="text-sm font-medium text-success">Guardado</span>}
    </div>
  );
}

export function BusinessForm({ initial }: { initial: BusinessInput }) {
  const [b, setB] = useState(initial);
  const s = useSave();
  const set = (k: keyof BusinessInput, v: string) => {
    s.setSaved(false);
    setB((p) => ({ ...p, [k]: v }));
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); s.run(() => saveBusiness(b)); }} noValidate>
      <Card title="Datos del negocio" description="Se muestran en la tienda y se usan para los mensajes de WhatsApp.">
        <FormError message={s.errors._} />
        <Field label="WhatsApp del negocio" htmlFor="whatsappNumber" error={s.errors.whatsappNumber} hint="Ejemplo: 809-555-1234. Recibe los pedidos y cotizaciones.">
          <input id="whatsappNumber" inputMode="tel" className={inputClass} value={b.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} aria-invalid={!!s.errors.whatsappNumber} />
        </Field>
        <Field label="Correo de contacto" htmlFor="contactEmail" error={s.errors.contactEmail}>
          <input id="contactEmail" type="email" className={inputClass} value={b.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </Field>
        <Field label="Dirección" htmlFor="address" error={s.errors.address} hint="Dónde retiran los pedidos.">
          <input id="address" className={inputClass} value={b.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Horario" htmlFor="businessHours" error={s.errors.businessHours} hint="Ejemplo: Lunes a sábado, 9:00 a. m. – 6:00 p. m.">
          <input id="businessHours" className={inputClass} value={b.businessHours} onChange={(e) => set("businessHours", e.target.value)} />
        </Field>
        <SaveBar pending={s.pending} saved={s.saved} />
      </Card>
    </form>
  );
}

export function OrderRulesForm({ initial, isOwner }: { initial: OrderRulesInput; isOwner: boolean }) {
  const [r, setR] = useState(initial);
  const s = useSave();
  const set = <K extends keyof OrderRulesInput>(k: K, v: OrderRulesInput[K]) => {
    s.setSaved(false);
    setR((p) => ({ ...p, [k]: v }));
  };
  const toggleDay = (d: number) =>
    set("nonWorkingWeekdays", r.nonWorkingWeekdays.includes(d) ? r.nonWorkingWeekdays.filter((x) => x !== d) : [...r.nonWorkingWeekdays, d]);

  return (
    <form onSubmit={(e) => { e.preventDefault(); s.run(() => saveOrderRules(r)); }} noValidate>
      <Card title="Producción y precios" description={isOwner ? undefined : "Solo el dueño puede cambiar estas reglas."}>
        <fieldset disabled={!isOwner} className="space-y-4">
          <FormError message={s.errors._} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Días de producción (general)" htmlFor="defaultProductionDays" error={s.errors.defaultProductionDays} hint="Días hábiles. Cada producto puede tener el suyo.">
              <input id="defaultProductionDays" type="number" min={0} inputMode="numeric" className={inputClass} value={r.defaultProductionDays} onChange={(e) => set("defaultProductionDays", Number(e.target.value) || 0)} />
            </Field>
            <Field label="Hora de corte" htmlFor="orderCutoffHour" error={s.errors.orderCutoffHour} hint="Pedidos después de esta hora cuentan desde el día siguiente. Vacío = sin corte.">
              <select id="orderCutoffHour" className={inputClass} value={r.orderCutoffHour} onChange={(e) => set("orderCutoffHour", e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Sin hora de corte</option>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h % 12 || 12}:00 ${h < 12 ? "a. m." : "p. m."}`}</option>)}
              </select>
            </Field>
          </div>

          <div>
            <p className="text-sm font-medium">Días sin producción ni entregas</p>
            {s.errors.nonWorkingWeekdays && <p className="text-xs font-medium text-danger">{s.errors.nonWorkingWeekdays}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((name, d) => (
                <label key={d} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${r.nonWorkingWeekdays.includes(d) ? "border-brand bg-brand-soft text-brand" : "border-border"}`}>
                  <input type="checkbox" className="sr-only" checked={r.nonWorkingWeekdays.includes(d)} onChange={() => toggleDay(d)} />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Oferta + descuento por cantidad" htmlFor="pricingStacking" hint="Cómo se combinan cuando ambos aplican.">
              <select id="pricingStacking" className={inputClass} value={r.pricingStacking} onChange={(e) => set("pricingStacking", e.target.value as OrderRulesInput["pricingStacking"])}>
                <option value="best_price">Se aplica el que deje el menor precio</option>
                <option value="promo_over_volume">La oferta reemplaza el descuento por cantidad</option>
                <option value="stack">Se suman (oferta sobre precio por cantidad)</option>
              </select>
            </Field>
            <Field label="Redondeo de totales" htmlFor="roundingUnit">
              <select id="roundingUnit" className={inputClass} value={r.roundingUnit} onChange={(e) => set("roundingUnit", Number(e.target.value) as 1 | 100)}>
                <option value={1}>Al centavo (RD$1,524.90)</option>
                <option value={100}>Al peso (RD$1,525)</option>
              </select>
            </Field>
          </div>
          {isOwner && <SaveBar pending={s.pending} saved={s.saved} />}
        </fieldset>
      </Card>
    </form>
  );
}

export function BlockedDates({ initial }: { initial: { date: string; reason: string }[] }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const s = useSave();
  const fmt = new Intl.DateTimeFormat("es-DO", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <Card title="Fechas no disponibles" description="Feriados, vacaciones o días sin entregas. No se podrán elegir como fecha de entrega.">
      <FormError message={s.errors._ ?? s.errors.date} />
      {initial.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {initial.map((d) => (
            <li key={d.date} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex-1">{fmt.format(new Date(`${d.date}T00:00:00Z`))}{d.reason && <span className="text-muted"> · {d.reason}</span>}</span>
              <button type="button" disabled={s.pending} onClick={() => s.run(() => removeBlockedDate(d.date))} className="rounded-lg px-2 py-1 text-danger hover:bg-brand-soft" aria-label={`Quitar ${d.date}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); s.run(() => addBlockedDate({ date, reason }), () => { setDate(""); setReason(""); }); }}
      >
        <Field label="Fecha" htmlFor="bdate"><input id="bdate" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Motivo (opcional)" htmlFor="breason" className="min-w-40 flex-1"><input id="breason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Navidad" /></Field>
        <button type="submit" disabled={s.pending || !date} className={secondaryButton}>Agregar</button>
      </form>
    </Card>
  );
}

const emptyBank: BankAccountInput = { id: "", bankCode: "banreservas", accountHolder: "", accountNumber: "", accountType: "ahorros", holderIdDoc: "", isActive: true, sortOrder: 0 };

export function BankAccounts({ initial, isOwner }: { initial: BankAccountInput[]; isOwner: boolean }) {
  const [editing, setEditing] = useState<BankAccountInput | null>(null);
  const s = useSave();
  return (
    <Card title="Cuentas para transferencias" description="Los clientes verán estas cuentas al pagar. Verifica cada número con cuidado.">
      {initial.length === 0 && !editing && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">No hay cuentas registradas. Los clientes no podrán completar pedidos hasta que agregues al menos una.</p>
      )}
      {initial.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {initial.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
              <span className="size-3 rounded-full" style={{ background: BANKS[a.bankCode].color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{BANKS[a.bankCode].name} · {a.accountType === "ahorros" ? "Ahorros" : "Corriente"}</span>
                <span className="block text-muted">{a.accountNumber} · {a.accountHolder}</span>
              </span>
              {!a.isActive && <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">Oculta</span>}
              {isOwner && <button type="button" className="rounded-lg px-3 py-1.5 hover:bg-surface" onClick={() => setEditing(a)}>Editar</button>}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form
          className="space-y-4 rounded-xl border border-border p-4"
          noValidate
          onSubmit={(e) => { e.preventDefault(); s.run(() => saveBankAccount(editing), () => setEditing(null)); }}
        >
          <FormError message={s.errors._} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banco" htmlFor="bankCode">
              <select id="bankCode" className={inputClass} value={editing.bankCode} onChange={(e) => setEditing({ ...editing, bankCode: e.target.value as BankAccountInput["bankCode"] })}>
                {Object.entries(BANKS).map(([code, b]) => <option key={code} value={code}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Tipo de cuenta" htmlFor="accountType">
              <select id="accountType" className={inputClass} value={editing.accountType} onChange={(e) => setEditing({ ...editing, accountType: e.target.value as BankAccountInput["accountType"] })}>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </Field>
            <Field label="Número de cuenta" htmlFor="accountNumber" error={s.errors.accountNumber}>
              <input id="accountNumber" inputMode="numeric" className={inputClass} value={editing.accountNumber} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} />
            </Field>
            <Field label="Titular" htmlFor="accountHolder" error={s.errors.accountHolder}>
              <input id="accountHolder" className={inputClass} value={editing.accountHolder} onChange={(e) => setEditing({ ...editing, accountHolder: e.target.value })} />
            </Field>
            <Field label="RNC o cédula del titular (opcional)" htmlFor="holderIdDoc" error={s.errors.holderIdDoc}>
              <input id="holderIdDoc" className={inputClass} value={editing.holderIdDoc} onChange={(e) => setEditing({ ...editing, holderIdDoc: e.target.value })} />
            </Field>
            <Field label="Orden" htmlFor="bankSort">
              <input id="bankSort" type="number" min={0} className={inputClass} value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Toggle id="bankActive" label="Mostrar a los clientes" checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={s.pending} className={primaryButton}>{s.pending ? "Guardando…" : "Guardar cuenta"}</button>
            <button type="button" className={secondaryButton} onClick={() => setEditing(null)}>Cancelar</button>
            {editing.id && (
              <button
                type="button"
                className={`${dangerButton} ml-auto`}
                onClick={() => window.confirm("¿Eliminar esta cuenta? Los pedidos anteriores conservan la información que vieron.") && s.run(() => deleteBankAccount(editing.id), () => setEditing(null))}
              >
                Eliminar
              </button>
            )}
          </div>
        </form>
      ) : (
        isOwner && <button type="button" className={secondaryButton} onClick={() => setEditing(emptyBank)}>+ Agregar cuenta</button>
      )}
    </Card>
  );
}

export function TermsForm({ initial, isOwner }: { initial: { version: number; body: string } | null; isOwner: boolean }) {
  const [body, setBody] = useState(initial?.body ?? "");
  const s = useSave();
  return (
    <form onSubmit={(e) => { e.preventDefault(); s.run(() => publishTerms({ body })); }} noValidate>
      <Card
        title="Condiciones comerciales"
        description={initial ? `Versión vigente: ${initial.version}. Al publicar cambios se crea una versión nueva; cada pedido guarda la que aceptó el cliente.` : "El cliente debe aceptarlas antes de enviar su pedido."}
      >
        {!initial && <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">Aún no hay condiciones publicadas. Los clientes no podrán completar pedidos hasta que las publiques.</p>}
        <FormError message={s.errors._ ?? s.errors.body} />
        <Field label="Texto" htmlFor="termsBody" hint="Incluye anticipo, plazos, cambios, cancelaciones, retiro y revisión del diseño.">
          <textarea id="termsBody" disabled={!isOwner} className={`${textareaClass} min-h-64`} value={body} onChange={(e) => { s.setSaved(false); setBody(e.target.value); }} />
        </Field>
        {isOwner && <SaveBar pending={s.pending} saved={s.saved} label={initial ? "Publicar nueva versión" : "Publicar condiciones"} />}
      </Card>
    </form>
  );
}
