"use client";

import { useEffect, useState, type FormEvent } from "react";

const responseMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return "No fue posible completar la operación.";
};

export function ProfanitySettings() {
  const [words, setWords] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/profanity", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseMessage(response));
        const result: unknown = await response.json();
        if (
          typeof result !== "object" ||
          result === null ||
          !("words" in result) ||
          !Array.isArray(result.words) ||
          !result.words.every((word) => typeof word === "string")
        ) {
          throw new Error("La respuesta de configuración no es válida.");
        }
        setWords(result.words.join("\n"));
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar la configuración.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/profanity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          words: words
            .split(/\r?\n/)
            .map((word) => word.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as { words: string[] };
      setWords(result.words.join("\n"));
      setNotice("Lista de palabras actualizada.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar la configuración.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      onSubmit={(event) => void save(event)}
    >
      <label className="block text-sm font-semibold text-stone-800">
        Palabras no permitidas (una por línea; máximo 30)
        <textarea
          className="mt-2 min-h-56 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
          disabled={loading}
          maxLength={255}
          onChange={(event) => setWords(event.target.value)}
          placeholder={"Escribe una palabra por línea"}
          value={words}
        />
      </label>
      <p className="text-sm text-stone-600">
        Se comparan sin distinguir mayúsculas, acentos ni signos separadores. Se
        validan nombres y descripciones de productos e ingredientes, y nombre y
        dirección del cliente al enviar un pedido.
      </p>
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 p-3 text-green-800" role="status">{notice}</p>}
      <button
        className="rounded-lg bg-red-700 px-5 py-3 font-semibold text-white disabled:opacity-60"
        disabled={loading || saving}
        type="submit"
      >
        {loading ? "Cargando..." : saving ? "Guardando..." : "Guardar lista"}
      </button>
    </form>
  );
}
