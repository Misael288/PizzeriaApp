"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Ingredient = {
  id_ingrediente: number;
  nombre: string;
  unidad_medida: string;
  stock_actual: string;
  stock_minimo: string;
  lowStock: boolean;
};

type Product = {
  id_producto: number;
  nombre: string;
  producto_tamanos: {
    id_tamano: number;
    tamanos: { nombre: string };
  }[];
};

type RecipeLine = {
  id_producto: number;
  id_tamano: number | null;
  id_ingrediente: number;
  cantidad_requerida: string;
};

type InventoryMovement = {
  id_movimiento: number;
  tipo: string;
  cantidad: string;
  stock_anterior: string;
  stock_nuevo: string;
  motivo: string | null;
  creado_en: string;
  ingredientes: { nombre: string; unidad_medida: string };
  usuarios: { name: string } | null;
  pedidos: { id_pedido: number } | null;
};

type InventoryData = {
  ingredients: Ingredient[];
  products: Product[];
  recipes: RecipeLine[];
  movements: InventoryMovement[];
  availability: {
    productId: number;
    manuallyEnabled: boolean;
    available: boolean;
    recipeConfigured: boolean;
    sizes: { sizeId: number | null; available: boolean }[];
  }[];
  showSoldOut: boolean;
};

type IngredientForm = {
  name: string;
  unit: string;
  stock: string;
  minimumStock: string;
};

