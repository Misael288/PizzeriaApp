import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/database/prisma";
import type {
  CreateStaffUserInput,
  AccountRole,
  PublicRegistrationInput,
  UpdateStaffUserInput,
} from "@/validators/user-validator";

type SafeStaffUser = {
  id: number;
  name: string;
  email: string;
  role: AccountRole;
  isActive: boolean;
  createdAt: Date;
};

class LastActiveAdministratorError extends Error {
  constructor() {
    super("No se puede desactivar o cambiar el último administrador activo.");
    this.name = "LastActiveAdministratorError";
  }
}

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
  role: { select: { name: true } },
} as const;

const mapSafeUser = (user: {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  role: { name: string };
}): SafeStaffUser => {
  if (
    user.role.name !== "ADMIN" &&
    user.role.name !== "CASHIER" &&
    user.role.name !== "PENDING"
  ) {
    throw new Error("UNSUPPORTED_STAFF_ROLE");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt,
    role: user.role.name,
  };
};

const listStaffUsers = async (): Promise<SafeStaffUser[]> => {
  const users = await prisma.user.findMany({
    where: { role: { name: { in: ["ADMIN", "CASHIER", "PENDING"] } } },
    select: safeUserSelect,
    orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
  });
  return users.map(mapSafeUser);
};

const createPendingRegistration = async (
  input: PublicRegistrationInput,
  passwordHash: string,
): Promise<void> => {
  await prisma.$transaction(async (transaction) => {
    const role = await transaction.role.upsert({
      where: { name: "PENDING" },
      update: {},
      create: { name: "PENDING" },
    });
    await transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        isActive: false,
        roleId: role.id,
      },
      select: { id: true },
    });
  });
};

const createStaffUser = async (
  input: CreateStaffUserInput,
  passwordHash: string,
): Promise<SafeStaffUser> => {
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: { connectOrCreate: {
        where: { name: input.role },
        create: { name: input.role },
      } },
    },
    select: safeUserSelect,
  });
  return mapSafeUser(user);
};

const updateStaffUser = async (
  userId: number,
  input: UpdateStaffUserInput,
  passwordHash?: string,
): Promise<SafeStaffUser> =>
  prisma.$transaction(
    async (transaction) => {
      const current = await transaction.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (
        !current ||
        !["ADMIN", "CASHIER", "PENDING"].includes(current.role.name)
      ) {
        throw new Error("USER_NOT_FOUND");
      }
      if (
        current.role.name === "PENDING" &&
        input.isActive === true &&
        input.role === undefined
      ) {
        throw new Error("PENDING_APPROVAL_ROLE_REQUIRED");
      }

      const targetRole = input.role
        ? await transaction.role.upsert({
            where: { name: input.role },
            update: {},
            create: { name: input.role },
          })
        : current.role;
      const approvingPending =
        current.role.name === "PENDING" &&
        input.role !== undefined;
      const nextIsActive = approvingPending
        ? true
        : (input.isActive ?? current.isActive);
      const isRemovingAdmin =
        current.role.name === "ADMIN" &&
        current.isActive &&
        (targetRole.name !== "ADMIN" || !nextIsActive);

      if (isRemovingAdmin) {
        const activeAdminCount = await transaction.user.count({
          where: { role: { name: "ADMIN" }, isActive: true },
        });
        if (activeAdminCount <= 1) {
          throw new LastActiveAdministratorError();
        }
      }

      const user = await transaction.user.update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.isActive !== undefined
            ? { isActive: input.isActive }
            : {}),
          ...(approvingPending ? { isActive: true } : {}),
          ...(input.role !== undefined ? { roleId: targetRole.id } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: safeUserSelect,
      });

      if (
        input.isActive === false ||
        input.role !== undefined ||
        passwordHash !== undefined
      ) {
        await transaction.userSession.deleteMany({ where: { userId } });
      }
      return mapSafeUser(user);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

export {
  createStaffUser,
  createPendingRegistration,
  LastActiveAdministratorError,
  listStaffUsers,
  updateStaffUser,
};
export type { SafeStaffUser };
