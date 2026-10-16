type StaffRole = "ADMIN" | "CASHIER";
type AccountRole = StaffRole | "PENDING";

type PublicRegistrationInput = {
  name: string;
  email: string;
  password: string;
};

type CreateStaffUserInput = {
  name: string;
  email: string;
  password: string;
  role: StaffRole;
};

type UpdateStaffUserInput = {
  name?: string;
  email?: string;
  password?: string;
  role?: StaffRole;
  isActive?: boolean;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseName = (value: unknown): string | null =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= 150
    ? value.trim()
    : null;

const parseEmail = (value: unknown): string | null => {
  if (
    typeof value !== "string" ||
    value.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  ) {
    return null;
  }
  return value.trim().toLowerCase();
};

const isStaffRole = (value: unknown): value is StaffRole =>
  value === "ADMIN" || value === "CASHIER";

const parseCreateStaffUserInput = (
  value: unknown,
): ValidationResult<CreateStaffUserInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "El usuario debe ser un objeto." };
  }
  const name = parseName(value.name);
  const email = parseEmail(value.email);
  if (!name || !email) {
    return {
      success: false,
      message: "Nombre o correo inválido.",
    };
  }
  if (
    typeof value.password !== "string" ||
    value.password.length < 14 ||
    value.password.length > 200
  ) {
    return {
      success: false,
      message: "La contraseña debe tener entre 14 y 200 caracteres.",
    };
  }
  if (!isStaffRole(value.role)) {
    return {
      success: false,
      message: "El rol debe ser ADMIN o CASHIER.",
    };
  }
  return {
    success: true,
    data: { name, email, password: value.password, role: value.role },
  };
};

const parsePublicRegistrationInput = (
  value: unknown,
): ValidationResult<PublicRegistrationInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "Los datos del registro no son válidos." };
  }
  const name = parseName(value.name);
  const email = parseEmail(value.email);
  if (!name || !email) {
    return {
      success: false,
      message: "Nombre o correo electrónico inválido.",
    };
  }
  if (
    typeof value.password !== "string" ||
    value.password.length < 14 ||
    value.password.length > 200
  ) {
    return {
      success: false,
      message: "La contraseña debe tener entre 14 y 200 caracteres.",
    };
  }
  return {
    success: true,
    data: { name, email, password: value.password },
  };
};

const parseUpdateStaffUserInput = (
  value: unknown,
): ValidationResult<UpdateStaffUserInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "La actualización no es válida." };
  }
  const result: UpdateStaffUserInput = {};
  if (value.name !== undefined) {
    const name = parseName(value.name);
    if (!name) {
      return { success: false, message: "El nombre no es válido." };
    }
    result.name = name;
  }
  if (value.email !== undefined) {
    const email = parseEmail(value.email);
    if (!email) {
      return { success: false, message: "El correo no es válido." };
    }
    result.email = email;
  }
  if (value.password !== undefined) {
    if (
      typeof value.password !== "string" ||
      value.password.length < 14 ||
      value.password.length > 200
    ) {
      return {
        success: false,
        message: "La contraseña debe tener entre 14 y 200 caracteres.",
      };
    }
    result.password = value.password;
  }
  if (value.role !== undefined) {
    if (!isStaffRole(value.role)) {
      return {
        success: false,
        message: "El rol debe ser ADMIN o CASHIER.",
      };
    }
    result.role = value.role;
  }
  if (value.isActive !== undefined) {
    if (typeof value.isActive !== "boolean") {
      return {
        success: false,
        message: "La disponibilidad del usuario debe ser booleana.",
      };
    }
    result.isActive = value.isActive;
  }
  if (Object.keys(result).length === 0) {
    return {
      success: false,
      message: "Indica al menos un campo para actualizar.",
    };
  }
  return { success: true, data: result };
};

export {
  parseCreateStaffUserInput,
  parsePublicRegistrationInput,
  parseUpdateStaffUserInput,
};
export type {
  AccountRole,
  CreateStaffUserInput,
  PublicRegistrationInput,
  StaffRole,
  UpdateStaffUserInput,
};
