// Datos de ejemplo por defecto (se usan si no hay datos en localStorage)
const demoProductos = [
  {
    id: 1,
    nombre: "Laptop",
    precio: 1200,
    descripcion: "Potente laptop para trabajo y estudio.",
    imagen: "https://cdn-icons-png.flaticon.com/512/1055/1055687.png",
  },
  {
    id: 2,
    nombre: "Smartphone",
    precio: 800,
    descripcion: "Smartphone de última generación.",
    imagen: "https://cdn-icons-png.flaticon.com/512/1055/1055672.png",
  },
  {
    id: 3,
    nombre: "Auriculares",
    precio: 150,
    descripcion: "Auriculares inalámbricos de alta calidad.",
    imagen: "https://cdn-icons-png.flaticon.com/512/1055/1055676.png",
  },
];
const demoServicios = [
  {
    id: 1,
    nombre: "Reparación de PC",
    precio: 300,
    descripcion: "Solución de problemas y mantenimiento de computadoras.",
    imagen: "https://cdn-icons-png.flaticon.com/512/1055/1055679.png",
  },
  {
    id: 2,
    nombre: "Instalación de software",
    precio: 100,
    descripcion: "Instalación profesional de software y sistemas.",
    imagen: "https://cdn-icons-png.flaticon.com/512/1055/1055673.png",
  },
];
// Cargar datos desde store.js si existen; si no, usar demo
let productos = [];
let servicios = [];
try {
  // getProductos/getServicios están definidos en store.js si fue cargado por index.html
  if (
    typeof getProductos === "function" &&
    typeof getServicios === "function"
  ) {
    productos = getProductos();
    servicios = getServicios();
  }
} catch (e) {
  // ignore
}
if (!Array.isArray(productos) || productos.length === 0)
  productos = demoProductos;
if (!Array.isArray(servicios) || servicios.length === 0)
  servicios = demoServicios;
// Persistir datasets para que las páginas de detalle puedan leerlos
try {
  localStorage.setItem("mv_productos", JSON.stringify(productos));
  localStorage.setItem("mv_servicios", JSON.stringify(servicios));
} catch (e) {
  // ignore
}
let carrito = [];
function renderLista(lista, contenedorId, tipo) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  // Si el contenedor ya tiene tarjetas (contenido estático para SEO), no re-renderizar
  if (
    contenedor &&
    contenedor.querySelector &&
    contenedor.querySelector(".card")
  ) {
    return;
  }
  contenedor.innerHTML = "";
  lista.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    const enlace = `<a class="card-link" href="${
      tipo === "producto" ? "producto" : "servicio"
    }.html?id=${item.id}" title="Ver detalle" aria-label="Ver ${
      item.nombre
    }"></a>`;
    card.innerHTML = `
      <div class="card-header">
        <span class="chip ${tipo}">${tipo}</span>
      </div>
      <img src="${item.imagen}" alt="${item.nombre}">
      <h3>${item.nombre}</h3>
      <p class="desc">${item.descripcion}</p>
      <p class="precio">Precio: <strong>$${item.precio}</strong></p>
      <div class="card-actions">
        <button onclick="agregarAlCarrito('${tipo}', ${item.id})">Agregar</button>
      </div>
      ${enlace}
    `;
    contenedor.appendChild(card);
  });
}
function loadCartFromLocalStorage() {
  try {
    const data = JSON.parse(localStorage.getItem("mv_carrito") || "[]");
    if (Array.isArray(data)) {
      carrito = data;
    }
  } catch (e) {
    carrito = [];
  }
}
function saveCartToLocalStorage() {
  try {
    localStorage.setItem("mv_carrito", JSON.stringify(carrito));
  } catch (e) {
    // ignore
  }
}
function agregarAlCarrito(tipo, id) {
  let item;
  if (tipo === "producto") {
    item = productos.find((p) => p.id === id);
  } else {
    item = servicios.find((s) => s.id === id);
  }
  if (!item) return;
  const existenteIdx = carrito.findIndex(
    (it) => it.id === item.id && it.tipo === tipo
  );
  if (existenteIdx >= 0) {
    carrito[existenteIdx].qty = (carrito[existenteIdx].qty || 1) + 1;
  } else {
    carrito.push({
      id: item.id,
      nombre: item.nombre,
      precio: item.precio,
      imagen: item.imagen,
      tipo,
      qty: 1,
    });
  }
  saveCartToLocalStorage();
  renderCarrito();
}
function renderCarrito() {
  const lista = document.getElementById("carrito-lista");
  lista.innerHTML = "";
  carrito.forEach((item) => {
    const li = document.createElement("li");
    const tipoLabel = item.tipo === "producto" ? "Producto" : "Servicio";
    const qty = item.qty || 1;
    li.textContent = `${tipoLabel}: ${item.nombre} x${qty} - $${
      item.precio * qty
    }`;
    lista.appendChild(li);
  });
}
const btnVaciar = document.getElementById("vaciar-carrito");
if (btnVaciar) {
  btnVaciar.onclick = function () {
    carrito = [];
    saveCartToLocalStorage();
    renderCarrito();
  };
}

