// "Hogaya recommends": a simple, explainable rule. Confirmed exact time first, then higher reliability, then lower visit charge.
import type { ProviderCallJson } from "./types";

export interface Rankable {
  providerId: string;
  json: ProviderCallJson;
  reliability: number;
}

/** The first number in a price string ("₹200–250" gives 200). No number counts as the most expensive. */
export function visitAmount(s: string | null): number {
  const m = s?.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : Number.POSITIVE_INFINITY;
}

const exactRank = (o: Rankable) => (o.json.slot && o.json.slot_exact ? 0 : 1);

export function rankOptions<T extends Rankable>(options: T[]): T[] {
  return [...options].sort(
    (a, b) => exactRank(a) - exactRank(b) || b.reliability - a.reliability || visitAmount(a.json.visit_charge) - visitAmount(b.json.visit_charge),
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

/** One line saying why the first option is recommended, using the same order as the rule. */
export function recommendationReason(ranked: Rankable[], t: T): string {
  const [a, b] = ranked;
  if (!a) return "";
  if (!b) return t("rec.only");
  if (exactRank(a) !== exactRank(b)) return t("rec.exact", { time: a.json.slot ?? "" });
  if (a.reliability !== b.reliability) return t("rec.rel", { a: a.reliability, b: b.reliability });
  if (visitAmount(a.json.visit_charge) !== visitAmount(b.json.visit_charge)) return t("rec.price", { a: a.json.visit_charge ?? "", b: b.json.visit_charge ?? "" });
  return t("rec.first");
}
