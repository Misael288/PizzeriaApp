type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const parsePasswordChangeInput = (
  value: unknown,
): ValidationResult<PasswordChangeInput> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { success: false, message: "Los datos no son válidos." };
  }

  if (
    !("currentPassword" in value) ||
    !("newPassword" in value) ||
    !("confirmPassword" in value) ||
    typeof value.currentPassword !== "string" ||
    typeof value.newPassword !== "string" ||
    typeof value.confirmPassword !== "string"
  ) {
    return {
      success: false,
      message: "Completa los campos de contraseña correctamente.",
    };
  }

  if (value.currentPassword.length < 1 || value.currentPassword.length > 200) {
    return { success: false, message: "La contraseña actual no es válida." };
  }

  if (value.newPassword.length < 14 || value.newPassword.length > 200) {
    return {
      success: false,
      message: "La nueva contraseña debe tener entre 14 y 200 caracteres.",
    };
  }

  if (value.newPassword !== value.confirmPassword) {
    return { success: false, message: "Las contraseñas nuevas no coinciden." };
  }

  return {
    success: true,
    data: {
      currentPassword: value.currentPassword,
      newPassword: value.newPassword,
    },
  };
};

export { parsePasswordChangeInput };
