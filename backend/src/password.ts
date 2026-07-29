import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const derivedKeyLength = 64;
const scryptOptions = {
  N: 16_384,
  maxmem: 64 * 1024 * 1024,
  p: 1,
  r: 8,
} as const;
const dummyPasswordHash = [
  "scrypt",
  "16384",
  "8",
  "1",
  "ZGVzdGlueS1idW1teS1zYWx0",
  "QcbMn694l4Wwm790fLTee7OMOXmMCCBFp3i9bMiT3a4FHMJX9zy0Y3dTO8DyMj5hjc3Kx9c46jm-PNlKQamzSQ",
].join("$");

function derivePassword(
  password: string,
  salt: Buffer,
  options: ScryptOptions = scryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      derivedKeyLength,
      options,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await derivePassword(password, salt);

  return [
    "scrypt",
    String(scryptOptions.N),
    String(scryptOptions.r),
    String(scryptOptions.p),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash?: string) {
  const encoded = storedHash ?? dummyPasswordHash;
  const [algorithm, rawN, rawR, rawP, rawSalt, rawDerivedKey] =
    encoded.split("$");

  if (
    algorithm !== "scrypt" ||
    !rawN ||
    !rawR ||
    !rawP ||
    !rawSalt ||
    !rawDerivedKey
  ) {
    return false;
  }

  const expected = Buffer.from(rawDerivedKey, "base64url");
  const actual = await derivePassword(
    password,
    Buffer.from(rawSalt, "base64url"),
    {
      N: Number(rawN),
      maxmem: 64 * 1024 * 1024,
      p: Number(rawP),
      r: Number(rawR),
    },
  );

  return (
    expected.length === actual.length &&
    timingSafeEqual(expected, actual) &&
    storedHash !== undefined
  );
}
