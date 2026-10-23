"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

type UserRole = "ADMIN" | "CASHIER";

type Category = {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  _count?: { productos: number };
};

type Size = {
  id_tamano: number;
  nombre: string;
};

type ProductSize = {
  id_producto_tamano: number;
  precio: string | number;
  tamanos: Size;
};

type Product = {
  id_producto: number;
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  precio: string | number;
  imagen: string | null;
  disponible: boolean;
  categorias: Category;
  producto_tamanos: ProductSize[];
};

type ProductSizeForm = {
  sizeId: number;
  price: string;
};

type CatalogManagerProps = {
  role: UserRole;
};

type CatalogData = {
  categories: Category[];
  products: Product[];
  sizes: Size[];
};

const readMessage = async (
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

const currency = (value: string | number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value));

const requestCatalogData = async (isAdmin: boolean): Promise<CatalogData> => {
  const [categoryResponse, productResponse] = await Promise.all([
    fetch("/api/catalog/categories", { cache: "no-store" }),
    fetch("/api/catalog/products", { cache: "no-store" }),
  ]);

  if (!categoryResponse.ok) {
    throw new Error(
      await readMessage(
        categoryResponse,
        "No se pudieron cargar las categorías.",
      ),
    );
  }
  if (!productResponse.ok) {
    throw new Error(
      await readMessage(productResponse, "No se pudieron cargar los productos."),
    );
  }

  const categoryBody = (await categoryResponse.json()) as {
    categories: Category[];
  };
  const productBody = (await productResponse.json()) as {
    products: Product[];
  };
  let sizes: Size[] = [];

  if (isAdmin) {
    const sizeResponse = await fetch("/api/catalog/sizes", {
      cache: "no-store",
    });
    if (!sizeResponse.ok) {
      throw new Error(
        await readMessage(sizeResponse, "No se pudieron cargar los tamaños."),
      );
    }

    const sizeBody = (await sizeResponse.json()) as { sizes: Size[] };
    sizes = sizeBody.sizes;
  }

  return {
    categories: categoryBody.categories,
    products: productBody.products,
    sizes,
  };
};

