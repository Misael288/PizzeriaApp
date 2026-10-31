"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";

type ProfileSettingsProps = {
  name: string;
  email: string;
  role: string;
  initialAvatar: string | null;
};

const responseMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return fallback;
};

export function ProfileSettings({
  name,
  email,
  role,
  initialAvatar,
}: ProfileSettingsProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const saveAvatar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setError("");

    if (!selectedImage) {
      setError("Selecciona una imagen antes de continuar.");
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedImage);
    setIsSavingAvatar(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No fue posible guardar la foto."),
        );
      }

      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("avatar" in body) ||
        typeof body.avatar !== "string"
      ) {
        throw new Error("El servidor devolvió una respuesta de foto inválida.");
      }

      setAvatar(body.avatar);
      setSelectedImage(null);
      if (imageInput.current) imageInput.current.value = "";
      setNotice("Foto de perfil actualizada.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No fue posible guardar la foto.",
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setNotice("");
    setError("");
    setIsRemovingAvatar(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No fue posible quitar la foto."),
        );
      }
      setAvatar(null);
      setSelectedImage(null);
      if (imageInput.current) imageInput.current.value = "";
      setNotice("Foto de perfil eliminada.");
    } catch (removeError: unknown) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "No fue posible quitar la foto.",
      );
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No fue posible cambiar la contraseña."),
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Contraseña actualizada correctamente.");
    } catch (changeError: unknown) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "No fue posible cambiar la contraseña.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <p
          aria-live="polite"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D1D5DB] text-3xl font-bold text-[#26374D]">
            {avatar ? (
              <Image
                src={avatar}
                alt={`Foto de ${name}`}
                width={96}
                height={96}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toLocaleUpperCase())
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-extrabold text-[#25364B]">
              {name}
            </h2>
            <p className="mt-1 break-all text-sm text-slate-600">{email}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              {role === "ADMIN" ? "Administrador" : "Cajero"}
            </p>
          </div>
        </div>

        <form className="mt-7 border-t border-slate-100 pt-6" onSubmit={(event) => void saveAvatar(event)}>
          <label
            className="block text-sm font-bold text-[#26374D]"
            htmlFor="profile-avatar"
          >
            Foto de perfil
          </label>
          <p className="mt-1 text-sm text-slate-500">
            PNG, JPEG o WebP; máximo 5 MB.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={imageInput}
              accept="image/png,image/jpeg,image/webp"
              className="block w-full max-w-sm text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:font-semibold file:text-[#26374D] hover:file:bg-slate-200"
              id="profile-avatar"
              onChange={(event) => {
                setSelectedImage(event.target.files?.[0] ?? null);
                setError("");
              }}
              type="file"
            />
            <button
              className="min-h-10 rounded-lg bg-[#D94B3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#B93A31] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedImage || isSavingAvatar || isRemovingAvatar}
              type="submit"
            >
              {isSavingAvatar ? "Guardando..." : "Guardar foto"}
            </button>
            {avatar && (
              <button
                className="min-h-10 rounded-lg border border-[#D8E1EC] px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                disabled={isRemovingAvatar || isSavingAvatar}
                onClick={() => void removeAvatar()}
                type="button"
              >
                {isRemovingAvatar ? "Quitando..." : "Quitar foto"}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-extrabold text-[#25364B]">
          Cambiar contraseña
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Por seguridad, confirma tu contraseña actual. La nueva debe tener al
          menos 14 caracteres.
        </p>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => void changePassword(event)}
        >
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
            Contraseña actual
            <input
              autoComplete="current-password"
              className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal"
              maxLength={200}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Nueva contraseña
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal"
              maxLength={200}
              minLength={14}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type="password"
              value={newPassword}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Confirmar contraseña nueva
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-lg border border-slate-300 px-3 font-normal"
              maxLength={200}
              minLength={14}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              className="min-h-11 rounded-lg bg-[#D94B3D] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#B93A31] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                isChangingPassword ||
                !currentPassword ||
                newPassword.length < 14 ||
                !confirmPassword
              }
              type="submit"
            >
              {isChangingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
