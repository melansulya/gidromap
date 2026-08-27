import * as OTPAuth from "otpauth";

const ISSUER = "AI Gidromap";

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function buildTotp(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export function otpauthUrl(email: string, secret: string): string {
  return buildTotp(email, secret).toString();
}

// window: 1 = allow one 30s step of clock drift on either side
export function verifyTotp(email: string, secret: string, code: string): boolean {
  const totp = buildTotp(email, secret);
  return totp.validate({ token: code.trim(), window: 1 }) !== null;
}
