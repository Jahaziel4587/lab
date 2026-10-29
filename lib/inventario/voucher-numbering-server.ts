import type { CollectionReference, Transaction } from "firebase-admin/firestore";
import { adminDB } from "@/lib/firebaseAdmin";
import { voucherPrefix, voucherWeek, numberingSuggestions, type NumberingLedger } from "./voucher-numbering";
import type { InventorySite } from "./sites";
import type { Voucher } from "./types";
export function numberingRef(vouchers: CollectionReference, key: string) { return adminDB.collection(`${vouchers.id}_numbering`).doc(key); }
export async function prepareNumbering(transaction: Transaction, vouchers: CollectionReference, site: InventorySite, instant: string) {
  const key = voucherWeek(instant).key, ref = numberingRef(vouchers, key), snap = await transaction.get(ref);
  if (snap.exists) return { key, ref, ledger: snap.data() as NumberingLedger };
  const prefix = voucherPrefix(site, instant);
  // Preserve manually assigned IDs, including a document dated outside its title's week.
  const prior = await transaction.get(vouchers.where("title", ">=", prefix).where("title", "<=", prefix + "\uf8ff"));
  const entries = prior.docs.filter(d => /^[A-Z]{1,6}$/.test(String(d.data().title).slice(prefix.length))).sort((a,b) => String(a.data().createdAt).localeCompare(String(b.data().createdAt)) || a.id.localeCompare(b.id)).map(d => ({ id: d.id, confirmedTitle: d.data().title as string }));
  return { key, ref, ledger: { prefix, entries } as NumberingLedger };
}
/** Pending IDs are derived from the shared ledger so exclusions update every pending suggestion. */
export async function hydrateNumbering(vouchers: CollectionReference, values: Voucher[]) {
  const keys = [...new Set(values.map(v => v.numberingWeek).filter((key): key is string => !!key))];
  if (!keys.length) return values;
  const ledgers = await adminDB.getAll(...keys.map(key => numberingRef(vouchers, key)));
  const suggestions = new Map(ledgers.filter(d => d.exists).map(d => [d.id, numberingSuggestions(d.data() as NumberingLedger)]));
  return values.map(v => v.numberingStatus === "pending" && v.numberingWeek ? { ...v, suggestedTitle: suggestions.get(v.numberingWeek)?.[v.id] || "" } : v);
}
