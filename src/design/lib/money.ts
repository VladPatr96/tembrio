/**
 * How an amount of money reads everywhere in Tembrio: «Сегодня …» in the
 * window header, the tray panel, the Costs page, the low-balance messages.
 *
 * OpenRouter bills in dollars, so every amount arrives in USD. In roubles it
 * is converted at the Central Bank rate (roubles per dollar).
 *
 * The rule, chosen by the product owner: small amounts get more precision,
 * large ones fewer digits.
 *
 * - Dollars: two digits from a cent up («$0.18»), four digits below a cent
 *   («$0.0042»), and «<$0.001» for anything smaller — a sentence costs about
 *   $0.0004 and must never read as «$0.00», or the spending looks broken.
 * - Roubles: kopecks below 100 ₽ («17,35 ₽»), whole roubles from 100 ₽ up
 *   («1 195 ₽»), thousands split by a space, and a decimal comma.
 * - Digits are cut, never rounded up: showing less than was spent can never
 *   contradict the OpenRouter balance.
 */

export type Currency = "usd" | "rub";

const CENT = 0.01;
const TINY = 0.001;
const GROUPED_RUB = 100;
/** Keeps digits and their currency sign from wrapping apart. */
const NBSP = "\u00a0";

/** Cut digits instead of rounding: never show more than was actually spent. */
function cut(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.floor(value * scale) / scale;
}

/** 1195 → «1 195» with non-breaking spaces. */
function group(whole: number): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

function inDollars(amount: number): string {
  const size = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (size >= CENT) return `${sign}$${cut(size, 2).toFixed(2)}`;
  if (size >= TINY) return `${sign}$${cut(size, 4).toFixed(4)}`;
  if (size === 0) return "$0.00";
  return `${sign}<$0.001`;
}

function inRoubles(amount: number, rubPerUsd: number): string {
  const size = Math.abs(amount) * rubPerUsd;
  const sign = amount < 0 ? "-" : "";
  if (size >= GROUPED_RUB) return `${sign}${group(cut(size, 0))}${NBSP}₽`;
  if (size >= CENT) {
    return `${sign}${cut(size, 2).toFixed(2).replace(".", ",")}${NBSP}₽`;
  }
  if (size === 0) return `0,00${NBSP}₽`;
  return `${sign}<0,01${NBSP}₽`;
}

/**
 * @param usd amount in US dollars, as OpenRouter reports it
 * @param currency which of the two currencies the person reads
 * @param rubPerUsd today's Central Bank rate; without a usable rate the
 *   amount is shown in dollars, because «0,00 ₽» would be a lie
 */
export function formatMoney(
  usd: number,
  currency: Currency,
  rubPerUsd: number,
): string {
  if (!Number.isFinite(usd)) return "—";
  const rateUsable = Number.isFinite(rubPerUsd) && rubPerUsd > 0;
  return currency === "rub" && rateUsable
    ? inRoubles(usd, rubPerUsd)
    : inDollars(usd);
}
