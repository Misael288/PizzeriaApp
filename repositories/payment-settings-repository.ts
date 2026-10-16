import { prisma } from "@/lib/database/prisma";

const TRANSFER_SETTING_KEYS = {
  bank: "transfer_bank",
  beneficiary: "transfer_beneficiary",
  clabe: "transfer_clabe",
  accountNumber: "transfer_account_number",
  instructions: "transfer_instructions",
} as const;

type TransferSettings = {
  bank: string;
  beneficiary: string;
  clabe: string;
  accountNumber: string;
  instructions: string;
};

const getTransferSettings = async (): Promise<TransferSettings> => {
  const rows = await prisma.configuracion_sistema.findMany({
    where: { clave: { in: Object.values(TRANSFER_SETTING_KEYS) } },
    select: { clave: true, valor: true },
  });
  const values = new Map(rows.map((row) => [row.clave, row.valor]));
  return {
    bank: values.get(TRANSFER_SETTING_KEYS.bank) ?? "",
    beneficiary: values.get(TRANSFER_SETTING_KEYS.beneficiary) ?? "",
    clabe: values.get(TRANSFER_SETTING_KEYS.clabe) ?? "",
    accountNumber: values.get(TRANSFER_SETTING_KEYS.accountNumber) ?? "",
    instructions: values.get(TRANSFER_SETTING_KEYS.instructions) ?? "",
  };
};

const saveTransferSettings = async (
  settings: TransferSettings,
): Promise<void> => {
  const values = [
    [TRANSFER_SETTING_KEYS.bank, settings.bank],
    [TRANSFER_SETTING_KEYS.beneficiary, settings.beneficiary],
    [TRANSFER_SETTING_KEYS.clabe, settings.clabe],
    [TRANSFER_SETTING_KEYS.accountNumber, settings.accountNumber],
    [TRANSFER_SETTING_KEYS.instructions, settings.instructions],
  ] as const;
  await prisma.$transaction(
    values.map(([clave, valor]) =>
      prisma.configuracion_sistema.upsert({
        where: { clave },
        create: { clave, valor },
        update: { valor },
      }),
    ),
  );
};

export { getTransferSettings, saveTransferSettings };
export type { TransferSettings };
