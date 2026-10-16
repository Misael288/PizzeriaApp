import type { TransferSettings } from "@/repositories/payment-settings-repository";

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseTransferSettings = (
  value: unknown,
): ValidationResult<TransferSettings> => {
  if (!isRecord(value)) {
    return { success: false, message: "Los datos de transferencia no son válidos." };
  }
  const fields = [
    ["bank", "El banco", 100],
    ["beneficiary", "El beneficiario", 150],
    ["clabe", "La CLABE", 50],
    ["accountNumber", "La cuenta", 40],
    ["instructions", "Las instrucciones", 255],
  ] as const;
  const parsed: Record<(typeof fields)[number][0], string> = {
    bank: "",
    beneficiary: "",
    clabe: "",
    accountNumber: "",
    instructions: "",
  };
  for (const [key, label, maxLength] of fields) {
    const field = value[key];
    if (typeof field !== "string" || field.trim().length > maxLength) {
      return {
        success: false,
        message: `${label} no es válido o supera el límite permitido.`,
      };
    }
    parsed[key] = field.trim();
  }
  if (!parsed.bank || !parsed.beneficiary) {
    return {
      success: false,
      message: "Banco y beneficiario son obligatorios.",
    };
  }
  if (!/^\d{18}$/.test(parsed.clabe.replace(/[\s-]/g, ""))) {
    return {
      success: false,
      message: "La CLABE debe contener exactamente 18 dígitos.",
    };
  }
  if (
    parsed.accountNumber &&
    !/^[\da-zA-Z-]{4,20}$/.test(parsed.accountNumber)
  ) {
    return {
      success: false,
      message: "El número de cuenta debe tener de 4 a 20 caracteres válidos.",
    };
  }
  return {
    success: true,
    data: { ...parsed, clabe: parsed.clabe.replace(/[\s-]/g, "") },
  };
};

export { parseTransferSettings };
