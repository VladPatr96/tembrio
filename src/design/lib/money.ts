/**
 * How an amount of money reads everywhere in Tembrio: «Сегодня …» in the
 * window header, the tray panel, the Costs page, the low-balance messages.
 *
 * OpenRouter bills in dollars, so every amount arrives in USD. In roubles it
 * is converted at the Central Bank rate (roubles per dollar).
 */

export type Currency = "usd" | "rub";

export function formatMoney(
  usd: number,
  currency: Currency,
  rubPerUsd: number,
): string {
  // TODO(human): the rule for showing an amount.
  // Today's spend is often tiny (a sentence costs ~$0.0004), the monthly
  // total is dollars, the balance can be $20+. Decide how many digits each
  // gets, what a near-zero amount looks like, and the rouble format
  // (e.g. «18,40 ₽» with a decimal comma). The prototype used:
  // usd → "$" + 2 digits; rub → 2 digits under 100 ₽, whole roubles above.
  if (currency === "rub") return `${(usd * rubPerUsd).toFixed(2)} ₽`;
  return `$${usd.toFixed(2)}`;
}
