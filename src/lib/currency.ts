// Indian number formatting: ₹1,02,000 style.
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const INRDec = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(n: number | null | undefined, opts?: { decimals?: boolean }) {
  if (n == null || Number.isNaN(n)) return "—";
  return opts?.decimals ? INRDec.format(n) : INR.format(Math.round(n));
}

export function formatSigned(n: number) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatINR(Math.abs(n))}`;
}
