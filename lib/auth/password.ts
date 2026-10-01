import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const deriveKey = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, PASSWORD_KEY_LENGTH, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);

  return `${salt.toString("hex")}:${key.toString("hex")}`;
};

const verifyPassword = async (
  password: string,
  storedHash: string,
): Promise<boolean> => {
  const [saltHex, keyHex, extra] = storedHash.split(":");

  if (!saltHex || !keyHex || extra || !/^[a-f0-9]+$/i.test(saltHex + keyHex)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");

  if (salt.length !== SALT_LENGTH || expectedKey.length !== PASSWORD_KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveKey(password, salt);
  return timingSafeEqual(actualKey, expectedKey);
};

const verifyAgainstDummyHash = async (password: string): Promise<void> => {
  const dummySalt = Buffer.alloc(SALT_LENGTH, 0x5a);
  await deriveKey(password, dummySalt);
};

export { hashPassword, verifyAgainstDummyHash, verifyPassword };
