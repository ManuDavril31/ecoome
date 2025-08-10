// Página de detalle de servicio
(function () {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id") || "", 10);
  const cont = document.getElementById("detalle-servicio");
  if (!id) {
    cont.innerHTML = "<p>No se indicó un servicio.</p>";
    return;
  }
  let fuente = [];
  try {
    const raw = localStorage.getItem("mv_servicios");
    if (raw) fuente = JSON.parse(raw);
  } catch {}
  const servicio = Array.isArray(fuente)
    ? fuente.find((s) => s.id === id)
    : null;
  if (!servicio) {
    cont.innerHTML = "<p>Servicio no encontrado.</p>";
    return;
  }
  document.getElementById("servicio-titulo").textContent = servicio.nombre;
  cont.innerHTML = `
    <div class="detalle-card">
      <div class="detalle-media">
        <img src="${servicio.imagen}" alt="${servicio.nombre}"/>
      </div>
      <div class="detalle-info">
        <h3>${servicio.nombre}</h3>
        <p class="precio">$${servicio.precio}</p>
        <p class="desc">${servicio.descripcion || ""}</p>
        <button class="btn-main" id="btn-contratar">Contratar</button>
      </div>
    </div>
  `;
  const btn = document.getElementById("btn-contratar");
  if (btn) {
    btn.addEventListener("click", () => {
      const key = "mv_carrito";
      let carrito = [];
      try {
        carrito = JSON.parse(localStorage.getItem(key) || "[]");
      } catch {}
      carrito.push({ ...servicio, tipo: "servicio", qty: 1 });
      localStorage.setItem(key, JSON.stringify(carrito));
      btn.textContent = "Agendado ✓";
    });
  }
})();
