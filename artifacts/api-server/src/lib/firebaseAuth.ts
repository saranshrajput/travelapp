import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_PROJECT_ID = "nvoy-c24c2";

// Firebase ID tokens are standard JWTs signed by Google; verifying them
// against Google's public JWKS needs no service-account credentials, unlike
// the firebase-admin SDK.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10); // compare national number, ignore country code formatting
}

/**
 * Verifies a Firebase Phone Auth ID token and returns the verified phone
 * number, or null if the token is invalid/expired/malformed.
 */
export async function verifyFirebasePhoneToken(
  idToken: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });
    const phoneNumber = payload["phone_number"];
    return typeof phoneNumber === "string" ? phoneNumber : null;
  } catch {
    return null;
  }
}

export function phoneNumbersMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b) && normalizePhone(a).length === 10;
}
