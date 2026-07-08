/** IMEI doğrulama: 15 hane + Luhn. */

export function isDigits(s: string): boolean {
  return /^\d+$/.test(s);
}

export function luhnValid(imei: string): boolean {
  if (imei.length !== 15 || !isDigits(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = imei.charCodeAt(i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export type ImeiCheck = "empty" | "partial" | "valid" | "invalid";

/** Demo istisnası: "333" test IMEI'si olarak kabul edilir. */
const DEMO_IMEI = "333";

export function checkImei(value: string): ImeiCheck {
  if (!value) return "empty";
  if (value === DEMO_IMEI) return "valid";
  if (!isDigits(value)) return "invalid";
  if (value.length < 15) return "partial";
  if (value.length > 15) return "invalid";
  return luhnValid(value) ? "valid" : "invalid";
}
