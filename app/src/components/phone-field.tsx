"use client";
import { useEffect, useMemo, useState } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/lang";
import { countryOptions, DEFAULT_COUNTRY, toE164 } from "@/lib/phone";

/** A phone input with a country-code picker (India +91 by default). `value` is the full number as "+<code><digits>" (or "" when empty). */
export function PhoneField({ id, value, onChange, className, placeholder }: { id?: string; value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const { t } = useT();
  const options = useMemo(countryOptions, []);
  const start = useMemo(() => (value ? parsePhoneNumberFromString(value) : undefined), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState<string>(start?.country ?? DEFAULT_COUNTRY);
  const [text, setText] = useState(start ? start.nationalNumber : value.replace(/^\+/, ""));
  const dial = options.find((o) => o.code === country)?.dial ?? "91";

  const emit = (c: string, t: string) => {
    const d = options.find((o) => o.code === c)?.dial ?? "91";
    const digits = t.replace(/[^\d]/g, "").replace(/^0+/, "");
    onChange(t.trim().startsWith("+") ? `+${t.replace(/[^\d]/g, "")}` : digits ? `+${d}${digits}` : "");
  };
  useEffect(() => { if (value === "" && text !== "") setText(""); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const typedIntl = text.trim().startsWith("+");
  const invalid = Boolean(value) && toE164(value) === null;
  return (
    <div>
      <div className="flex gap-2">
        <select aria-label={t("phone.country")} value={country} onChange={(e) => { setCountry(e.target.value); emit(e.target.value, text); }} disabled={typedIntl} className="h-11 w-28 shrink-0 rounded-xl border bg-background px-2 text-sm">
          {options.map((o) => <option key={o.code} value={o.code}>{o.code} +{o.dial}</option>)}
        </select>
        <Input id={id} inputMode="tel" autoComplete="tel-national" value={text} placeholder={placeholder ?? t(country === "IN" ? "phone.ph.in" : "phone.ph.other")} onChange={(e) => { setText(e.target.value); emit(country, e.target.value); }} className={className} aria-invalid={invalid} />
      </div>
      {invalid && <p role="alert" className="mt-1 text-xs text-destructive">{t("phone.invalid", { dial })}</p>}
    </div>
  );
}
