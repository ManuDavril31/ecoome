// Página de detalle de producto
// Obtiene ?id= y busca en productos; si no hay store, usa los demo del app
(function () {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id") || "", 10);
  if (!id) {
    document.getElementById("detalle").innerHTML =
      "<p>No se indicó un producto.</p>";
    return;
  }
  // Intentar leer desde app.js scope si existe
  let fuente = [];
  if (window.getProductos) {
    try {
      fuente = window.getProductos();
    } catch {}
  }
  if (!Array.isArray(fuente) || fuente.length === 0) {
    // fallback a los demo del app si están en window
    if (Array.isArray(window.demoProductos)) fuente = window.demoProductos;
  }
  // Otro fallback: si no hay nada, pedir al opener o al localStorage
  if (!Array.isArray(fuente) || fuente.length === 0) {
    try {
      const raw = localStorage.getItem("mv_productos");
      if (raw) fuente = JSON.parse(raw);
    } catch {}
  }
  const producto = Array.isArray(fuente)
    ? fuente.find((p) => p.id === id)
    : null;
  const cont = document.getElementById("detalle");
  if (!producto) {
    cont.innerHTML = "<p>Producto no encontrado.</p>";
    return;
  }
  document.getElementById("producto-titulo").textContent = producto.nombre;
  cont.innerHTML = `
    <div class="detalle-card">
      <div class="detalle-media">
        <img src="${producto.imagen}" alt="${producto.nombre}"/>
      </div>
      <div class="detalle-info">
        <h3>${producto.nombre}</h3>
        <p class="precio">$${producto.precio}</p>
        <p class="desc">${producto.descripcion || ""}</p>
        <button class="btn-main" id="btn-add">Agregar al carrito</button>
      </div>
    </div>
  `;
  const btn = document.getElementById("btn-add");
  if (btn) {
    btn.addEventListener("click", () => {
      // Guardar en un carrito simple en localStorage
      const key = "mv_carrito";
      let carrito = [];
      try {
        carrito = JSON.parse(localStorage.getItem(key) || "[]");
      } catch {}
      carrito.push({ ...producto, tipo: "producto", qty: 1 });
      localStorage.setItem(key, JSON.stringify(carrito));
      btn.textContent = "Agregado ✓";
    });
  }
})();
