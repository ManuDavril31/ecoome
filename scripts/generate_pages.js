#!/usr/bin/env node
/**
 * Genera páginas estáticas en estructura tipo silo a partir de los JSON:
 * - negocios.json → /directorio/<slug>/index.html
 * - productos.json → /productos/<slug>/index.html
 * - servicios.json → /servicios/<slug>/index.html
 *
 * Requisitos: Node.js (sin dependencias externas)
 */
const fs = require("fs");
const path = require("path");

const root = process.cwd();

function readJson(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return [];
  const txt = fs.readFileSync(p, "utf8");
  try {
    return JSON.parse(txt);
  } catch {
    return [];
  }
}

function slugify(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileSafe(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function baseHtml({ title, description, body }) {
  // Referencia a estilos y scripts del sitio
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description || ""}">
<link rel="canonical" href="/" />
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/535/535239.png" />
<link rel="stylesheet" href="/styles.css" />
</head>
<body>
<nav style="padding:1rem"><a href="/index.html">Home</a></nav>
<main class="container" style="max-width:1100px;margin:0 auto;padding:1rem">${body}</main>
<footer style="padding:2rem 1rem;color:#666">© 2025 MONTERIA VENDE</footer>
<script src="/store.js"></script>
<script src="/app.js"></script>
</body>
</html>`;
}

function businessTemplate(b) {
  const title = `${b.nombre} | ${b.categoria} en Montería`;
  const desc = `${b.nombre} en ${b.categoria}. Dirección: ${
    b.direccion || ""
  }. Tel: ${b.telefono || ""}.`;
  const catSlug = slugify(b.categoria || "otros");
  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#directorio">Directorio</a> / <a href="/directorio/${catSlug}/">${
    b.categoria
  }</a> / <span>${b.nombre}</span>
 </nav>
<section class="detail">
  <header class="detail-header">
    ${
      b.icono
        ? `<img class="detail-icon" src="${b.icono}" alt="${b.nombre}">`
        : ""
    }
    <div>
      <h1 class="detail-title">${b.nombre}</h1>
      <div class="pill-cat">${b.categoria}</div>
    </div>
  </header>
  <div class="detail-grid">
    <div class="detail-main">
      <div class="detail-meta">
        ${
          b.direccion
            ? `<div><strong>Dirección:</strong> ${b.direccion}</div>`
            : ""
        }
        ${
          b.telefono
            ? `<div><strong>Teléfono:</strong> ${b.telefono}</div>`
            : ""
        }
      </div>
      <div class="detail-actions">
        ${
          b.whatsapp
            ? `<a class="btn-primary" href="${b.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`
            : ""
        }
        <a class="btn-info" href="/index.html#directorio">Volver al directorio</a>
      </div>
      <h3 class="section-title">Detalles</h3>
      <dl class="detail-dl">
        <dt>Nombre</dt><dd>${b.nombre || ""}</dd>
        <dt>Categoría</dt><dd>${b.categoria || ""}</dd>
        <dt>Dirección</dt><dd>${b.direccion || ""}</dd>
        <dt>Teléfono</dt><dd>${b.telefono || ""}</dd>
        <dt>WhatsApp</dt><dd>${b.whatsapp || ""}</dd>
        <dt>URL</dt><dd>${b.url || ""}</dd>
        <dt>Icono</dt><dd>${b.icono || ""}</dd>
      </dl>
    </div>
    <aside class="detail-side">
      <!-- espacio para info adicional -->
    </aside>
  </div>
</section>
`;
  return baseHtml({ title, description: desc, body });
}

function productTemplate(p) {
  const title = `${p.nombre} | Producto en Montería`;
  const desc = `${p.nombre}. ${p.descripcion || ""}`;
  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#productos">Productos</a> / <span>${
    p.nombre
  }</span>
</nav>
<section class="detail">
  <div class="detail-grid">
    <div class="detail-main">
      <header class="detail-header">
        ${
          p.imagen
            ? `<img class="detail-icon" src="${p.imagen}" alt="${p.nombre}">`
            : ""
        }
        <div>
          <h1 class="detail-title">${p.nombre}</h1>
          ${p.precio ? `<div class="price-lg">${p.precio}</div>` : ""}
        </div>
      </header>
      ${p.descripcion ? `<p>${p.descripcion}</p>` : ""}
      <div class="detail-actions">
        <a class="btn-primary" href="/index.html#productos">Volver a productos</a>
      </div>
      <h3 class="section-title">Detalles</h3>
      <dl class="detail-dl">
        <dt>Nombre</dt><dd>${p.nombre || ""}</dd>
        <dt>Precio</dt><dd>${p.precio || ""}</dd>
        <dt>Descripción</dt><dd>${p.descripcion || ""}</dd>
        <dt>Imagen</dt><dd>${p.imagen || ""}</dd>
        <dt>URL</dt><dd>${p.url || ""}</dd>
      </dl>
    </div>
    <aside class="detail-side"></aside>
  </div>
</section>
`;
  return baseHtml({ title, description: desc, body });
}

function serviceTemplate(s) {
  const title = `${s.nombre} | Servicio en Montería`;
  const desc = `${s.nombre}. ${s.descripcion || ""}`;
  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#servicios">Servicios</a> / <span>${
    s.nombre
  }</span>
</nav>
<section class="detail">
  <div class="detail-grid">
    <div class="detail-main">
      <header class="detail-header">
        ${
          s.imagen
            ? `<img class="detail-icon" src="${s.imagen}" alt="${s.nombre}">`
            : ""
        }
        <div>
          <h1 class="detail-title">${s.nombre}</h1>
          ${s.precio ? `<div class="price-lg">${s.precio}</div>` : ""}
        </div>
      </header>
      ${s.descripcion ? `<p>${s.descripcion}</p>` : ""}
      <div class="detail-actions">
        <a class="btn-primary" href="/index.html#servicios">Volver a servicios</a>
      </div>
      <h3 class="section-title">Detalles</h3>
      <dl class="detail-dl">
        <dt>Nombre</dt><dd>${s.nombre || ""}</dd>
        <dt>Precio</dt><dd>${s.precio || ""}</dd>
        <dt>Descripción</dt><dd>${s.descripcion || ""}</dd>
        <dt>Imagen</dt><dd>${s.imagen || ""}</dd>
        <dt>URL</dt><dd>${s.url || ""}</dd>
      </dl>
    </div>
    <aside class="detail-side"></aside>
  </div>
</section>
`;
  return baseHtml({ title, description: desc, body });
}

function generateAll() {
  const negocios = readJson("negocios.json");
  const productos = readJson("productos.json");
  const servicios = readJson("servicios.json");

  // Directorio por categoría (silo) → /directorio/<categoria>/<slug>/index.html
  for (const b of negocios) {
    const cat = slugify(b.categoria || "otros");
    const slug = slugify(b.nombre);
    const dir = path.join(root, "directorio", cat, slug);
    const file = path.join(dir, "index.html");
    writeFileSafe(file, businessTemplate(b));
  }

  // Productos → /productos/<slug>/index.html
  for (const p of productos) {
    const slug = slugify(p.nombre);
    const dir = path.join(root, "productos", slug);
    const file = path.join(dir, "index.html");
    writeFileSafe(file, productTemplate(p));
  }

  // Servicios → /servicios/<slug>/index.html
  for (const s of servicios) {
    const slug = slugify(s.nombre);
    const dir = path.join(root, "servicios", slug);
    const file = path.join(dir, "index.html");
    writeFileSafe(file, serviceTemplate(s));
  }

  console.log("Páginas generadas.");
}

if (require.main === module) {
  generateAll();
}
