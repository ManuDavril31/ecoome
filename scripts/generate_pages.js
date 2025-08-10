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
  const body = `
<section>
  <h1>${b.nombre}</h1>
  <p><strong>Categoría:</strong> ${b.categoria}</p>
  ${b.direccion ? `<p><strong>Dirección:</strong> ${b.direccion}</p>` : ""}
  ${b.telefono ? `<p><strong>Teléfono:</strong> ${b.telefono}</p>` : ""}
  ${
    b.whatsapp
      ? `<p><a class="btn-main" href="${b.whatsapp}" target="_blank" rel="noopener">WhatsApp</a></p>`
      : ""
  }
  ${
    b.url && b.url !== "#"
      ? `<p><a href="${b.url}">Más información</a></p>`
      : ""
  }
</section>
`;
  return baseHtml({ title, description: desc, body });
}

function productTemplate(p) {
  const title = `${p.nombre} | Producto en Montería`;
  const desc = `${p.nombre}. ${p.descripcion || ""}`;
  const body = `
<section class="producto">
  <h1>${p.nombre}</h1>
  ${
    p.imagen
      ? `<img src="${p.imagen}" alt="${p.nombre}" style="max-width:320px"/>`
      : ""
  }
  ${p.descripcion ? `<p>${p.descripcion}</p>` : ""}
  ${p.precio ? `<p><strong>Precio:</strong> ${p.precio}</p>` : ""}
  ${p.url && p.url !== "#" ? `<p><a href="${p.url}">Ver detalle</a></p>` : ""}
</section>
`;
  return baseHtml({ title, description: desc, body });
}

function serviceTemplate(s) {
  const title = `${s.nombre} | Servicio en Montería`;
  const desc = `${s.nombre}. ${s.descripcion || ""}`;
  const body = `
<section class="servicio">
  <h1>${s.nombre}</h1>
  ${
    s.imagen
      ? `<img src="${s.imagen}" alt="${s.nombre}" style="max-width:320px"/>`
      : ""
  }
  ${s.descripcion ? `<p>${s.descripcion}</p>` : ""}
  ${s.precio ? `<p><strong>Precio:</strong> ${s.precio}</p>` : ""}
  ${s.url && s.url !== "#" ? `<p><a href="${s.url}">Ver detalle</a></p>` : ""}
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
