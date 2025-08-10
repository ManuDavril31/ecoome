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

// Conversor Markdown básico → HTML (encabezados, listas, enlaces, imágenes, código, tablas)
function mdToHtml(md) {
  if (!md || typeof md !== "string") return "";
  // Escape básico para evitar HTML injection
  md = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Bloques de código ```
  let inCode = false;
  const lines = md.split(/\r?\n/);
  const out = [];
  let listMode = null; // 'ul' | 'ol'
  let tableMode = false;
  let tableRows = [];

  function flushList() {
    if (listMode) {
      out.push(listMode === "ul" ? "</ul>" : "</ol>");
      listMode = null;
    }
  }
  function flushTable() {
    if (tableMode && tableRows.length) {
      const [head, ...rest] = tableRows;
      out.push('<table class="table">');
      out.push(
        "<thead><tr>" +
          head.map((h) => `<th>${h.trim()}</th>`).join("") +
          "</tr></thead>"
      );
      if (rest.length) {
        out.push("<tbody>");
        for (const row of rest)
          out.push(
            "<tr>" + row.map((c) => `<td>${c.trim()}</td>`).join("") + "</tr>"
          );
        out.push("</tbody>");
      }
      out.push("</table>");
    }
    tableMode = false;
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCode) {
        flushList();
        flushTable();
        inCode = true;
        out.push("<pre><code>");
      } else {
        inCode = false;
        out.push("</code></pre>");
      }
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }

    // Tablas: líneas con |
    if (line.includes("|") && /\|.*\|/.test(line)) {
      // detectar separador de tabla (---)
      const isSep = /^\s*\|?\s*:?-{3,}\s*(\|\s*:?-{3,}\s*)+\|?\s*$/.test(line);
      if (!tableMode) {
        flushList();
        tableMode = true;
        tableRows = [];
      }
      if (!isSep) {
        const cells = line.split("|");
        // eliminar celdas vacías de extremos si empiezan/terminan con |
        if (cells[0].trim() === "") cells.shift();
        if (cells[cells.length - 1].trim() === "") cells.pop();
        tableRows.push(cells);
      }
      continue;
    } else if (tableMode) {
      flushTable();
    }

    // Listas
    if (/^\s*[-*]\s+/.test(line)) {
      if (listMode !== "ul") {
        flushList();
        listMode = "ul";
        out.push("<ul>");
      }
      out.push("<li>" + line.replace(/^\s*[-*]\s+/, "") + "</li>");
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listMode !== "ol") {
        flushList();
        listMode = "ol";
        out.push("<ol>");
      }
      out.push("<li>" + line.replace(/^\s*\d+\.\s+/, "") + "</li>");
      continue;
    }
    flushList();

    // Encabezados
    if (/^###\s+/.test(line)) {
      out.push("<h3>" + line.replace(/^###\s+/, "") + "</h3>");
      continue;
    }
    if (/^##\s+/.test(line)) {
      out.push("<h2>" + line.replace(/^##\s+/, "") + "</h2>");
      continue;
    }
    if (/^#\s+/.test(line)) {
      out.push("<h1>" + line.replace(/^#\s+/, "") + "</h1>");
      continue;
    }

    // Enlaces e imágenes, negritas/itálicas, código inline
    let html = line
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    if (html.trim() === "") out.push("<br/>");
    else out.push("<p>" + html + "</p>");
  }
  flushList();
  flushTable();
  return out.join("\n");
}

function businessTemplate(b, related = []) {
  const title = `${b.nombre} | ${b.categoria} en Montería`;
  const desc = `${b.nombre} en ${b.categoria}. Dirección: ${
    b.direccion || ""
  }. Tel: ${b.telefono || ""}.`;
  const catSlug = slugify(b.categoria || "otros");
  const detailsRows = [
    ["Nombre", b.nombre],
    ["Categoría", b.categoria],
    ["Dirección", b.direccion],
    ["Teléfono", b.telefono],
    ["WhatsApp", b.whatsapp],
    ["URL", b.url],
    ["Icono", b.icono],
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
  const seoHtml = b.seo_md
    ? `<section class="seo-content">${mdToHtml(b.seo_md)}</section>`
    : "";
  const relatedHtml =
    Array.isArray(related) && related.length
      ? `<section class="related"><h3 class="section-title">Relacionados</h3><ul class="related-list">${related
          .map((r) => `<li><a href="${r.url}">${r.nombre}</a></li>`)
          .join("")}</ul></section>`
      : "";
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
  <dl class="detail-dl">${detailsRows}</dl>
    </div>
    <aside class="detail-side">
      ${relatedHtml}
    </aside>
  </div>
</section>
${seoHtml}
`;
  return baseHtml({ title, description: desc, body });
}

