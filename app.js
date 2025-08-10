// Lógica del directorio: búsqueda, categoría y filtros rápidos
(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const list = $(".business-list");
  if (!list) return; // No hay directorio en esta página

  const cards = $$(".business-card", list);
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

  // Inicializa estado y ejecuta primer filtrado
  setActiveCategory("");
  applyFilters();
})();
