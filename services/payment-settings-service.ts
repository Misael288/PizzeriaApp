import { listPaymentMethods } from "@/repositories/order-repository";
import {
  getTransferSettings,
  saveTransferSettings,
} from "@/repositories/payment-settings-repository";
import { parseTransferSettings } from "@/validators/payment-validator";

const isTransferConfigured = (settings: {
  bank: string;
  beneficiary: string;
  clabe: string;
}) =>
  Boolean(
    settings.bank &&
      settings.beneficiary &&
      /^\d{18}$/.test(settings.clabe.replace(/[\s-]/g, "")),
  );

const getPublicPaymentOptions = async () => {
  const [methods, transfer] = await Promise.all([
    listPaymentMethods(),
    getTransferSettings(),
  ]);
  const transferConfigured = isTransferConfigured(transfer);
  return {
    methods: methods.map((method) => ({
      id: method.id_metodo_pago,
      name: method.nombre,
      enabled: method.nombre !== "Transferencia" || transferConfigured,
    })),
  };
};

const getAdminTransferSettings = () => getTransferSettings();

const getPublicTransferDetails = async () => {
  const settings = await getTransferSettings();
  return isTransferConfigured(settings) ? settings : null;
};

const updateAdminTransferSettings = async (input: unknown) => {
  const result = parseTransferSettings(input);
  if (!result.success) {
    return {
      success: false as const,
      message: result.message,
    };
  }
  await saveTransferSettings(result.data);
  return { success: true as const, settings: result.data };
};

const isTransferPaymentMethod = async (methodId: number) => {
  const methods = await listPaymentMethods();
  return methods.some(
    (method) =>
      method.id_metodo_pago === methodId && method.nombre === "Transferencia",
  );
};

export {
  getAdminTransferSettings,
  getPublicPaymentOptions,
  getPublicTransferDetails,
  isTransferConfigured,
  isTransferPaymentMethod,
  updateAdminTransferSettings,
};
