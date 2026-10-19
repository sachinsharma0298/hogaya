// Phone numbers: stored and compared as E.164 (e.g. +254718795772). Safe to import on both server and browser.
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

export const DEFAULT_COUNTRY: CountryCode = "IN";

/** A valid number as E.164, or null. A 10-digit Indian number with no country code becomes +91. */
export function toE164(raw: unknown, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const p = parsePhoneNumberFromString(s, country);
  if (!p?.isValid()) return null;
  if (p.country === "IN" && !/^[6-9]\d{9}$/.test(p.nationalNumber)) return null; // Indian mobiles only (the library's short metadata is looser)
  return p.number;
}

/** Like toE164, but never fails: used to compare numbers already stored (same rules as migration 0008). */
export function canonPhone(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.startsWith("dev-")) return s;
  const e = toE164(s);
  if (e) return e;
  const d = s.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(d)) return `+91${d}`;
  if (/^91\d{10}$/.test(d)) return `+${d}`;
  if (/^0\d{10}$/.test(d)) return `+91${d.slice(1)}`;
  return d;
}

export const phoneCountry = (e164: string): CountryCode | undefined => parsePhoneNumberFromString(e164)?.country;

/** Countries Fo is known to call. The Fo spec does not say it supports international calls, so only India by default.
 *  Add more (e.g. "IN,KE") in NEXT_PUBLIC_FO_CALL_COUNTRIES once Fo confirms. */
const CALL_COUNTRIES = (process.env.NEXT_PUBLIC_FO_CALL_COUNTRIES ?? "IN").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
export const foMayCall = (e164: string) => { const c = phoneCountry(e164); return Boolean(c) && CALL_COUNTRIES.includes(c as string); };
export const FO_COUNTRY_WARNING = "Fo may not call this country";

export const maskPhone = (e164: string) => (e164 ? `•••• ${e164.replace(/\D/g, "").slice(-4)}` : "");

/** Nicely spaced for display: +254 718 795772 */
export const prettyPhone = (e164: string) => parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;

export interface CountryOption { code: CountryCode; name: string; dial: string }
export function countryOptions(): CountryOption[] {
  const names = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : undefined;
  const list = getCountries().map((code) => ({ code, name: names?.of(code) ?? code, dial: getCountryCallingCode(code) }));
  return list.sort((a, b) => (a.code === DEFAULT_COUNTRY ? -1 : b.code === DEFAULT_COUNTRY ? 1 : a.name.localeCompare(b.name)));
}
