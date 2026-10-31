import { prisma } from "@/lib/database/prisma";

type NewUser = {
  name: string;
  email: string;
  passwordHash: string;
};

const findUserForAuthentication = (email: string) =>
  prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

const findPasswordHashByUserId = async (
  userId: number,
): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return user?.passwordHash ?? null;
};

const updatePasswordHash = async (
  userId: number,
  passwordHash: string,
): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};

const findSessionByTokenHash = (tokenHash: string) =>
  prisma.userSession.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

const createSessionRecord = (
  userId: number,
  tokenHash: string,
  expiresAt: Date,
) =>
  prisma.userSession.create({
    data: { tokenHash, userId, expiresAt },
  });

const deleteSessionById = (id: string) =>
  prisma.userSession.delete({ where: { id } });

const deleteSessionsByTokenHash = (tokenHash: string) =>
  prisma.userSession.deleteMany({ where: { tokenHash } });

const createInitialRoleAccounts = async (
  administrator: NewUser,
  cashier: NewUser,
): Promise<boolean> =>
  prisma.$transaction(async (transaction) => {
    const adminRole = await transaction.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN" },
    });

    const cashierRole = await transaction.role.upsert({
      where: { name: "CASHIER" },
      update: {},
      create: { name: "CASHIER" },
    });

    const existingAdmin = await transaction.user.findFirst({
      where: { roleId: adminRole.id },
      select: { id: true },
    });

    if (existingAdmin) {
      return false;
    }

    await transaction.user.createMany({
      data: [
        { ...administrator, roleId: adminRole.id },
        { ...cashier, roleId: cashierRole.id },
      ],
    });

    return true;
  });

export {
  createInitialRoleAccounts,
  createSessionRecord,
  deleteSessionById,
  deleteSessionsByTokenHash,
  findPasswordHashByUserId,
  findSessionByTokenHash,
  findUserForAuthentication,
  updatePasswordHash,
};
