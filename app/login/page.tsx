"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const isRegistering = mode === "register";
      const response = await fetch(
        isRegistering ? "/api/auth/register" : "/api/auth/login",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isRegistering ? { name, email, password } : { email, password },
          ),
        },
      );
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : "No fue posible iniciar sesión.";
        setError(message);
        return;
      }

      if (isRegistering) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "message" in result &&
          typeof result.message === "string"
            ? result.message
            : "Registro recibido. Espera la aprobación de un administrador.";
        setNotice(message);
        setName("");
        setPassword("");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo contactar al servidor. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen">
      {/* Columna izquierda - Imagen */}
      <section className="relative hidden md:block md:w-1/2">
        <img
          alt="Pizzería Planeta"
          className="h-full w-full object-cover"
          src="/images/login-pizza.png"
        />

        {/* Capa oscura opcional */}
        <div className="absolute inset-0 bg-transparent/40" />

        {/* Texto sobre la imagen */}
        <div className="absolute inset-0 flex flex-col justify-center px-12 text-white">
         
        </div>
      </section>

      {/* Columna derecha - Login */}
      <section className="flex w-full md:w-1/2 items-center justify-center bg-stone-100 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-700">
              Pizzería
            </p>

            <h1 className="mt-2 text-3xl font-bold text-stone-900">
              {mode === "login" ? "Iniciar sesión" : "Solicitar una cuenta"}
            </h1>

            <p className="mt-2 text-sm text-stone-600">
              {mode === "login"
                ? "Ingresa con tu cuenta de administración o caja."
                : "Un administrador debe aprobar tu cuenta y asignarte un rol antes de que puedas acceder."}
            </p>
          </div>

          <div className="mb-5 flex rounded-lg bg-stone-100 p-1">
            <button
              aria-pressed={mode === "login"}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                mode === "login" ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
              }`}
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
              }}
              type="button"
            >
              Iniciar sesión
            </button>
            <button
              aria-pressed={mode === "register"}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold ${
                mode === "register" ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
              }`}
              onClick={() => {
                setMode("register");
                setError("");
                setNotice("");
              }}
              type="button"
            >
              Crear cuenta
            </button>
          </div>

          <form
            className="space-y-5"
            onSubmit={handleSubmit}
          >
            {mode === "register" && (
              <label className="block text-sm font-medium text-stone-700">
                Nombre completo
                <input
                  autoComplete="name"
                  className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                  maxLength={150}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </label>
            )}
            <label className="block text-sm font-medium text-stone-700">
              Correo
              <input
                autoComplete="username"
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                maxLength={254}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block text-sm font-medium text-stone-700">
              Contraseña
              <input
                autoComplete="current-password"
                className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
                maxLength={mode === "register" ? 200 : 1024}
                minLength={mode === "register" ? 14 : undefined}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
                type="password"
                value={password}
              />
            </label>

            {error && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800"
                role="status"
              >
                {notice}
              </p>
            )}

            <button
              className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Validando..."
                : mode === "login"
                  ? "Iniciar sesión"
                  : "Enviar solicitud de cuenta"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
