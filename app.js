// Parser CSV robusto (comillas, comas y saltos de línea)
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        // ignorar CR
      } else {
        cur += c;
      }
    }
  }
  row.push(cur);
  rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => (v || "").trim() !== ""))
    .map((cols) => {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = (cols[idx] || "").trim()));
      return obj;
    });
}

// Lógica del directorio: búsqueda, categoría y filtros rápidos
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const list = $(".business-list");
  if (!list) return; // No hay directorio en esta página

  let cards = $$(".business-card", list);
  const q = $("#q");
  const categoria = $("#categoria");
  const dirStatus = $("#dir-status");
  const btnBuscar = $("#btn-buscar");
  const btnLimpiar = $("#btn-limpiar");
  const pills = $$(".filters .pill");

  const normalize = (s) =>
    (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .trim();

  let activeCategory = "";

  // Carga dinámica desde JSON/CSV (data-src) o JSON embebido
  (async function hydrateFromJsonOrSrc() {
    const node = document.getElementById("negocios-data");
    if (!node) return;
    const src = node.getAttribute("data-src");

    function toBizArray(raw) {
      if (!Array.isArray(raw)) return [];
      return raw.map((biz) => ({
        categoria: biz.categoria || biz.category || "Otros",
        nombre: biz.nombre || biz.title || "Negocio",
        icono:
          biz.icono ||
          biz.img ||
          "https://cdn-icons-png.flaticon.com/512/565/565547.png",
        telefono: biz.telefono || biz.tel || "",
        direccion: biz.direccion || biz.address || "",
        whatsapp: biz.whatsapp || biz.wa || "",
        url: biz.url || biz.info || "#",
      }));
    }

    try {
      let data = [];
      if (src && src.trim()) {
        const res = await fetch(src, { cache: "no-store" });
        const text = await res.text();
        if (
          src.endsWith(".csv") ||
          text.trim().toLowerCase().startsWith("nombre,")
        ) {
          const rows = parseCsv(text);
          data = rows.map((r) => ({
            nombre: r.nombre,
            categoria: r.categoria,
            direccion: r.direccion,
            telefono: r.telefono,
            whatsapp: r.whatsapp,
            url: r.url,
            icono: r.icono,
          }));
        } else {
          data = JSON.parse(text || "[]");
        }
      } else {
        data = JSON.parse(node.textContent || "[]");
      }

      const items = toBizArray(data);
      if (!items.length) return;
      const frag = document.createDocumentFragment();
      items.forEach((biz) => {
        const cat = biz.categoria;
        const title = biz.nombre;
        const img = biz.icono;
        const tel = biz.telefono;
        const addr = biz.direccion;
        const wa = biz.whatsapp;
        const urlInfo = biz.url;
        const keywords = `${title} ${cat} ${addr} ${tel}`;

        const art = document.createElement("article");
        art.className = "business-card";
        art.dataset.category = cat;
        art.dataset.title = title;
        art.dataset.keywords = keywords;
        art.innerHTML = `
          <img src="${img}" alt="${title}" loading="lazy" decoding="async"/>
          <div>
            <div class="biz-header">
              <h3 class="biz-title">${title}</h3>
              <span class="pill-cat">${cat}</span>
            </div>
            <div class="biz-sub">
              <span class="biz-rating">★★★★★ <span class="count">4.6</span></span>
              <span class="open-now">Abierto ahora</span>
            </div>
            ${addr ? `<p class="biz-meta">${addr}</p>` : ""}
            ${tel ? `<p class="biz-meta">Tel: ${tel}</p>` : ""}
            <div class="biz-actions">
              ${
                wa
                  ? `<a class=\"btn-wa\" href=\"${wa}\" target=\"_blank\" rel=\"noopener\">WhatsApp</a>`
                  : ""
              }
              <a class="btn-info" href="${urlInfo}">Más Información</a>
            </div>
          </div>`;
        frag.appendChild(art);
      });
      // Reemplaza los estáticos por los dinámicos (JSON/CSV)
      list.innerHTML = "";
      list.appendChild(frag);
      cards = $$(".business-card", list); // refresca colección
      applyFilters();
    } catch (e) {
      console.warn("No se pudo cargar negocios JSON/CSV", e);
    }
  })();

  function setActiveCategory(cat) {
    activeCategory = cat || "";
    // sincroniza select
    if (categoria) categoria.value = activeCategory;
    // sincroniza pills
    pills.forEach((p) => {
      p.classList.toggle(
        "active",
        normalize(p.dataset.filter) === normalize(activeCategory) &&
          !!activeCategory
      );
    });
  }

  function applyFilters() {
    const query = normalize(q && q.value);
    const nCat = normalize(activeCategory);
    let visible = 0;

    cards.forEach((card) => {
      const cat = normalize(card.dataset.category);
      const title = normalize(card.dataset.title);
      const keys = normalize(card.dataset.keywords);
      const haystack = `${title} ${keys} ${cat}`;
      const matchesQuery = !query || haystack.includes(query);
      const matchesCategory = !nCat || cat === nCat;
      const show = matchesQuery && matchesCategory;
      card.style.display = show ? "grid" : "none";
      if (show) visible++;
    });

    if (dirStatus) {
      const parts = [];
      parts.push(`${visible} resultado${visible === 1 ? "" : "s"}`);
      if (activeCategory) parts.push(`en "${activeCategory}"`);
      if (q && q.value && q.value.trim())
        parts.push(`para "${q.value.trim()}"`);
      dirStatus.textContent = parts.join(" ");
    }

    // Refleja filtros en la URL para SEO y compartición
    try {
      const params = new URLSearchParams(window.location.search);
      if (q && q.value && q.value.trim()) params.set("q", q.value.trim());
      else params.delete("q");
      if (activeCategory) params.set("cat", activeCategory);
      else params.delete("cat");
      const newUrl = `${window.location.pathname}${
        params.toString() ? "?" + params.toString() : ""
      }${window.location.hash || ""}`;
      window.history.replaceState({}, "", newUrl);
    } catch (_) {}
  }

  // Eventos
  pills.forEach((p) =>
    p.addEventListener("click", () => {
      const cat = p.dataset.filter || "";
      setActiveCategory(cat);
      applyFilters();
    })
  );

  if (categoria) {
    categoria.addEventListener("change", () => {
      setActiveCategory(categoria.value || "");
      applyFilters();
    });
  }

  if (btnBuscar) btnBuscar.addEventListener("click", applyFilters);
  if (q) {
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFilters();
    });
    // Búsqueda reactiva ligera
    q.addEventListener("input", () => {
      applyFilters();
    });
  }
  if (btnLimpiar)
    btnLimpiar.addEventListener("click", () => {
      if (q) q.value = "";
      setActiveCategory("");
      applyFilters();
    });

  // Inicializa desde parámetros de URL si existen
  try {
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q") || "";
    const catParam = params.get("cat") || "";
    if (q && qParam) q.value = qParam;
    if (catParam) setActiveCategory(catParam);
  } catch (_) {}

  applyFilters();
})();

// Carga dinámica de productos y servicios (fuera del IIFE del directorio)
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  function mapCsv(rows) {
    return rows.map((r) => ({
      nombre: r.nombre,
      precio: r.precio,
      descripcion: r.descripcion,
      imagen: r.imagen,
      url: r.url,
      tipo: r.tipo || "producto",
    }));
  }

  function renderCards(container, items, tipo) {
    if (!container || !Array.isArray(items) || !items.length) return;
    const frag = document.createDocumentFragment();
    items.forEach((it, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      const id = idx + 1;
      const precio = it.precio || "";
      const desc = it.descripcion || "";
      const img =
        it.imagen ||
        (tipo === "servicio"
          ? "https://cdn-icons-png.flaticon.com/512/1055/1055679.png"
          : "https://cdn-icons-png.flaticon.com/512/1055/1055687.png");
      const href = it.url || "#";
      const name = it.nombre || (tipo === "servicio" ? "Servicio" : "Producto");
      card.innerHTML = `
        <div class="card-header">
          <span class="chip ${tipo}">${tipo}</span>
        </div>
        <img src="${img}" alt="${name}" />
        <h3>${name}</h3>
        ${desc ? `<p class="desc">${desc}</p>` : ""}
        ${
          precio
            ? `<p class="precio">Precio: <strong>${precio}</strong></p>`
            : ""
        }
        <div class="card-actions">
          <button onclick="agregarAlCarrito('${tipo}', ${id})">Agregar</button>
        </div>
        <a class="card-link" href="${href}" title="Ver detalle" aria-label="Ver ${name}"></a>
      `;
      frag.appendChild(card);
    });
    container.innerHTML = "";
    container.appendChild(frag);
  }

  async function loadFromScript(scriptId) {
    const node = document.getElementById(scriptId);
    if (!node) return [];
    const src = node.getAttribute("data-src");
    try {
      if (src && src.trim()) {
        const res = await fetch(src, { cache: "no-store" });
        const text = await res.text();
        if (
          src.endsWith(".csv") ||
          text.trim().toLowerCase().startsWith("nombre,")
        ) {
          return mapCsv(parseCsv(text));
        }
        return JSON.parse(text);
      }
      return JSON.parse(node.textContent || "[]");
    } catch (_) {
      return [];
    }
  }

  (async function hydrateProductsAndServices() {
    const productos = await loadFromScript("productos-data");
    const servicios = await loadFromScript("servicios-data");
    if (productos && productos.length) {
      renderCards(
        document.getElementById("productos-lista"),
        productos,
        "producto"
      );
    }
    if (servicios && servicios.length) {
      renderCards(
        document.getElementById("servicios-lista"),
        servicios,
        "servicio"
      );
    }
  })();
})();
