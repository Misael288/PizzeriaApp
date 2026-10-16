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
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
              Administración
            </p>
            <h1 className="mt-1 text-3xl font-bold">Inventario y recetas</h1>
            <p className="mt-2 text-stone-600">
              Las cantidades de la receta usan la unidad configurada para cada
              ingrediente.
            </p>
          </div>
          <a
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold"
            href="/dashboard"
          >
            Volver al panel
          </a>
        </header>

        {(error || notice) && (
          <p
            aria-live="polite"
            className={`mt-5 rounded-xl p-4 ${
              error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"
            }`}
            role={error ? "alert" : "status"}
          >
            {error || notice}
          </p>
        )}

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Existencias</h2>
          <p className="mt-1 text-sm text-stone-600">
            Los reabastecimientos y ajustes se agregan al historial de
            movimientos.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-2">Ingrediente</th>
                  <th>Unidad</th>
                  <th>Stock actual</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.ingredients.map((ingredient) => (
                  <tr
                    className="border-b border-stone-100"
                    key={ingredient.id_ingrediente}
                  >
                    <td className="py-3 font-semibold">{ingredient.nombre}</td>
                    <td>{ingredient.unidad_medida}</td>
                    <td>
                      <input
                        aria-label={`Existencia de ${ingredient.nombre}`}
                        className="w-28 rounded border border-stone-300 px-2 py-1"
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
                    <td>
                      {ingredient.stock_minimo} {ingredient.unidad_medida}
                    </td>
                    <td>
                      {ingredient.lowStock ? (
                        <span className="font-semibold text-amber-800">
                          Bajo
                        </span>
                      ) : (
                        <span className="text-emerald-800">Suficiente</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-50"
                        onClick={() => void saveStock(ingredient)}
                        type="button"
                      >
                        Guardar ajuste
                      </button>
                    </td>
                  </tr>
                ))}
                {data.ingredients.length === 0 && (
                  <tr>
                    <td className="py-4 text-stone-500" colSpan={6}>
                      Aún no hay ingredientes. Registra materias primas para
                      configurar recetas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Disponibilidad de productos</h2>
          {data.availability.some((product) => !product.available) && (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Hay productos no vendibles. Antes de operar, revisa que estén
              habilitados y tengan receta configurada y stock suficiente.
            </p>
          )}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((product) => {
              const availability = data.availability.find(
                (entry) => entry.productId === product.id_producto,
              );
              return (
                <li
                  className="rounded-lg border border-stone-200 p-4"
                  key={product.id_producto}
                >
                  <p className="font-semibold">{product.nombre}</p>
                  <p
                    className={
                      availability?.available
                        ? "mt-1 text-sm font-semibold text-emerald-800"
                        : "mt-1 text-sm font-semibold text-amber-800"
                    }
                  >
                    {availability?.available ? "Vendible" : "No vendible"}
                  </p>
                  {!availability?.recipeConfigured && (
                    <p className="mt-1 text-sm text-stone-600">
                      Falta configurar receta para una o más presentaciones.
                    </p>
                  )}
                  {availability?.recipeConfigured &&
                    !availability.available && (
                      <p className="mt-1 text-sm text-stone-600">
                        Revisa habilitación, bloqueo de ingredientes y stock
                        mínimo.
                      </p>
                    )}
                  {availability?.sizes.some((size) => !size.available) && (
                    <p className="mt-1 text-sm text-stone-600">
                      Una o más presentaciones no tienen existencia suficiente.
                    </p>
                  )}
                </li>
              );
            })}
            {data.products.length === 0 && (
              <li className="text-sm text-stone-600">
                No hay productos de catálogo para evaluar.
              </li>
            )}
          </ul>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <form
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"
            onSubmit={saveIngredient}
          >
            <h2 className="text-xl font-bold">Agregar ingrediente</h2>
            <label className="block text-sm font-semibold">
              Nombre
              <input
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                maxLength={100}
                onChange={(event) =>
                  setIngredientForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                value={ingredientForm.name}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-semibold">
                Unidad
                <select
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
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
              <label className="text-sm font-semibold">
                Existencia inicial
                <input
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
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
              <label className="text-sm font-semibold">
                Stock mínimo
                <input
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
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
            <button
              className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              Registrar ingrediente
            </button>
          </form>

          <form
            className="space-y-4 rounded-2xl bg-white p-5 shadow-sm"
            onSubmit={saveRecipe}
          >
            <h2 className="text-xl font-bold">Configurar receta</h2>
            <label className="block text-sm font-semibold">
              Producto
              <select
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
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
              <label className="block text-sm font-semibold">
                Presentación
                <select
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
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
            <div className="space-y-2">
              {recipeLines.map((line, index) => (
                <div
                  className="grid grid-cols-[1fr_8rem_auto] gap-2"
                  key={index}
                >
                  <select
                    aria-label={`Ingrediente de receta ${index + 1}`}
                    className="min-w-0 rounded-lg border border-stone-300 bg-white px-2 py-2"
                    onChange={(event) =>
                      moveLine(index, "ingredientId", event.target.value)
                    }
                    required
                    value={line.ingredientId}
                  >
                    <option value="">Ingrediente...</option>
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
                    className="rounded-lg border border-stone-300 px-2 py-2"
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
                  <button
                    aria-label={`Quitar ingrediente ${index + 1}`}
                    className="rounded border border-stone-300 px-3"
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
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded border border-stone-300 px-3 py-2 font-semibold"
                onClick={() =>
                  setRecipeLines((current) => [
                    ...current,
                    { ingredientId: "", quantity: "" },
                  ])
                }
                type="button"
              >
                Agregar ingrediente a receta
              </button>
              <button
                className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white"
                disabled={
                  data.ingredients.length === 0 ||
                  (Boolean(product?.producto_tamanos.length) && !selectedSize)
                }
                type="submit"
              >
                Guardar receta
              </button>
            </div>
          </form>
        </div>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-bold">Productos agotados en menú público</h2>
            <p className="text-sm text-stone-600">
              Si se muestran, aparecerán con la etiqueta “Agotada” y no se
              podrán agregar al carrito.
            </p>
          </div>
          <button
            aria-pressed={data.showSoldOut}
            className="rounded-lg border border-stone-300 px-4 py-2 font-semibold"
            onClick={() => void toggleSoldOut()}
            type="button"
          >
            {data.showSoldOut ? "Se muestran agotados" : "Se ocultan agotados"}
          </button>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Movimientos de inventario</h2>
          <p className="mt-1 text-sm text-stone-600">
            Últimos 100 registros de entradas, ajustes y consumo por pedido.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th>Ingrediente</th>
                  <th>Movimiento</th>
                  <th>Cantidad</th>
                  <th>Stock resultante</th>
                  <th>Origen / usuario</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((movement) => (
                  <tr
                    className="border-b border-stone-100"
                    key={movement.id_movimiento}
                  >
                    <td className="py-3">
                      {new Date(movement.creado_en).toLocaleString("es-MX")}
                    </td>
                    <td className="font-semibold">
                      {movement.ingredientes.nombre}
                    </td>
                    <td>{movement.tipo.replaceAll("_", " ")}</td>
                    <td>
                      {movement.cantidad} {movement.ingredientes.unidad_medida}
                    </td>
                    <td>
                      {movement.stock_anterior} → {movement.stock_nuevo}
                    </td>
                    <td>
                      {movement.pedidos
                        ? `Pedido #${movement.pedidos.id_pedido}`
                        : movement.usuarios?.name ?? movement.motivo ?? "Sistema"}
                    </td>
                  </tr>
                ))}
                {data.movements.length === 0 && (
                  <tr>
                    <td className="py-4 text-stone-500" colSpan={6}>
                      Aún no hay movimientos registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
