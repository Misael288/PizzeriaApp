"use client";

import { FormEvent, useEffect, useState } from "react";

type StaffRole = "ADMIN" | "CASHIER" | "PENDING";

type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
};

type ApiMessage = { message?: string };

const parseError = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as ApiMessage;
  return body.message ?? "No fue posible completar la operación.";
};

export function StaffUserManager() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("CASHIER");
  const [creating, setCreating] = useState(false);
  const [passwordResets, setPasswordResets] = useState<Record<number, string>>(
    {},
  );

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (!response.ok) throw new Error(await parseError(response));
      const data = (await response.json()) as { users: StaffUser[] };
      setUsers(data.users);
      setError("");
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar los usuarios.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseError(response));
        return (await response.json()) as { users: StaffUser[] };
      })
      .then((data) => {
        setUsers(data.users);
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar los usuarios.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      setName("");
      setEmail("");
      setPassword("");
      setNotice("Usuario creado correctamente.");
      await loadUsers();
    } catch (createError: unknown) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No fue posible crear el usuario.",
      );
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (
    user: StaffUser,
    update: { role?: StaffRole; isActive?: boolean; password?: string },
  ) => {
    setBusyUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error(await parseError(response));
      setNotice(
        update.password
          ? "Contraseña restablecida. El usuario deberá iniciar sesión nuevamente."
          : "Usuario actualizado. Si se modificó su acceso, deberá iniciar sesión nuevamente.",
      );
      if (update.password) {
        setPasswordResets((current) => ({ ...current, [user.id]: "" }));
      }
      await loadUsers();
    } catch (updateError: unknown) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No fue posible actualizar el usuario.",
      );
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      <form
        className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:grid-cols-2"
        onSubmit={(event) => void createUser(event)}
      >
        <h2 className="text-xl font-bold text-stone-900 md:col-span-2">
          Crear cuenta del personal
        </h2>
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Nombre
          <input
            autoComplete="name"
            className="rounded-lg border border-stone-300 px-3 py-2"
            maxLength={150}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Correo electrónico
          <input
            autoComplete="email"
            className="rounded-lg border border-stone-300 px-3 py-2"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Contraseña inicial (mínimo 14 caracteres)
          <input
            autoComplete="new-password"
            className="rounded-lg border border-stone-300 px-3 py-2"
            minLength={14}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-stone-700">
          Rol
          <select
            className="rounded-lg border border-stone-300 bg-white px-3 py-2"
            onChange={(event) => setRole(event.target.value as StaffRole)}
            value={role}
          >
            <option value="CASHIER">Cajero</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        <button
          className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60 md:col-span-2 md:justify-self-start"
          disabled={creating}
          type="submit"
        >
          {creating ? "Creando..." : "Crear usuario"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-red-800" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-green-50 p-4 text-green-800" role="status">
          {notice}
        </p>
      )}

      <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="bg-stone-50 text-sm text-stone-600">
            <tr>
              <th className="px-5 py-3">Personal</th>
              <th className="px-5 py-3">Rol</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Acciones</th>
              <th className="px-5 py-3">Restablecer contraseña</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td className="px-5 py-6 text-stone-600" colSpan={5}>
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td className="px-5 py-6 text-stone-600" colSpan={5}>
                  No hay cuentas registradas.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-stone-900">{user.name}</p>
                    <p className="text-sm text-stone-600">{user.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      aria-label={`Rol de ${user.name}`}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2"
                      disabled={busyUserId === user.id}
                      onChange={(event) =>
                        void updateUser(
                          user,
                          user.role === "PENDING"
                            ? {
                                role: event.target.value as Exclude<
                                  StaffRole,
                                  "PENDING"
                                >,
                                isActive: true,
                              }
                            : {
                                role: event.target.value as Exclude<
                                  StaffRole,
                                  "PENDING"
                                >,
                              },
                        )
                      }
                      value={user.role}
                    >
                      {user.role === "PENDING" && (
                        <option disabled value="PENDING">
                          Pendiente de aprobación
                        </option>
                      )}
                      <option value="ADMIN">Administrador</option>
                      <option value="CASHIER">Cajero</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        user.isActive
                          ? "font-semibold text-green-700"
                          : "font-semibold text-stone-500"
                      }
                    >
                      {user.role === "PENDING"
                        ? "Requiere aprobación"
                        : user.isActive
                          ? "Activo"
                          : "Desactivado"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      disabled={
                        busyUserId === user.id || user.role === "PENDING"
                      }
                      onClick={() =>
                        void updateUser(user, { isActive: !user.isActive })
                      }
                      type="button"
                    >
                      {user.isActive ? "Desactivar" : "Reactivar"}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <input
                        aria-label={`Nueva contraseña para ${user.name}`}
                        autoComplete="new-password"
                        className="w-48 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                        minLength={14}
                        onChange={(event) =>
                          setPasswordResets((current) => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                        placeholder="Mínimo 14 caracteres"
                        type="password"
                        value={passwordResets[user.id] ?? ""}
                      />
                      <button
                        className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        disabled={
                          busyUserId === user.id ||
                          (passwordResets[user.id] ?? "").length < 14
                        }
                        onClick={() =>
                          void updateUser(user, {
                            password: passwordResets[user.id],
                          })
                        }
                        type="button"
                      >
                        Cambiar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-stone-600">
        Los cambios de rol, desactivaciones y contraseñas revocan las sesiones
        activas de ese usuario. Las solicitudes nuevas no acceden al panel
        hasta que un administrador les asigne rol. No se permite desactivar al
        último administrador.
      </p>
    </div>
  );
}
