import { hashPassword } from "@/lib/auth/password";
import {
  createStaffUser,
  createPendingRegistration,
  listStaffUsers,
  updateStaffUser,
} from "@/repositories/staff-user-repository";
import {
  parseCreateStaffUserInput,
  parsePublicRegistrationInput,
  parseUpdateStaffUserInput,
} from "@/validators/user-validator";

const getStaffUsers = () => listStaffUsers();

const registerPublicUser = async (input: unknown) => {
  const result = parsePublicRegistrationInput(input);
  if (!result.success) {
    return { success: false as const, status: 400, message: result.message };
  }
  const passwordHash = await hashPassword(result.data.password);
  await createPendingRegistration(result.data, passwordHash);
  return { success: true as const };
};

const addStaffUser = async (input: unknown) => {
  const result = parseCreateStaffUserInput(input);
  if (!result.success) {
    return { success: false as const, status: 400, message: result.message };
  }
  const passwordHash = await hashPassword(result.data.password);
  const user = await createStaffUser(result.data, passwordHash);
  return { success: true as const, user };
};

const editStaffUser = async (userId: number, input: unknown) => {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { success: false as const, status: 400, message: "ID inválido." };
  }
  const result = parseUpdateStaffUserInput(input);
  if (!result.success) {
    return { success: false as const, status: 400, message: result.message };
  }
  const passwordHash = result.data.password
    ? await hashPassword(result.data.password)
    : undefined;
  const user = await updateStaffUser(userId, result.data, passwordHash);
  return { success: true as const, user };
};

export {
  addStaffUser,
  editStaffUser,
  getStaffUsers,
  registerPublicUser,
};
