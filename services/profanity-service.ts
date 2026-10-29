import {
  listForbiddenWords,
  saveForbiddenWords,
} from "@/repositories/profanity-repository";

const normalizeForWordMatch = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getProfanityWords = () => listForbiddenWords();

const containsForbiddenText = async (value: string): Promise<boolean> => {
  const normalizedText = ` ${normalizeForWordMatch(value)} `;
  const words = await listForbiddenWords();
  return words.some((word) => {
    const normalizedWord = normalizeForWordMatch(word);
    return normalizedWord.length > 0 &&
      normalizedText.includes(` ${normalizedWord} `);
  });
};

const updateProfanityWords = async (
  value: unknown,
): Promise<{ success: true; words: string[] } | { success: false; message: string }> => {
  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    !value.every(
      (word) =>
        typeof word === "string" &&
        word.trim().length > 0 &&
        word.trim().length <= 40,
    )
  ) {
    return {
      success: false,
      message: "La lista debe contener hasta 30 palabras de 1 a 40 caracteres.",
    };
  }
  const words = [
    ...new Set(
      value.map((word: string) => normalizeForWordMatch(word).trim()),
    ),
  ];
  if (words.some((word) => !word || word.includes(" "))) {
    return {
      success: false,
      message: "Cada entrada debe ser una sola palabra.",
    };
  }
  if (JSON.stringify(words).length > 255) {
    return {
      success: false,
      message: "La lista completa supera el límite de almacenamiento.",
    };
  }
  await saveForbiddenWords(words);
  return { success: true, words };
};

export {
  containsForbiddenText,
  getProfanityWords,
  updateProfanityWords,
};
