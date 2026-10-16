import { createHash, randomBytes } from "node:crypto";

const createTrackingToken = (): string => randomBytes(32).toString("base64url");

const hashTrackingToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const isValidTrackingToken = (token: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(token);

export { createTrackingToken, hashTrackingToken, isValidTrackingToken };