function productTemplate(p, related = []) {
  const title = `${p.nombre} | Producto en Montería`;
  const desc = `${p.nombre}. ${p.descripcion || ""}`;
  const detailsRows = [
    ["Nombre", p.nombre],
    ["Precio", p.precio],
    ["Descripción", p.descripcion],
    ["Imagen", p.imagen],
    ["URL", p.url],
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
  const seoHtml = p.seo_md
    ? `<section class="seo-content">${mdToHtml(p.seo_md)}</section>`
    : "";
  const relatedHtml =
    Array.isArray(related) && related.length
      ? `<section class="related"><h3 class="section-title">Relacionados</h3><ul class="related-list">${related
          .map((r) => `<li><a href="${r.url}">${r.nombre}</a></li>`)
          .join("")}</ul></section>`
      : "";
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
  <dl class="detail-dl">${detailsRows}</dl>
    </div>
  <aside class="detail-side">${relatedHtml}</aside>
  </div>
</section>
${seoHtml}
`;
  return baseHtml({ title, description: desc, body });
}

function serviceTemplate(s, related = []) {
  const title = `${s.nombre} | Servicio en Montería`;
  const desc = `${s.nombre}. ${s.descripcion || ""}`;
  const detailsRows = [
    ["Nombre", s.nombre],
    ["Precio", s.precio],
    ["Descripción", s.descripcion],
    ["Imagen", s.imagen],
    ["URL", s.url],
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
  const seoHtml = s.seo_md
    ? `<section class="seo-content">${mdToHtml(s.seo_md)}</section>`
    : "";
  const relatedHtml =
    Array.isArray(related) && related.length
      ? `<section class="related"><h3 class="section-title">Relacionados</h3><ul class="related-list">${related
          .map((r) => `<li><a href="${r.url}">${r.nombre}</a></li>`)
          .join("")}</ul></section>`
      : "";
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
  <dl class="detail-dl">${detailsRows}</dl>
    </div>
  <aside class="detail-side">${relatedHtml}</aside>
  </div>
</section>
${seoHtml}
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
    const related = negocios
      .filter(
        (x) =>
          x !== b &&
          (x.categoria || "").toLowerCase() ===
            (b.categoria || "").toLowerCase()
      )
      .slice(0, 5)
      .map((x) => ({
        nombre: x.nombre,
        url: `/directorio/${slugify(x.categoria || "otros")}/${slugify(
          x.nombre
        )}/`,
      }));
    writeFileSafe(file, businessTemplate(b, related));
  }

  // Productos → /productos/<slug>/index.html
  for (const p of productos) {
    const slug = slugify(p.nombre);
    const dir = path.join(root, "productos", slug);
    const file = path.join(dir, "index.html");
    const related = productos
      .filter((x) => x !== p)
      .slice(0, 5)
      .map((x) => ({
        nombre: x.nombre,
        url: `/productos/${slugify(x.nombre)}/`,
      }));
    writeFileSafe(file, productTemplate(p, related));
  }

  // Servicios → /servicios/<slug>/index.html
  for (const s of servicios) {
    const slug = slugify(s.nombre);
    const dir = path.join(root, "servicios", slug);
    const file = path.join(dir, "index.html");
    const related = servicios
      .filter((x) => x !== s)
      .slice(0, 5)
      .map((x) => ({
        nombre: x.nombre,
        url: `/servicios/${slugify(x.nombre)}/`,
      }));
    writeFileSafe(file, serviceTemplate(s, related));
  }

  console.log("Páginas generadas.");
}

if (require.main === module) {
  generateAll();
}
