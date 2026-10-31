import { prisma } from "@/lib/database/prisma";

const BRAND_LOGO_KEY = "brand_logo";
const userAvatarKey = (userId: number): string => `user_avatar_${userId}`;

const getSetting = async (key: string): Promise<string | null> => {
  const setting = await prisma.configuracion_sistema.findUnique({
    where: { clave: key },
    select: { valor: true },
  });
  return setting?.valor || null;
};

const saveSetting = async (key: string, value: string): Promise<void> => {
  await prisma.configuracion_sistema.upsert({
    where: { clave: key },
    create: { clave: key, valor: value },
    update: { valor: value },
  });
};

const getBrandLogo = (): Promise<string | null> => getSetting(BRAND_LOGO_KEY);
const saveBrandLogo = (logo: string): Promise<void> =>
  saveSetting(BRAND_LOGO_KEY, logo);
const getUserAvatar = (userId: number): Promise<string | null> =>
  getSetting(userAvatarKey(userId));
const saveUserAvatar = (userId: number, avatar: string): Promise<void> =>
  saveSetting(userAvatarKey(userId), avatar);

export { getBrandLogo, getUserAvatar, saveBrandLogo, saveUserAvatar };
