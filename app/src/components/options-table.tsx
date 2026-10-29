"use client";
import { Check, CircleDashed, Star } from "lucide-react";
import type { ProviderCallJson } from "@/lib/types";

export interface OptionRow {
  providerId: string;
  name: string;
  json: ProviderCallJson;
  reliability: number;
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function Cell({ value, t, note }: { value: string | null; t: T; note?: React.ReactNode }) {
  return value ? (
    <>
      <span className="block font-medium leading-snug">{value}</span>
      {note ?? <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700"><Check className="size-3" /> {t("conf")}</span>}
    </>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-foreground/70"><CircleDashed className="size-3" /> {t("notconf")}</span>
  );
}

const yn = (b: boolean | null, t: T) => (b === null ? null : b ? t("yes") : t("no"));

/** The options side by side. The first option (already ranked) is marked "Hogaya recommends" with a one-line reason. */
export function OptionsTable({ options, reason, t, footer }: { options: OptionRow[]; reason: string; t: T; footer?: (o: OptionRow) => React.ReactNode }) {
  if (options.length === 0) return null;
  const rows: { label: string; cell: (o: OptionRow) => React.ReactNode }[] = [
    {
      label: t("row.slot"),
      cell: (o) => (
        <Cell
          value={o.json.slot}
          t={t}
          note={
            o.json.slot_exact ? (
              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700"><Check className="size-3" /> {t("cmp.exact.yes")}</span>
            ) : (
              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-800"><CircleDashed className="size-3" /> {t("cmp.exact.no")}</span>
            )
          }
        />
      ),
    },
    { label: t("row.visit"), cell: (o) => <Cell value={o.json.visit_charge} t={t} /> },
    { label: t("row.labour"), cell: (o) => <Cell value={o.json.labour_estimate ?? (o.json.price_type === "after_inspection" ? t("labour.after") : null)} t={t} /> },
    { label: t("row.parts"), cell: (o) => <Cell value={yn(o.json.brings_parts, t)} t={t} /> },
    {
      label: t("cmp.reliability"),
      cell: (o) => (
        <span className="inline-flex items-center gap-1 font-semibold"><Star className="size-3.5 fill-primary text-primary" />{o.reliability}<span className="text-[10px] font-normal text-foreground/70">/100</span></span>
      ),
    },
  ];
  return (
    <div className="overflow-x-auto rounded-3xl border bg-card">
      <table className="w-full min-w-[300px] table-fixed border-collapse text-left text-[13px]" aria-label={t("cmp.title")}>
        <thead>
          <tr className="align-top">
            <th className="w-[84px] p-3" />
            {options.map((o, i) => (
              <th key={o.providerId} scope="col" className={`p-3 font-semibold ${i === 0 ? "bg-accent/60" : ""}`}>
                {i === 0 && <span className="mb-1 block w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase leading-tight text-primary-foreground">{t("rec.badge")}</span>}
                <span className="block text-sm">{o.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t align-top">
              <th scope="row" className="p-3 text-[11px] font-medium text-foreground/75">{r.label}</th>
              {options.map((o, i) => (
                <td key={o.providerId} className={`p-3 ${i === 0 ? "bg-accent/40" : ""}`}>{r.cell(o)}</td>
              ))}
            </tr>
          ))}
          {footer && (
            <tr className="border-t align-top">
              <th className="p-3" />
              {options.map((o, i) => <td key={o.providerId} className={`p-3 ${i === 0 ? "bg-accent/40" : ""}`}>{footer(o)}</td>)}
            </tr>
          )}
        </tbody>
      </table>
      {reason && <p className="border-t bg-accent/30 px-4 py-2.5 text-xs text-foreground/85"><span className="font-semibold">{t("rec.badge")}: {options[0].name.split(" ")[0]}.</span> {reason}</p>}
    </div>
  );
}
