import { prisma } from "@/lib/database/prisma";

const PROFANITY_SETTING_KEY = "profanity_blocklist";

const listForbiddenWords = async (): Promise<string[]> => {
  const setting = await prisma.configuracion_sistema.findUnique({
    where: { clave: PROFANITY_SETTING_KEY },
    select: { valor: true },
  });
  if (!setting) return [];
  const value: unknown = JSON.parse(setting.valor);
  if (
    !Array.isArray(value) ||
    !value.every((word): word is string => typeof word === "string")
  ) {
    throw new Error("PROFANITY_SETTING_INVALID");
  }
  return value;
};

const saveForbiddenWords = async (words: string[]) => {
  const value = JSON.stringify(words);
  await prisma.configuracion_sistema.upsert({
    where: { clave: PROFANITY_SETTING_KEY },
    create: { clave: PROFANITY_SETTING_KEY, valor: value },
    update: { valor: value },
  });
};

export { listForbiddenWords, saveForbiddenWords };
