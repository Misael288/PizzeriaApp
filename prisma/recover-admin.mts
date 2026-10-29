import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Recuperación local de acceso administrativo.
// Sin variables: lista las cuentas de personal (sin mostrar contraseñas).
// Con RECOVER_EMAIL y RECOVER_PASSWORD: restablece la contraseña, activa la
// cuenta, la deja como ADMIN y cierra todas sus sesiones.

const MIN_PASSWORD_LENGTH = 14;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Mismo formato que lib/auth/password.ts: "salt_hex:key_hex" (scrypt).
const hashPassword = (password: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(SALT_LENGTH);
    scryptCallback(password, salt, KEY_LENGTH, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`${salt.toString("hex")}:${key.toString("hex")}`);
    });
  });

const main = async (): Promise<void> => {
  const prisma = new PrismaClient();
  const email = process.env.RECOVER_EMAIL?.trim().toLowerCase();
  const password = process.env.RECOVER_PASSWORD;

  try {
    if (!email || !password) {
      const users = await prisma.user.findMany({
        select: { name: true, email: true, isActive: true, role: { select: { name: true } } },
        orderBy: [{ role: { name: "asc" } }, { name: "asc" }],
      });
      console.table(
        users.map((user) => ({
          nombre: user.name,
          correo: user.email,
          rol: user.role.name,
          activo: user.isActive,
        })),
      );
      console.log(
        "Para restablecer, define RECOVER_EMAIL y RECOVER_PASSWORD y vuelve a ejecutar.",
      );
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            isActive: true,
            role: { connectOrCreate: { where: { name: "ADMIN" }, create: { name: "ADMIN" } } },
          },
        }),
        prisma.userSession.deleteMany({ where: { userId: existing.id } }),
      ]);
      console.log(`Contraseña restablecida y cuenta ADMIN activa: ${email}`);
      return;
    }

    await prisma.user.create({
      data: {
        name: "Administrador",
        email,
        passwordHash,
        role: { connectOrCreate: { where: { name: "ADMIN" }, create: { name: "ADMIN" } } },
      },
    });
    console.log(`Cuenta ADMIN creada: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Error inesperado.");
  process.exitCode = 1;
});