// Formulario de contacto
const formContacto = document.getElementById("form-contacto");
if (formContacto) {
  formContacto.addEventListener("submit", function (e) {
    e.preventDefault();
    const nombre = formContacto
      .querySelector("input[type='text']")
      .value.trim();
    const correo = formContacto
      .querySelector("input[type='email']")
      .value.trim();
    const mensaje = formContacto.querySelector("textarea").value.trim();
    if (!nombre || !correo || !mensaje) {
      alert("Por favor completa todos los campos.");
      return;
    }
    alert("¡Gracias por contactarnos, " + nombre + "!");
    formContacto.reset();
  });
}

// Inicializar
// Render condicional: si no hay tarjetas estáticas, generarlas como respaldo
renderLista(productos, "productos-lista", "producto");
renderLista(servicios, "servicios-lista", "servicio");
// Cargar carrito persistido y renderizar
loadCartFromLocalStorage();
renderCarrito();

// --- Búsqueda y filtros del directorio (progresivo, no afecta SEO) ---
(function initDirectorioFilters() {
  const list = document.querySelector(".business-list");
  if (!list) return;
  const cards = Array.from(list.querySelectorAll(".business-card"));
  const q = document.getElementById("q");
  const categoria = document.getElementById("categoria");
  const btnBuscar = document.getElementById("btn-buscar");
  const btnLimpiar = document.getElementById("btn-limpiar");
  const pills = Array.from(document.querySelectorAll(".filters .pill"));
  const status = document.getElementById("dir-status");

  const normalizar = (s) =>
    (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  function applyFilters(pushState = true) {
    const textRaw = q ? q.value.trim() : "";
    const text = normalizar(textRaw);
    const cat = categoria ? categoria.value : "";
    let visibles = 0;
    cards.forEach((card) => {
      const ccat = card.getAttribute("data-category") || "";
      const title = card.getAttribute("data-title") || "";
      const kw = card.getAttribute("data-keywords") || "";
      const hayTexto = text
        ? normalizar(title).includes(text) || normalizar(kw).includes(text)
        : true;
      const hayCat = cat ? ccat === cat : true;
      const show = hayTexto && hayCat;
      card.style.display = show ? "" : "none";
      if (show) visibles++;
    });
    if (status) {
      status.textContent =
        visibles === 0
          ? "No se encontraron resultados con los filtros actuales."
          : `${visibles} resultado${visibles === 1 ? "" : "s"}`;
    }
    if (pushState) {
      const params = new URLSearchParams(window.location.search);
      if (textRaw) params.set("q", textRaw);
      else params.delete("q");
      if (cat) params.set("cat", cat);
      else params.delete("cat");
      const qs = params.toString();
      const newUrl = `${window.location.pathname}${qs ? "?" + qs : ""}${
        window.location.hash
      }`;
      window.history.replaceState({}, "", newUrl);
    }
  }

  function setActivePill(pillCat) {
    pills.forEach((p) => p.classList.remove("active"));
    const current = pills.find(
      (p) => p.getAttribute("data-filter") === pillCat
    );
    if (current) current.classList.add("active");
  }

  if (q) q.addEventListener("input", () => applyFilters());
  if (categoria)
    categoria.addEventListener("change", (e) => {
      setActivePill(e.target.value || "");
      applyFilters();
    });
  if (btnBuscar) btnBuscar.addEventListener("click", () => applyFilters());
  if (btnLimpiar)
    btnLimpiar.addEventListener("click", () => {
      if (q) q.value = "";
      if (categoria) categoria.value = "";
      setActivePill("");
      applyFilters();
    });
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const val = pill.getAttribute("data-filter") || "";
      if (categoria) categoria.value = val;
      setActivePill(val);
      applyFilters();
    });
  });

  // Inicializar desde querystring si aplica
  try {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q") || "";
    const catParam = params.get("cat") || "";
    if (q && qParam) q.value = qParam;
    if (categoria && catParam) categoria.value = catParam;
    setActivePill(catParam || "");
  } catch (_) {}
  applyFilters(false);
})();
