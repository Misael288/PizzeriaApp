import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  findPasswordHashByUserId,
  updatePasswordHash,
} from "@/repositories/auth-repository";

class ProfileServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "ProfileServiceError";
  }
}

const changeOwnPassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const currentHash = await findPasswordHashByUserId(userId);
  if (!currentHash) {
    throw new ProfileServiceError("No se encontró la cuenta.", 404);
  }

  if (!(await verifyPassword(currentPassword, currentHash))) {
    throw new ProfileServiceError("La contraseña actual es incorrecta.", 400);
  }

  if (await verifyPassword(newPassword, currentHash)) {
    throw new ProfileServiceError(
      "La nueva contraseña debe ser diferente a la actual.",
      400,
    );
  }

  await updatePasswordHash(userId, await hashPassword(newPassword));
};

export { changeOwnPassword, ProfileServiceError };
