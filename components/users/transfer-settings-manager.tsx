"use client";

import { useEffect, useState, type FormEvent } from "react";

type TransferSettings = {
  bank: string;
  beneficiary: string;
  clabe: string;
  accountNumber: string;
  instructions: string;
};

const EMPTY_SETTINGS: TransferSettings = {
  bank: "",
  beneficiary: "",
  clabe: "",
  accountNumber: "",
  instructions: "",
};

const errorMessage = async (response: Response): Promise<string> => {
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

export function TransferSettingsManager() {
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/payment-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response));
        return (await response.json()) as { settings: TransferSettings };
      })
      .then((result) => setSettings(result.settings))
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar la configuración.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = (await response.json()) as {
        settings: TransferSettings;
      };
      setSettings(result.settings);
      setNotice(
        "Datos guardados. Los clientes podrán verlos al elegir Transferencia.",
      );
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

  if (loading) {
    return <p className="rounded-xl bg-white p-6">Cargando configuración...</p>;
  }

  return (
    <div className="space-y-5">
      <form
        className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm md:grid-cols-2"
        onSubmit={(event) => void save(event)}
      >
        <p className="text-sm text-stone-600 md:col-span-2">
          Estos datos se mostrarán públicamente a los clientes que seleccionen
          Transferencia. No ingreses información bancaria que no quieras
          publicar.
        </p>
        <label className="grid gap-1 text-sm font-semibold">
          Banco
          <input
            autoComplete="off"
            className="rounded-lg border border-stone-300 px-3 py-2"
            maxLength={100}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                bank: event.target.value,
              }))
            }
            required
            value={settings.bank}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Beneficiario
          <input
            autoComplete="off"
            className="rounded-lg border border-stone-300 px-3 py-2"
            maxLength={150}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                beneficiary: event.target.value,
              }))
            }
            required
            value={settings.beneficiary}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          CLABE interbancaria (18 dígitos)
          <input
            autoComplete="off"
            className="rounded-lg border border-stone-300 px-3 py-2"
            inputMode="numeric"
            maxLength={50}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                clabe: event.target.value,
              }))
            }
            pattern="[0-9 -]{18,50}"
            required
            value={settings.clabe}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Número de cuenta (opcional)
          <input
            autoComplete="off"
            className="rounded-lg border border-stone-300 px-3 py-2"
            maxLength={40}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                accountNumber: event.target.value,
              }))
            }
            value={settings.accountNumber}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">
          Instrucciones para el cliente (opcional)
          <textarea
            className="rounded-lg border border-stone-300 px-3 py-2"
            maxLength={255}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                instructions: event.target.value,
              }))
            }
            rows={3}
            value={settings.instructions}
          />
        </label>
        {error && (
          <p
            className="rounded-lg bg-red-50 p-3 text-sm text-red-800 md:col-span-2"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            className="rounded-lg bg-green-50 p-3 text-sm text-green-800 md:col-span-2"
            role="status"
          >
            {notice}
          </p>
        )}
        <button
          className="rounded-lg bg-red-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60 md:col-span-2 md:justify-self-start"
          disabled={saving}
          type="submit"
        >
          {saving ? "Guardando..." : "Guardar datos de transferencia"}
        </button>
      </form>
    </div>
  );
}
