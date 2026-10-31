"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";

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
  return "No fue posible actualizar el logotipo.";
};

export function BrandingSettings({
  initialLogo,
}: {
  initialLogo: string | null;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(initialLogo);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveLogo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setError("");
    if (!selectedImage) {
      setError("Selecciona una imagen para el logotipo.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedImage);
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/branding/logo", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("logo" in body) ||
        typeof body.logo !== "string"
      ) {
        throw new Error("El servidor devolvió una respuesta de logotipo inválida.");
      }
      setLogo(body.logo);
      setSelectedImage(null);
      if (imageInput.current) imageInput.current.value = "";
      setNotice("Logotipo actualizado en el panel.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible actualizar el logotipo.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetLogo = async () => {
    setNotice("");
    setError("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/branding/logo", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setLogo(null);
      setSelectedImage(null);
      if (imageInput.current) imageInput.current.value = "";
      setNotice("Se restauró el nombre predeterminado.");
    } catch (resetError: unknown) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "No fue posible restablecer el logotipo.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-xl font-extrabold text-[#25364B]">
        Logotipo del panel
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Personaliza la marca que aparece en la parte superior izquierda del
        panel. Se aceptan PNG, JPEG y WebP de hasta 5 MB.
      </p>

      <div className="mt-5 flex min-h-20 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        {logo ? (
          <Image
            src={logo}
            alt="Logotipo actual"
            width={320}
            height={100}
            unoptimized
            className="max-h-16 w-auto max-w-full object-contain"
          />
        ) : (
          <span className="text-xl font-extrabold tracking-tight text-[#25364B]">
            Pizzería Planeta
          </span>
        )}
      </div>

      {notice && (
        <p
          aria-live="polite"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          aria-live="polite"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <form className="mt-5 flex flex-wrap items-center gap-3" onSubmit={(event) => void saveLogo(event)}>
        <input
          ref={imageInput}
          accept="image/png,image/jpeg,image/webp"
          className="block w-full max-w-sm text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:font-semibold file:text-[#26374D] hover:file:bg-slate-200"
          onChange={(event) => {
            setSelectedImage(event.target.files?.[0] ?? null);
            setError("");
          }}
          type="file"
        />
        <button
          className="min-h-10 rounded-lg bg-[#D94B3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#B93A31] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!selectedImage || isSaving}
          type="submit"
        >
          {isSaving ? "Guardando..." : "Guardar logotipo"}
        </button>
        {logo && (
          <button
            className="min-h-10 rounded-lg border border-[#D8E1EC] px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            disabled={isSaving}
            onClick={() => void resetLogo()}
            type="button"
          >
            Restaurar nombre
          </button>
        )}
      </form>
    </section>
  );
}