const EMPTY_INGREDIENT: IngredientForm = {
  name: "",
  unit: "g",
  stock: "0",
  minimumStock: "0",
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

export function InventoryManager() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ingredientForm, setIngredientForm] =
    useState<IngredientForm>(EMPTY_INGREDIENT);
  const [editingStock, setEditingStock] = useState<Record<number, string>>({});
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [recipeLines, setRecipeLines] = useState<
    { ingredientId: string; quantity: string }[]
  >([{ ingredientId: "", quantity: "" }]);
  const [isSaving, setIsSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo cargar inventario."),
        );
      }
      const result = (await response.json()) as InventoryData;
      setData(result);
      setEditingStock(
        Object.fromEntries(
          result.ingredients.map((ingredient) => [
            ingredient.id_ingrediente,
            ingredient.stock_actual,
          ]),
        ),
      );
      setError("");
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar inventario.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/inventory", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseMessage(response, "No se pudo cargar inventario."),
          );
        }
        return (await response.json()) as InventoryData;
      })
      .then((result) => {
        setData(result);
        setEditingStock(
          Object.fromEntries(
            result.ingredients.map((ingredient) => [
              ingredient.id_ingrediente,
              ingredient.stock_actual,
            ]),
          ),
        );
        setError("");
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar inventario.",
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const saveIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ingredientForm,
          stock: Number(ingredientForm.stock),
          minimumStock: Number(ingredientForm.minimumStock),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo guardar el ingrediente."),
        );
      }
      setIngredientForm(EMPTY_INGREDIENT);
      setNotice("Ingrediente creado y existencia inicial registrada.");
      await loadInventory();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el ingrediente.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveStock = async (ingredient: Ingredient) => {
    setError("");
    setNotice("");
    const stock = Number(editingStock[ingredient.id_ingrediente]);
    try {
      const response = await fetch(
        `/api/inventory/ingredients/${ingredient.id_ingrediente}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ingredient.nombre,
            unit: ingredient.unidad_medida,
            stock,
            minimumStock: Number(ingredient.stock_minimo),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo actualizar la existencia."),
        );
      }
      setNotice(`Existencia de ${ingredient.nombre} actualizada.`);
      await loadInventory();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo actualizar la existencia.",
      );
    }
  };

  const saveRecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/inventory/recipes/${selectedProduct}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sizeId: selectedSize ? Number(selectedSize) : null,
            ingredients: recipeLines.map((line) => ({
              ingredientId: Number(line.ingredientId),
              quantity: Number(line.quantity),
            })),
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo guardar la receta."),
        );
      }
      setNotice("Receta de la presentación guardada.");
      await loadInventory();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la receta.",
      );
    }
  };

  const toggleSoldOut = async () => {
    if (!data) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/inventory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showSoldOut: !data.showSoldOut }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo guardar la configuración."),
        );
      }
      setNotice("Visibilidad de productos agotados actualizada.");
      await loadInventory();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la configuración.",
      );
    }
  };

  const product = data?.products.find(
    (item) => String(item.id_producto) === selectedProduct,
  );
  const loadRecipeLines = (productId: string, sizeId: string) => {
    const matchingRecipe = data?.recipes.filter(
      (recipe) =>
        recipe.id_producto === Number(productId) &&
        recipe.id_tamano === (sizeId ? Number(sizeId) : null),
    );
    if (matchingRecipe && matchingRecipe.length > 0) {
      setRecipeLines(
        matchingRecipe.map((recipe) => ({
          ingredientId: String(recipe.id_ingrediente),
          quantity: recipe.cantidad_requerida,
        })),
      );
    } else if (productId) {
      setRecipeLines([{ ingredientId: "", quantity: "" }]);
    }
  };

  if (isLoading) {
    return <p className="p-8 text-stone-600">Cargando inventario...</p>;
  }
  if (!data) {
    return (
      <p className="p-8 text-red-800" role="alert">
        {error || "No fue posible cargar el inventario."}
      </p>
    );
  }

  const moveLine = (
    index: number,
    field: "ingredientId" | "quantity",
    value: string,
  ) => {
    setRecipeLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  };

  return (
  <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl space-y-8">

      <header className="overflow-hidden rounded-3xl bg-[#071C3B] shadow-xl">
        <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 lg:flex-row lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-red-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-red-400">
              Administración
            </span>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Inventario y recetas
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Controla las existencias, administra las materias primas y
              configura las recetas de Pizzería Planeta.
            </p>
          </div>

          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F52727] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400/30"
          >
            <span aria-hidden="true">←</span>
            Volver al panel
          </a>
        </div>

        <div className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <p className="text-sm text-slate-400">Ingredientes registrados</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {data.ingredients.length}
            </p>
          </div>

          <div className="p-5">
            <p className="text-sm text-slate-400">Productos evaluados</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {data.products.length}
            </p>
          </div>

          <div className="p-5">
            <p className="text-sm text-slate-400">Alertas de inventario</p>
            <p className="mt-2 text-2xl font-bold text-red-400">
              {data.ingredients.filter((ingredient) => ingredient.lowStock).length}
            </p>
          </div>
        </div>
      </header>

      {/* MENSAJES */}

      {(error || notice) && (
        <div
          aria-live="polite"
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm shadow-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
          role={error ? "alert" : "status"}
        >
          <span className="text-lg font-bold">
            {error ? "!" : "✓"}
          </span>
          <p className="pt-0.5">{error || notice}</p>
        </div>
      )}

      {/* EXISTENCIAS */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Control de materias primas
            </span>
            <h2 className="mt-2 text-xl font-bold text-[#071C3B]">
              Existencias de inventario
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Actualiza el stock y revisa los niveles mínimos de cada ingrediente.
            </p>
          </div>

          <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {data.ingredients.length} ingredientes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold">Ingrediente</th>
                <th className="px-4 py-4 font-bold">Unidad</th>
                <th className="px-4 py-4 font-bold">Stock actual</th>
                <th className="px-4 py-4 font-bold">Stock mínimo</th>
                <th className="px-4 py-4 font-bold">Estado</th>
                <th className="px-6 py-4 text-right font-bold">Acción</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data.ingredients.map((ingredient) => (
                <tr
                  key={ingredient.id_ingrediente}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
                        ◈
                      </div>
                      <span className="font-semibold text-[#071C3B]">
                        {ingredient.nombre}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                      {ingredient.unidad_medida}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <input
                      aria-label={`Existencia de ${ingredient.nombre}`}
                      className="w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-[#071C3B] outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                      min={0}
                      onChange={(event) =>
                        setEditingStock((current) => ({
                          ...current,
                          [ingredient.id_ingrediente]: event.target.value,
                        }))
                      }
                      step="0.001"
                      type="number"
                      value={editingStock[ingredient.id_ingrediente] ?? ""}
                    />
                  </td>

                  <td className="px-4 py-4 font-medium text-slate-600">
                    {ingredient.stock_minimo} {ingredient.unidad_medida}
                  </td>

                  <td className="px-4 py-4">
                    {ingredient.lowStock ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Stock bajo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Suficiente
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                      onClick={() => void saveStock(ingredient)}
                      type="button"
                    >
                      EDITAR
                    </button>
                  </td>
                </tr>
              ))}

              {data.ingredients.length === 0 && (
                <tr>
                  <td className="px-6 py-12 text-center" colSpan={6}>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                      ◈
                    </div>
                    <p className="mt-4 font-semibold text-slate-700">
                      No hay ingredientes registrados
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Registra materias primas para comenzar a configurar las recetas.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-500">
            Los reabastecimientos y ajustes se agregan al historial de movimientos.
          </p>
        </div>
      </section>

      {/* DISPONIBILIDAD DE PRODUCTOS */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
            Validación de recetas
          </span>
          <h2 className="mt-2 text-xl font-bold text-[#071C3B]">
            Disponibilidad de productos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Consulta qué productos pueden venderse según sus recetas y existencias.
          </p>
        </div>

        {data.availability.some((product) => !product.available) && (
          <div className="mx-6 mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <span className="text-lg">!</span>
            <p>
              Hay productos no vendibles. Revisa que estén habilitados, tengan
              receta configurada y cuenten con stock suficiente.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.products.map((product) => {
            const availability = data.availability.find(
              (entry) => entry.productId === product.id_producto,
            );

            return (
              <article
                key={product.id_producto}
                className="rounded-2xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                    ◈
                  </div>

                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      availability?.available
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {availability?.available ? "Vendible" : "No vendible"}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-bold text-[#071C3B]">
                  {product.nombre}
                </h3>

                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-500">
                      Receta
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        availability?.recipeConfigured
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {availability?.recipeConfigured
                        ? "Configurada"
                        : "Pendiente"}
                    </span>
                  </div>

                  {product.producto_tamanos.length > 0 && (
                    <div className="space-y-2">
                      {availability?.sizes.map((size, index) => (
                        <div
                          key={`${product.id_producto}-${index}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <span className="text-xs text-slate-600">
                            {product.producto_tamanos.find(
                              (entry) => entry.id_tamano === size.sizeId,
                            )?.tamanos.nombre ?? "Presentación"}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              size.available
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {size.available ? "Disponible" : "Stock insuficiente"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!availability?.recipeConfigured && (
                    <p className="rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">
                      Falta configurar la receta para una o más presentaciones.
                    </p>
                  )}

                  {availability?.recipeConfigured && !availability.available && (
                    <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                      Revisa la habilitación del producto, los ingredientes bloqueados
                      y el stock mínimo.
                    </p>
                  )}

                  {availability?.sizes.some((size) => !size.available) && (
                    <p className="text-xs leading-5 text-slate-500">
                      Una o más presentaciones no tienen existencia suficiente.
                    </p>
                  )}
                </div>
              </article>
            );
          })}

          {data.products.length === 0 && (
            <div className="rounded-xl bg-slate-50 p-8 text-center sm:col-span-2 xl:col-span-3">
              <p className="font-semibold text-slate-700">
                No hay productos para evaluar
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Los productos del catálogo aparecerán en esta sección.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* FORMULARIOS */}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">

        {/* AGREGAR INGREDIENTE */}

        <form
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          onSubmit={saveIngredient}
        >
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-xl text-[#F52727]">
                +
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#071C3B]">
                  Agregar ingrediente
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Registra una nueva materia prima.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <label className="block text-sm font-semibold text-slate-700">
              Nombre del ingrediente
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                maxLength={100}
                onChange={(event) =>
                  setIngredientForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                value={ingredientForm.name}
                placeholder="Ej. Queso mozzarella"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-slate-700">
                Unidad de medida
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  onChange={(event) =>
                    setIngredientForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                  value={ingredientForm.unit}
                >
                  {["g", "kg", "ml", "l", "pieza"].map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Existencia inicial
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  min={0}
                  onChange={(event) =>
                    setIngredientForm((current) => ({
                      ...current,
                      stock: event.target.value,
                    }))
                  }
                  required
                  step="0.001"
                  type="number"
                  value={ingredientForm.stock}
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Stock mínimo
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  min={0}
                  onChange={(event) =>
                    setIngredientForm((current) => ({
                      ...current,
                      minimumStock: event.target.value,
                    }))
                  }
                  required
                  step="0.001"
                  type="number"
                  value={ingredientForm.minimumStock}
                />
              </label>
            </div>

            <div className="rounded-xl bg-blue-50 p-4 text-sm leading-5 text-blue-800">
              Define la cantidad inicial y el nivel mínimo para detectar faltantes
              de inventario.
            </div>

            <button
              className="w-full rounded-xl bg-[#F52727] px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              disabled={isSaving}
              type="submit"
            >
              Registrar ingrediente
            </button>
          </div>
        </form>

        {/* CONFIGURAR RECETA */}

        <form
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          onSubmit={saveRecipe}
        >
          <div className="border-b border-slate-100 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                ≡
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#071C3B]">
                  Configurar receta
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Asigna ingredientes y cantidades por presentación.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <label className="block text-sm font-semibold text-slate-700">
              Producto
              <select
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                onChange={(event) => {
                  const productId = event.target.value;
                  setSelectedProduct(productId);
                  setSelectedSize("");
                  loadRecipeLines(productId, "");
                }}
                required
                value={selectedProduct}
              >
                <option value="">Selecciona un producto...</option>
                {data.products.map((item) => (
                  <option key={item.id_producto} value={item.id_producto}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>

            {product && product.producto_tamanos.length > 0 && (
              <label className="block text-sm font-semibold text-slate-700">
                Presentación
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  onChange={(event) => {
                    const sizeId = event.target.value;
                    setSelectedSize(sizeId);
                    loadRecipeLines(selectedProduct, sizeId);
                  }}
                  required
                  value={selectedSize}
                >
                  <option value="">Selecciona una presentación...</option>
                  {product.producto_tamanos.map((size) => (
                    <option key={size.id_tamano} value={size.id_tamano}>
                      {size.tamanos.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">
                  Ingredientes de la receta
                </h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {recipeLines.length} ingredientes
                </span>
              </div>

              <div className="space-y-3">
                {recipeLines.map((line, index) => (
                  <div
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    key={index}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Ingrediente {index + 1}
                      </span>

                      <button
                        aria-label={`Quitar ingrediente ${index + 1}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-red-600 transition hover:bg-red-100"
                        onClick={() =>
                          setRecipeLines((current) =>
                            current.filter((_, lineIndex) => lineIndex !== index),
                          )
                        }
                        type="button"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                      <select
                        aria-label={`Ingrediente de receta ${index + 1}`}
                        className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        onChange={(event) =>
                          moveLine(index, "ingredientId", event.target.value)
                        }
                        required
                        value={line.ingredientId}
                      >
                        <option value="">Selecciona ingrediente...</option>
                        {data.ingredients.map((ingredient) => (
                          <option
                            key={ingredient.id_ingrediente}
                            value={ingredient.id_ingrediente}
                          >
                            {ingredient.nombre} ({ingredient.unidad_medida})
                          </option>
                        ))}
                      </select>

                      <input
                        aria-label={`Cantidad de receta ${index + 1}`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        min="0.001"
                        onChange={(event) =>
                          moveLine(index, "quantity", event.target.value)
                        }
                        placeholder="Cantidad"
                        required
                        step="0.001"
                        type="number"
                        value={line.quantity}
                      />
                    </div>
                  </div>
                ))}

                {recipeLines.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                    <p className="text-sm font-semibold text-slate-600">
                      No hay ingredientes en la receta.
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Agrega al menos un ingrediente para comenzar.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <button
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
              onClick={() =>
                setRecipeLines((current) => [
                  ...current,
                  { ingredientId: "", quantity: "" },
                ])
              }
              type="button"
            >
              + Agregar ingrediente a receta
            </button>

            <div className="border-t border-slate-100 pt-4">
              <button
                className="w-full rounded-xl bg-[#F52727] px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  data.ingredients.length === 0 ||
                  (Boolean(product?.producto_tamanos.length) && !selectedSize)
                }
                type="submit"
              >
                Guardar receta
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* PRODUCTOS AGOTADOS */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-600">
              !
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#071C3B]">
                Productos agotados en menú público
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Configura si los productos agotados se mostrarán en el menú.
                Cuando se muestran, aparecerán con la etiqueta “Agotada” y no
                se podrán agregar al carrito.
              </p>
            </div>
          </div>

          <button
            aria-pressed={data.showSoldOut}
            className={`shrink-0 rounded-xl px-5 py-3 text-sm font-bold transition focus:outline-none focus:ring-4 ${
              data.showSoldOut
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 focus:ring-emerald-500/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500/20"
            }`}
            onClick={() => void toggleSoldOut()}
            type="button"
          >
            {data.showSoldOut
              ? "✓ Se muestran agotados"
              : "Se ocultan agotados"}
          </button>
        </div>
      </section>

      {/* HISTORIAL DE MOVIMIENTOS */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Registro de actividad
            </span>
            <h2 className="mt-2 text-xl font-bold text-[#071C3B]">
              Movimientos de inventario
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Historial de entradas, ajustes y consumo por pedido.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
            Últimos 100 registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Ingrediente</th>
                <th className="px-5 py-4 font-bold">Movimiento</th>
                <th className="px-5 py-4 font-bold">Cantidad</th>
                <th className="px-5 py-4 font-bold">Stock resultante</th>
                <th className="px-5 py-4 font-bold">Origen / usuario</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {data.movements.map((movement) => (
                <tr
                  className="transition hover:bg-slate-50"
                  key={movement.id_movimiento}
                >
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                    {new Date(movement.creado_en).toLocaleString("es-MX")}
                  </td>

                  <td className="px-5 py-4 font-semibold text-[#071C3B]">
                    {movement.ingredientes.nombre}
                  </td>

                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                      {movement.tipo.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-700">
                    {movement.cantidad} {movement.ingredientes.unidad_medida}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="font-medium text-slate-500">
                      {movement.stock_anterior}
                    </span>
                    <span className="mx-2 text-slate-300">→</span>
                    <span className="font-bold text-[#071C3B]">
                      {movement.stock_nuevo}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {movement.pedidos
                      ? `Pedido #${movement.pedidos.id_pedido}`
                      : movement.usuarios?.name ?? movement.motivo ?? "Sistema"}
                  </td>
                </tr>
              ))}

              {data.movements.length === 0 && (
                <tr>
                  <td className="px-6 py-12 text-center" colSpan={6}>
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                      ≡
                    </div>
                    <p className="mt-4 font-semibold text-slate-700">
                      Aún no hay movimientos registrados
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Los movimientos aparecerán aquí cuando se registren entradas,
                      ajustes o consumos.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-500">
            Pizzería Planeta · Historial de movimientos de inventario
          </p>
        </div>
      </section>

    </div>
  </main>
);
}