export function CatalogManager({ role }: CatalogManagerProps) {
  const isAdmin = role === "ADMIN";
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "categories">(
    "products",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [editingCategoryActive, setEditingCategoryActive] = useState(true);
  const [sizeName, setSizeName] = useState("");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImage, setProductImage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [productCategoryId, setProductCategoryId] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [available, setAvailable] = useState(true);
  const [productSizes, setProductSizes] = useState<ProductSizeForm[]>([]);
  const [sizeSelection, setSizeSelection] = useState("");
  const [sizePrice, setSizePrice] = useState("");
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await requestCatalogData(isAdmin);
      setCategories(data.categories);
      setProducts(data.products);
      setSizes(data.sizes);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el catálogo.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    let isCurrent = true;

    const loadInitialCatalog = async () => {
      try {
        const data = await requestCatalogData(isAdmin);

        if (isCurrent) {
          setCategories(data.categories);
          setProducts(data.products);
          setSizes(data.sizes);
          setError("");
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el catálogo.",
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialCatalog();
    return () => {
      isCurrent = false;
    };
  }, [isAdmin]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-MX");

    if (!query) return products;

    return products.filter(
      (product) =>
        product.nombre.toLocaleLowerCase("es-MX").includes(query) ||
        product.categorias.nombre.toLocaleLowerCase("es-MX").includes(query),
    );
  }, [products, search]);

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setEditingCategoryActive(true);
    setCategoryName("");
    setCategoryDescription("");
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductName("");
    setProductDescription("");
    setProductImage("");
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setProductCategoryId("");
    setBasePrice("");
    setAvailable(true);
    setProductSizes([]);
    setSizeSelection("");
    setSizePrice("");
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);

    try {
      const response = await fetch(
        editingCategoryId
          ? `/api/catalog/categories/${editingCategoryId}`
          : "/api/catalog/categories",
        {
          method: editingCategoryId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: categoryName,
            description: categoryDescription || null,
            active: editingCategoryActive,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readMessage(response, "No se pudo guardar la categoría."),
        );
      }

      setNotice(editingCategoryId ? "Categoría actualizada." : "Categoría creada.");
      resetCategoryForm();
      await loadCatalog();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la categoría.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCategory = async (category: Category) => {
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/catalog/categories/${category.id_categoria}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: category.nombre,
            description: category.descripcion,
            active: !category.activo,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readMessage(response, "No se pudo cambiar el estado."),
        );
      }

      setNotice(
        category.activo ? "Categoría desactivada." : "Categoría activada.",
      );
      await loadCatalog();
    } catch (toggleError: unknown) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo cambiar el estado.",
      );
    }
  };

  const addSizeOption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/catalog/sizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sizeName }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response, "No se pudo agregar el tamaño."));
      }

      setSizeName("");
      setNotice("Tamaño agregado al catálogo de presentaciones.");
      await loadCatalog();
    } catch (sizeError: unknown) {
      setError(
        sizeError instanceof Error
          ? sizeError.message
          : "No se pudo agregar el tamaño.",
      );
    }
  };

  const appendProductSize = () => {
    const sizeId = Number(sizeSelection);
    const price = Number(sizePrice);

    if (!Number.isInteger(sizeId) || sizeId <= 0 || sizePrice.trim() === "") {
      setError("Selecciona un tamaño e indica su precio.");
      return;
    }

    if (productSizes.some((entry) => entry.sizeId === sizeId)) {
      setError("Ese tamaño ya está agregado al producto.");
      return;
    }

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99_999_999.99 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.0000001
    ) {
      setError("El precio debe ser positivo y tener hasta dos decimales.");
      return;
    }

    setProductSizes((current) => [...current, { sizeId, price: price.toFixed(2) }]);
    setSizeSelection("");
    setSizePrice("");
    setError("");
  };

  const editProduct = (product: Product) => {
    setEditingProductId(product.id_producto);
    setProductName(product.nombre);
    setProductDescription(product.descripcion ?? "");
    setProductImage(product.imagen ?? "");
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setProductCategoryId(String(product.id_categoria));
    setBasePrice(String(product.precio));
    setAvailable(product.disponible);
    setProductSizes(
      product.producto_tamanos.map((entry) => ({
        sizeId: entry.tamanos.id_tamano,
        price: String(entry.precio),
      })),
    );
    setActiveTab("products");
    setError("");
    setNotice("");
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSaving(true);

    const effectiveBasePrice = productSizes.length
      ? Math.min(...productSizes.map((entry) => Number(entry.price)))
      : Number(basePrice);

    try {
      let image = productImage || null;

      if (selectedImage) {
        const imageFormData = new FormData();
        imageFormData.append("image", selectedImage);

        const imageResponse = await fetch("/api/catalog/images", {
          method: "POST",
          body: imageFormData,
        });

        if (!imageResponse.ok) {
          throw new Error(
            await readMessage(imageResponse, "No se pudo importar la imagen."),
          );
        }

        const imageResult: unknown = await imageResponse.json();
        if (
          typeof imageResult !== "object" ||
          imageResult === null ||
          !("image" in imageResult) ||
          typeof imageResult.image !== "string"
        ) {
          throw new Error("El servidor devolvió una respuesta de imagen inválida.");
        }

        image = imageResult.image;
      }

      const response = await fetch(
        editingProductId
          ? `/api/catalog/products/${editingProductId}`
          : "/api/catalog/products",
        {
          method: editingProductId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: Number(productCategoryId),
            name: productName,
            description: productDescription || null,
            image,
            available,
            basePrice: effectiveBasePrice,
            sizes: productSizes.map((entry) => ({
              sizeId: entry.sizeId,
              price: Number(entry.price),
            })),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readMessage(response, "No se pudo guardar el producto."));
      }

      setNotice(editingProductId ? "Producto actualizado." : "Producto creado.");
      resetProductForm();
      await loadCatalog();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el producto.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleProduct = async (product: Product) => {
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/catalog/products/${product.id_producto}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ available: !product.disponible }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await readMessage(response, "No se pudo cambiar la disponibilidad."),
        );
      }

      setNotice(
        product.disponible ? "Producto marcado como no disponible." : "Producto disponible.",
      );
      await loadCatalog();
    } catch (toggleError: unknown) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo cambiar la disponibilidad.",
      );
    }
  };

  const selectedSizeIds = new Set(productSizes.map((entry) => entry.sizeId));

  return (
     
  <main className="min-h-screen bg-slate-100">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* HEADER */}

      <header className="mb-8 overflow-hidden rounded-3xl bg-[#071C3B] shadow-xl">
        <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-blue-500/20 px-4 py-1.5 text-xs font-semibold tracking-widest text-blue-300">
              ADMINISTRACIÓN DEL CATÁLOGO
            </span>

            <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-[#F52727]">
              Pizzería Planeta
            </p>

            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Categorías y Productos
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              {isAdmin
                ? "Administra categorías, productos, precios y presentaciones."
                : "Consulta los productos disponibles para registrar pedidos."}
            </p>
          </div>

          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F52727] px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400/30"
          >
            <span aria-hidden="true">←</span>
            Volver al panel
          </a>
        </div>
      </header>

      {/* ALERTAS */}

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm"
        >
          <span className="font-bold">!</span>
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 shadow-sm"
        >
          <span className="font-bold">✓</span>
          <p>{notice}</p>
        </div>
      )}

      {/* RESUMEN */}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl text-blue-600">
              ◈
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Catálogo
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-slate-500">
            Productos registrados
          </p>

          <p className="mt-1 text-3xl font-bold text-[#071C3B]">
            {products.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Productos en el sistema
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-2xl text-[#F52727]">
              ▤
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Organización
            </span>
          </div>

          <p className="mt-4 text-sm font-medium text-slate-500">
            Categorías registradas
          </p>

          <p className="mt-1 text-3xl font-bold text-[#071C3B]">
            {categories.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Categorías del menú digital
          </p>
        </div>
      </div>

      {/* PESTAÑAS */}

      <div className="mb-8 inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
            activeTab === "products"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100 hover:text-[#071C3B]"
          }`}
        >
          Productos ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
            activeTab === "categories"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 hover:bg-slate-100 hover:text-[#071C3B]"
          }`}
        >
          Categorías ({categories.length})
        </button>
      </div>

      {/* CATEGORÍAS */}

      {activeTab === "categories" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">

          {isAdmin && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-1">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
                <h2 className="text-lg font-bold text-[#071C3B]">
                  {editingCategoryId ? "Editar categoría" : "Nueva categoría"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Organiza los productos del menú.
                </p>
              </div>

              <form onSubmit={saveCategory} className="space-y-5 p-6">
                <div>
                  <label
                    htmlFor="category-name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Nombre de la categoría
                  </label>
                  <input
                    id="category-name"
                    maxLength={100}
                    onChange={(event) => setCategoryName(event.target.value)}
                    required
                    value={categoryName}
                    placeholder="Ej. Pizzas"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="category-description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="category-description"
                    maxLength={255}
                    onChange={(event) =>
                      setCategoryDescription(event.target.value)
                    }
                    rows={4}
                    value={categoryDescription}
                    placeholder="Describe esta categoría..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                  <span className="text-sm font-medium text-slate-700">
                    Estado de la categoría
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingCategoryActive((value) => !value)}
                    aria-pressed={editingCategoryActive}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      editingCategoryActive
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {editingCategoryActive ? "Activa" : "Inactiva"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 rounded-xl bg-[#F52727] px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Guardando..." : "Guardar categoría"}
                  </button>

                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={resetCategoryForm}
                      className="rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          <section
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
              isAdmin ? "xl:col-span-2" : "xl:col-span-3"
            }`}
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <h2 className="text-xl font-bold text-[#071C3B]">
                Categorías del menú
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Consulta y administra las categorías registradas.
              </p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#F52727]" />
              </div>
            ) : categories.length === 0 ? (
              <div className="p-12 text-center">
                <p className="font-semibold text-slate-600">
                  No hay categorías registradas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                {categories.map((category) => (
                  <article
                    key={category.id_categoria}
                    className="rounded-2xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600">
                        ▤
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          category.activo
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {category.activo ? "Activa" : "Inactiva"}
                      </span>
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-[#071C3B]">
                      {category.nombre}
                    </h3>

                    <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">
                      {category.descripcion || "Sin descripción disponible."}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm text-slate-500">
                        Productos asociados
                      </span>
                      <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                        {category._count?.productos ?? 0}
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(category.id_categoria);
                            setEditingCategoryActive(category.activo);
                            setCategoryName(category.nombre);
                            setCategoryDescription(category.descripcion ?? "");
                          }}
                          className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleCategory(category)}
                          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          {category.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* PRODUCTOS */}

      {activeTab === "products" && (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">

          {/* FORMULARIO DE PRODUCTO */}

          {isAdmin && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-5">
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">
                  Gestión de productos
                </span>
                <h2 className="mt-2 text-xl font-bold text-[#071C3B]">
                  {editingProductId ? "Editar producto" : "Nuevo producto"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configura la información, los precios y las presentaciones.
                </p>
              </div>

              <form onSubmit={saveProduct} className="space-y-5 p-6">
                <div>
                  <label
                    htmlFor="product-name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Nombre del producto
                  </label>
                  <input
                    id="product-name"
                    maxLength={100}
                    onChange={(event) => setProductName(event.target.value)}
                    required
                    value={productName}
                    placeholder="Ej. Pizza Pepperoni"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-category"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Categoría
                  </label>
                  <select
                    id="product-category"
                    onChange={(event) =>
                      setProductCategoryId(event.target.value)
                    }
                    required
                    value={productCategoryId}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories
                      .filter(
                        (category) =>
                          category.activo ||
                          category.id_categoria === Number(productCategoryId),
                      )
                      .map((category) => (
                        <option
                          key={category.id_categoria}
                          value={category.id_categoria}
                        >
                          {category.nombre}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="product-description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Descripción
                  </label>
                  <textarea
                    id="product-description"
                    maxLength={255}
                    onChange={(event) =>
                      setProductDescription(event.target.value)
                    }
                    rows={3}
                    value={productDescription}
                    placeholder="Describe los ingredientes o características..."
                    className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-image"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Imagen del producto
                  </label>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    id="product-image"
                    ref={imageInputRef}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setSelectedImage(file);
                      setError("");

                      if (file && file.size > 5 * 1024 * 1024) {
                        setSelectedImage(null);
                        event.target.value = "";
                        setError("La imagen no puede superar 5 MB.");
                      }
                    }}
                    type="file"
                    className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 file:mr-4 file:border-0 file:bg-blue-50 file:px-4 file:py-3 file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    PNG, JPEG o WebP. Tamaño máximo de 5 MB.
                    {productImage && !selectedImage
                      ? " Se conservará la imagen actual."
                      : ""}
                  </p>

                  {selectedImage && (
                    <p className="mt-2 text-sm text-green-700">
                      Imagen seleccionada: {selectedImage.name}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Disponibilidad
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Estado inicial del producto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAvailable((value) => !value)}
                    aria-pressed={available}
                    className={`relative h-6 w-11 rounded-full transition ${
                      available ? "bg-green-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                        available ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {/* TAMAÑOS Y PRECIOS */}

                <fieldset className="rounded-2xl border border-slate-200 p-4">
                  <legend className="px-2 text-sm font-bold text-[#071C3B]">
                    Tamaños y precios
                  </legend>

                  {productSizes.length > 0 ? (
                    <div className="mb-4 space-y-2">
                      {productSizes.map((entry) => {
                        const size = sizes.find(
                          (candidate) =>
                            candidate.id_tamano === entry.sizeId,
                        );

                        return (
                          <div
                            key={entry.sizeId}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-[#071C3B]">
                                {size?.nombre ?? "Tamaño"}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {currency(entry.price)}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setProductSizes((current) =>
                                  current.filter(
                                    (item) => item.sizeId !== entry.sizeId,
                                  ),
                                )
                              }
                              className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              Quitar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mb-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                      Sin tamaños configurados. Se utilizará un precio único.
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="size-select"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Tamaño
                      </label>
                      <select
                        id="size-select"
                        onChange={(event) =>
                          setSizeSelection(event.target.value)
                        }
                        value={sizeSelection}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      >
                        <option value="">Selecciona</option>
                        {sizes
                          .filter(
                            (size) => !selectedSizeIds.has(size.id_tamano),
                          )
                          .map((size) => (
                            <option
                              key={size.id_tamano}
                              value={size.id_tamano}
                            >
                              {size.nombre}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="size-price"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Precio (MXN)
                      </label>
                      <input
                        id="size-price"
                        min="0"
                        onChange={(event) => setSizePrice(event.target.value)}
                        step="0.01"
                        type="number"
                        value={sizePrice}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={appendProductSize}
                    className="mt-4 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white"
                  >
                    + Agregar tamaño
                  </button>
                </fieldset>

                {productSizes.length === 0 && (
                  <div>
                    <label
                      htmlFor="base-price"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Precio único (MXN)
                    </label>
                    <input
                      id="base-price"
                      min="0"
                      onChange={(event) => setBasePrice(event.target.value)}
                      required
                      step="0.01"
                      type="number"
                      value={basePrice}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                  <button
                    type="submit"
                    disabled={
                      isSaving || categories.every((item) => !item.activo)
                    }
                    className="flex-1 rounded-xl bg-[#F52727] px-5 py-3 font-semibold text-white shadow-md transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving
                      ? "Guardando..."
                      : editingProductId
                        ? "Guardar cambios"
                        : "Crear producto"}
                  </button>

                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}

          {/* TAMAÑOS DEL CATÁLOGO */}

          {isAdmin && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-bold text-[#071C3B]">
                  Presentaciones
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Administra los tamaños disponibles para los productos.
                </p>
              </div>

              <div className="p-6">
                <form onSubmit={addSizeOption} className="flex flex-col gap-3 sm:flex-row">
                  <input
                    aria-label="Nombre del tamaño"
                    maxLength={50}
                    onChange={(event) => setSizeName(event.target.value)}
                    placeholder="Ej. Mediana, Grande, 600 ml"
                    required
                    value={sizeName}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    + Agregar
                  </button>
                </form>

                <div className="mt-6">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                    Tamaños registrados
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <span
                        key={size.id_tamano}
                        className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"
                      >
                        {size.nombre}
                      </span>
                    ))}

                    {sizes.length === 0 && (
                      <p className="text-sm text-slate-400">
                        No hay tamaños registrados.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* LISTADO DE PRODUCTOS */}

          <section
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
              isAdmin ? "xl:col-span-3" : "xl:col-span-5"
            }`}
          >
            <div className="border-b border-slate-100 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#071C3B]">
                    Catálogo administrativo
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Consulta precios, recetas y disponibilidad.
                  </p>
                </div>

                <div className="relative w-full lg:max-w-sm">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                    ⌕
                  </span>
                  <input
                    aria-label="Buscar producto o categoría"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar producto o categoría..."
                    value={search}
                  />
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16">
                <div
                  aria-label="Cargando"
                  className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#F52727]"
                  role="status"
                />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl text-slate-400">
                  ◈
                </div>
                <p className="mt-4 font-semibold text-slate-700">
                  {products.length === 0
                    ? "No hay productos para mostrar."
                    : "No se encontraron productos."}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {products.length === 0
                    ? "Los productos registrados aparecerán aquí."
                    : "Intenta con otro nombre o categoría."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 2xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id_producto}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="relative flex h-48 items-center justify-center overflow-hidden bg-slate-100">
                      {product.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={product.nombre}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          src={product.imagen}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                          <span className="text-5xl">🍕</span>
                          <span className="mt-3 text-xs font-medium uppercase tracking-widest text-slate-400">
                            Pizzería Planeta
                          </span>
                        </div>
                      )}

                      <span className="absolute left-3 top-3 max-w-[65%] truncate rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#071C3B] shadow-sm backdrop-blur">
                        {product.categorias.nombre}
                      </span>

                      <span
                        className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${
                          product.disponible
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {product.disponible
                          ? "Disponible"
                          : "No disponible"}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-lg font-bold text-[#071C3B] transition group-hover:text-blue-700">
                        {product.nombre}
                      </h3>

                      <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-slate-500">
                        {product.descripcion || "Sin descripción disponible."}
                      </p>

                      <div className="my-4 border-t border-slate-100" />

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          {product.producto_tamanos.length
                            ? "Presentaciones"
                            : "Precio"}
                        </span>

                        {!product.producto_tamanos.length && (
                          <span className="text-xl font-bold text-[#071C3B]">
                            {currency(product.precio)}
                          </span>
                        )}
                      </div>

                      {product.producto_tamanos.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {product.producto_tamanos.map((entry) => (
                            <div
                              key={entry.id_producto_tamano}
                              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                            >
                              <span className="text-sm font-medium text-slate-600">
                                {entry.tamanos.nombre}
                              </span>
                              <span className="text-sm font-bold text-[#071C3B]">
                                {currency(entry.precio)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="mt-auto flex flex-col gap-2 pt-5">
                          <button
                            type="button"
                            onClick={() => editProduct(product)}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            Editar producto
                          </button>

                          <button
                            type="button"
                            onClick={() => void toggleProduct(product)}
                            className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                              product.disponible
                                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {product.disponible
                              ? "Marcar no disponible"
                              : "Hacer disponible"}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Productos encontrados:{" "}
                <span className="font-bold text-[#071C3B]">
                  {filteredProducts.length}
                </span>
              </p>

              <p className="text-xs text-slate-400">
                Pizzería Planeta · Gestión de catálogo
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  </main>
);

}
