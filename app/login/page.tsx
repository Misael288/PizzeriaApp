"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result: unknown = await response.json();

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

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo contactar al servidor. Intenta nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-700">
            Pizzería
          </p>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">
            Acceso al sistema
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Ingresa con tu cuenta de administración o caja.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-stone-700">
            Correo
            <input
              autoComplete="username"
              className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-100"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
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
              maxLength={1024}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}

          <button
            className="w-full rounded-lg bg-red-700 px-4 py-3 font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Validando..." : "Iniciar sesión"}
          </button>
        </form>
      </section>
    </main>
  );
}
