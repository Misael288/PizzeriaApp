import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_ROLE, CASHIER_ROLE } from "@/lib/auth/constants";
import {
  createSessionRecord,
  deleteSessionById,
  deleteSessionsByTokenHash,
  findSessionByTokenHash,
} from "@/repositories/auth-repository";

const SESSION_COOKIE_NAME = "pizzeria_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 8;

type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: typeof ADMIN_ROLE | typeof CASHIER_ROLE;
};

const hashSessionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const createSession = async (
  userId: number,
  response: NextResponse,
): Promise<void> => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await createSessionRecord(userId, hashSessionToken(token), expiresAt);

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
};

const getAuthenticatedUser = async (): Promise<AuthenticatedUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await findSessionByTokenHash(hashSessionToken(token));

  if (
    !session ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.user.isActive ||
    (session.user.role.name !== ADMIN_ROLE &&
      session.user.role.name !== CASHIER_ROLE)
  ) {
    if (session) {
      await deleteSessionById(session.id);
    }

    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role.name,
  };
};

const destroySession = async (response: NextResponse): Promise<void> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await deleteSessionsByTokenHash(hashSessionToken(token));
  }

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
};

export {
  ADMIN_ROLE,
  CASHIER_ROLE,
  createSession,
  destroySession,
  getAuthenticatedUser,
};
export type { AuthenticatedUser };
