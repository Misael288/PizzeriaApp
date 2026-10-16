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
    //Aquie empieza el diseño
    <main className="container py-4 py-lg-5">
      <header className="bg-[#071C3B] container py-4 py-lg-5">
  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
    <div>
      <p className="text-white text-uppercase text-danger fw-semibold small mb-1">
        Administración del catálogo
      </p>
      <p className="text-white text-uppercase fw-semibold small mb-1">
        Pizzería Planeta
        </p>
      <h1 className="h2 mb-1 text-white">
        Categorías y productos
      </h1>
      <p className="text-secondary mb-0 text-white">
        {isAdmin
          ? "Administra categorías, productos y presentaciones."
          : "Consulta los productos disponibles para registrar pedidos."}
      </p>
    </div>
    <a className="btn btn-outline-secondary text-white" style={{backgroundColor:'#F52727'}} href="/dashboard">
      Volver al panel
    </a>
  </div>
</header>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      ) : null}

      <ul className="nav nav-tabs mb-4" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            aria-selected={activeTab === "products"}
            className={`nav-link${activeTab === "products" ? " active" : ""}`}
            onClick={() => setActiveTab("products")}
            role="tab"
            type="button"
          >
            Productos ({products.length})
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            aria-selected={activeTab === "categories"}
            className={`nav-link${activeTab === "categories" ? " active" : ""}`}
            onClick={() => setActiveTab("categories")}
            role="tab"
            type="button"
          >
            Categorías ({categories.length})
          </button>
        </li>
      </ul>

      {activeTab === "categories" ? (
        <div className="row g-4">
          {isAdmin ? (
            <div className="col-12 col-xl-4">
              <section className="card shadow-sm">
                <div className="card-body">
                  <h2 className="h5 card-title">
                    {editingCategoryId ? "Editar categoría" : "Nueva categoría"}
                  </h2>
                  <form className="vstack gap-3" onSubmit={saveCategory}>
                    <div>
                      <label className="form-label" htmlFor="category-name">
                        Nombre
                      </label>
                      <input
                        className="form-control"
                        id="category-name"
                        maxLength={100}
                        onChange={(event) => setCategoryName(event.target.value)}
                        required
                        value={categoryName}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="category-description">
                        Descripción
                      </label>
                      <textarea
                        className="form-control"
                        id="category-description"
                        maxLength={255}
                        onChange={(event) =>
                          setCategoryDescription(event.target.value)
                        }
                        rows={3}
                        value={categoryDescription}
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-danger"
                        disabled={isSaving}
                        type="submit"
                      >
                        {isSaving ? "Guardando..." : "Guardar categoría"}
                      </button>
                      {editingCategoryId ? (
                        <button
                          className="btn btn-outline-secondary"
                          onClick={resetCategoryForm}
                          type="button"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </section>
            </div>
          ) : null}
          <div className={isAdmin ? "col-12 col-xl-8" : "col-12"}>
            {isLoading ? (
              <div className="text-center py-5">
                <div aria-label="Cargando" className="spinner-border text-danger" role="status" />
              </div>
            ) : categories.length === 0 ? (
              <div className="alert alert-info">No hay categorías registradas.</div>
            ) : (
              <div className="list-group shadow-sm">
                {categories.map((category) => (
                  <div
                    className="list-group-item d-flex flex-column flex-sm-row justify-content-between gap-3 py-3"
                    key={category.id_categoria}
                  >
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <h3 className="h6 mb-0">{category.nombre}</h3>
                        <span
                          className={`badge ${category.activo ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {category.activo ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      {category.descripcion ? (
                        <p className="small text-secondary mb-0 mt-1">
                          {category.descripcion}
                        </p>
                      ) : null}
                      <span className="small text-secondary">
                        {category._count?.productos ?? 0} productos asociados
                      </span>
                    </div>
                    {isAdmin ? (
                      <div className="d-flex gap-2 align-self-start">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            setEditingCategoryId(category.id_categoria);
                            setEditingCategoryActive(category.activo);
                            setCategoryName(category.nombre);
                            setCategoryDescription(category.descripcion ?? "");
                          }}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => void toggleCategory(category)}
                          type="button"
                        >
                          {category.activo ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {isAdmin ? (
            <div className="col-12 col-xl-5">
              <section className="card shadow-sm mb-4">
                <div className="card-body">
                  <h2 className="h5 card-title">
                    {editingProductId ? "Editar producto" : "Nuevo producto"}
                  </h2>
                  <form className="vstack gap-3" onSubmit={saveProduct}>
                    <div>
                      <label className="form-label" htmlFor="product-name">
                        Nombre del producto
                      </label>
                      <input
                        className="form-control"
                        id="product-name"
                        maxLength={100}
                        onChange={(event) => setProductName(event.target.value)}
                        required
                        value={productName}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="product-category">
                        Categoría
                      </label>
                      <select
                        className="form-select"
                        id="product-category"
                        onChange={(event) =>
                          setProductCategoryId(event.target.value)
                        }
                        required
                        value={productCategoryId}
                      >
                        <option value="">Selecciona una categoría</option>
                        {categories
                          .filter(
                            (category) =>
                              category.activo ||
                              category.id_categoria ===
                                Number(productCategoryId),
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
                      <label className="form-label" htmlFor="product-description">
                        Descripción
                      </label>
                      <textarea
                        className="form-control"
                        id="product-description"
                        maxLength={255}
                        onChange={(event) =>
                          setProductDescription(event.target.value)
                        }
                        rows={2}
                        value={productDescription}
                      />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="product-image">
                        Imagen del producto
                      </label>
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        className="form-control"
                        id="product-image"
                        ref={imageInputRef}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setSelectedImage(file);
                          setError("");

                          if (file && file.size > 5 * 1024 * 1024) {
                            setSelectedImage(null);
                            setError("La imagen no puede superar 5 MB.");
                          }
                        }}
                        type="file"
                      />
                      <div className="form-text">
                        PNG, JPEG o WebP; máximo 5 MB.
                        {productImage && !selectedImage
                          ? " Se conservará la imagen actual."
                          : ""}
                      </div>
                      {selectedImage ? (
                        <p className="small text-success mt-2 mb-0">
                          Imagen seleccionada: {selectedImage.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="form-check form-switch">
                      <input
                        checked={available}
                        className="form-check-input"
                        id="product-available"
                        onChange={(event) => setAvailable(event.target.checked)}
                        type="checkbox"
                      />
                      <label className="form-check-label" htmlFor="product-available">
                        Disponible
                      </label>
                    </div>

                    <fieldset className="border rounded p-3">
                      <legend className="float-none w-auto px-2 fs-6">
                        Tamaños y precios
                      </legend>
                      {productSizes.length ? (
                        <div className="list-group mb-3">
                          {productSizes.map((entry) => {
                            const size = sizes.find(
                              (candidate) =>
                                candidate.id_tamano === entry.sizeId,
                            );
                            return (
                              <div
                                className="list-group-item d-flex justify-content-between align-items-center"
                                key={entry.sizeId}
                              >
                                <span>
                                  {size?.nombre ?? "Tamaño"} —{" "}
                                  {currency(entry.price)}
                                </span>
                                <button
                                  aria-label={`Quitar tamaño ${size?.nombre ?? ""}`}
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    setProductSizes((current) =>
                                      current.filter(
                                        (item) => item.sizeId !== entry.sizeId,
                                      ),
                                    )
                                  }
                                  type="button"
                                >
                                  Quitar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="small text-secondary">
                          Sin tamaños: el producto usará un precio único.
                        </p>
                      )}
                      <div className="row g-2 align-items-end">
                        <div className="col-7">
                          <label className="form-label" htmlFor="size-select">
                            Tamaño
                          </label>
                          <select
                            className="form-select"
                            id="size-select"
                            onChange={(event) =>
                              setSizeSelection(event.target.value)
                            }
                            value={sizeSelection}
                          >
                            <option value="">Selecciona</option>
                            {sizes
                              .filter(
                                (size) =>
                                  !selectedSizeIds.has(size.id_tamano),
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
                        <div className="col-5">
                          <label className="form-label" htmlFor="size-price">
                            Precio
                          </label>
                          <input
                            className="form-control"
                            id="size-price"
                            min="0"
                            onChange={(event) => setSizePrice(event.target.value)}
                            step="0.01"
                            type="number"
                            value={sizePrice}
                          />
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-outline-primary mt-2"
                        onClick={appendProductSize}
                        type="button"
                      >
                        Agregar tamaño
                      </button>
                    </fieldset>

                    {productSizes.length === 0 ? (
                      <div>
                        <label className="form-label" htmlFor="base-price">
                          Precio único
                        </label>
                        <input
                          className="form-control"
                          id="base-price"
                          min="0"
                          onChange={(event) => setBasePrice(event.target.value)}
                          required
                          step="0.01"
                          type="number"
                          value={basePrice}
                        />
                      </div>
                    ) : null}

                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-danger"
                        disabled={isSaving || categories.every((item) => !item.activo)}
                        type="submit"
                      >
                        {isSaving ? "Guardando..." : "Guardar producto"}
                      </button>
                      {editingProductId ? (
                        <button
                          className="btn btn-outline-secondary"
                          onClick={resetProductForm}
                          type="button"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </section>

              <section className="card shadow-sm">
                <div className="card-body">
                  <h2 className="h5 card-title">Agregar tamaño</h2>
                  <p className="small text-secondary">
                    Crea opciones de presentación para asignar precios a productos.
                  </p>
                  <form className="input-group" onSubmit={addSizeOption}>
                    <input
                      aria-label="Nombre del tamaño"
                      className="form-control"
                      maxLength={50}
                      onChange={(event) => setSizeName(event.target.value)}
                      placeholder="Ej. 355 ml, Mediana"
                      required
                      value={sizeName}
                    />
                    <button className="btn btn-outline-primary" type="submit">
                      Agregar
                    </button>
                  </form>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    {sizes.map((size) => (
                      <span className="badge rounded-pill text-bg-light border" key={size.id_tamano}>
                        {size.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          <div className={isAdmin ? "col-12 col-xl-7" : "col-12"}>
            <div className="d-flex flex-column flex-sm-row justify-content-between gap-2 mb-3">
              <h2 className="h5 mb-0 align-self-center">Listado de productos</h2>
              <input
                aria-label="Buscar producto o categoría"
                className="form-control"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto o categoría"
                value={search}
                style={{ maxWidth: "22rem" }}
              />
            </div>
            {isLoading ? (
              <div className="text-center py-5">
                <div aria-label="Cargando" className="spinner-border text-danger" role="status" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="alert alert-info">
                {products.length === 0
                  ? "No hay productos para mostrar."
                  : "No se encontraron productos con esa búsqueda."}
              </div>
            ) : (
              <div className="row g-3">
                {filteredProducts.map((product) => (
                  <div className="col-12 col-md-6" key={product.id_producto}>
                    <article className="card h-100 shadow-sm">
                      {product.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={product.nombre}
                          className="card-img-top"
                          height={180}
                          src={product.imagen}
                          style={{ objectFit: "cover" }}
                        />
                      ) : null}
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between gap-2">
                          <span className="badge text-bg-light border align-self-start">
                            {product.categorias.nombre}
                          </span>
                          {isAdmin ? (
                            <span
                              className={`badge ${product.disponible ? "text-bg-success" : "text-bg-secondary"}`}
                            >
                              {product.disponible ? "Disponible" : "No disponible"}
                            </span>
                                            ) : (
                                              <span
                                                className={`badge ${product.disponible ? "text-bg-success" : "text-bg-secondary"}`}
                                              >
                                                {product.disponible ? "Disponible" : "No disponible"}
                                              </span>
                                            )}
                        </div>
                        <h3 className="h5 mt-3">{product.nombre}</h3>
                        {product.descripcion ? (
                          <p className="small text-secondary">
                            {product.descripcion}
                          </p>
                        ) : null}
                        {product.producto_tamanos.length ? (
                          <ul className="list-unstyled small mb-3">
                            {product.producto_tamanos.map((entry) => (
                              <li
                                className="d-flex justify-content-between border-bottom py-1"
                                key={entry.id_producto_tamano}
                              >
                                <span>{entry.tamanos.nombre}</span>
                                <strong>{currency(entry.precio)}</strong>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mb-3 fw-semibold">
                            {currency(product.precio)}
                          </p>
                        )}
                        {isAdmin ? (
                          <div className="d-flex gap-2 mt-auto">
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => editProduct(product)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => void toggleProduct(product)}
                              type="button"
                            >
                              {product.disponible
                                ? "Marcar no disponible"
                                : "Hacer disponible"}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-auto">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => void toggleProduct(product)}
                              type="button"
                            >
                              {product.disponible
                                ? "Marcar no disponible"
                                : "Hacer disponible"}
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
