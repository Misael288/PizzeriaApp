import {
  verifyAgainstDummyHash,
  verifyPassword,
  hashPassword,
} from "@/lib/auth/password";
import { ADMIN_ROLE, CASHIER_ROLE } from "@/lib/auth/constants";
import {
  createInitialRoleAccounts,
  findUserForAuthentication,
} from "@/repositories/auth-repository";

type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: typeof ADMIN_ROLE | typeof CASHIER_ROLE;
};

type InitialAccount = {
  name: string;
  email: string;
  password: string;
};

const authenticateCredentials = async (
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> => {
  const user = await findUserForAuthentication(email);

  if (!user) {
    await verifyAgainstDummyHash(password);
    return null;
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  const role = user.role.name;

  if (
    !validPassword ||
    !user.isActive ||
    (role !== ADMIN_ROLE && role !== CASHIER_ROLE)
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
  };
};

const bootstrapInitialAccounts = async (
  administrator: InitialAccount,
  cashier: InitialAccount,
): Promise<boolean> => {
  const [adminPasswordHash, cashierPasswordHash] = await Promise.all([
    hashPassword(administrator.password),
    hashPassword(cashier.password),
  ]);

  return createInitialRoleAccounts(
    {
      name: administrator.name,
      email: administrator.email,
      passwordHash: adminPasswordHash,
    },
    {
      name: cashier.name,
      email: cashier.email,
      passwordHash: cashierPasswordHash,
    },
  );
};

export { authenticateCredentials, bootstrapInitialAccounts };
