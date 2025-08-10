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
const SITE_URL = process.env.SITE_URL || "https://monteriavende.com";

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

function baseHtml({
  title,
  description,
  body,
  path: pagePath = "/",
  extraHead = "",
  ogType = "website",
  image = "https://cdn-icons-png.flaticon.com/512/535/535239.png",
  seoAfterMain = "",
}) {
  // Referencia a estilos y scripts del sitio
  const canonical = `${SITE_URL.replace(/\/$/, "")}${
    pagePath.startsWith("/") ? pagePath : "/" + pagePath
  }`;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description || ""}">
<meta name="robots" content="index,follow" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" href="https://cdn-icons-png.flaticon.com/512/535/535239.png" />
<link rel="stylesheet" href="/styles.css" />
<!-- OpenGraph / Twitter -->
<meta property="og:type" content="${ogType}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description || ""}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta property="og:locale" content="es_CO" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description || ""}" />
<meta name="twitter:image" content="${image}" />
${extraHead}
</head>
<body>
<nav style="padding:1rem"><a href="/index.html">Home</a></nav>
<main class="container" style="max-width:1100px;margin:0 auto;padding:1rem">${body}</main>
${seoAfterMain}
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
      .replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img alt="$1" src="$2" loading="lazy" decoding="async" />'
      )
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
  const slug = slugify(b.nombre);
  const pagePath = `/directorio/${catSlug}/${slug}/`;
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
    ? `<section class="seo-content container">${mdToHtml(b.seo_md)}</section>`
    : "";
  const relatedHtml =
    Array.isArray(related) && related.length
      ? `<section class="related"><h3 class="section-title">Relacionados</h3><ul class="related-list">${related
          .map((r) => `<li><a href="${r.url}">${r.nombre}</a></li>`)
          .join("")}</ul></section>`
      : "";
  const ldLocal = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.nombre,
    url: `${SITE_URL.replace(/\/$/, "")}${pagePath}`,
    telephone: b.telefono || undefined,
    image: b.icono || undefined,
    address: b.direccion
      ? {
          "@type": "PostalAddress",
          streetAddress: b.direccion,
          addressLocality: "Montería",
          addressRegion: "Córdoba",
          addressCountry: "CO",
        }
      : undefined,
    sameAs: b.whatsapp ? [b.whatsapp] : undefined,
  };
  const ldBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Directorio",
        item: `${SITE_URL}/index.html#directorio`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: b.categoria || "Categoría",
        item: `${SITE_URL}/directorio/${catSlug}/`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: b.nombre,
        item: `${SITE_URL}${pagePath}`,
      },
    ],
  };
  const extraHead = `\n<script type="application/ld+json">${JSON.stringify(
    ldLocal
  )}</script>\n<script type="application/ld+json">${JSON.stringify(
    ldBreadcrumbs
  )}</script>`;
  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#directorio">Directorio</a> / <a href="/directorio/${catSlug}/">${
    b.categoria
  }</a> / <span>${b.nombre}</span>
 </nav>
<article class="detail detail--product">
  <header class="detail-header">
    ${
      b.icono
        ? `<img class="detail-icon" src="${b.icono}" alt="${b.nombre}" width="56" height="56" loading="lazy" decoding="async">`
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
</article>
`;
  return baseHtml({
    title,
    description: desc,
    body,
    seoAfterMain: seoHtml,
    path: pagePath,
    extraHead,
    ogType: "website",
    image: b.icono || undefined,
  });
}

function productTemplate(p, related = []) {
  const title = `${p.nombre} | Producto en Montería`;
  const desc = `${p.nombre}. ${p.descripcion || ""}`;
  const slug = slugify(p.nombre);
  const pagePath = `/productos/${slug}/`;
  const detailsRows = [
    ["Nombre", p.nombre],
    ["Precio", p.precio],
    ["Descripción", p.descripcion],
    ["Imagen", p.imagen],
    ["URL", p.url],
    ["WhatsApp", p.whatsapp],
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
  const seoHtml = p.seo_md
    ? `<section class="seo-content container">${mdToHtml(p.seo_md)}</section>`
    : "";
  const relatedHtml =
    Array.isArray(related) && related.length
      ? `<section class="related"><h3 class="section-title">Relacionados</h3><ul class="related-list">${related
          .map((r) => `<li><a href="${r.url}">${r.nombre}</a></li>`)
          .join("")}</ul></section>`
      : "";
  // Intentar extraer precio numérico y moneda COP
  const priceNum =
    typeof p.precio === "string"
      ? p.precio
          .replace(/[^0-9.,]/g, "")
          .replace(/\./g, "")
          .replace(",", ".")
      : undefined;
  const price =
    priceNum && !isNaN(parseFloat(priceNum)) ? parseFloat(priceNum) : undefined;
  const ldProduct = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nombre,
    description: p.descripcion || undefined,
    image: p.imagen || undefined,
    url: `${SITE_URL.replace(/\/$/, "")}${pagePath}`,
    offers: price
      ? {
          "@type": "Offer",
          priceCurrency: "COP",
          price: price.toString(),
          availability: "https://schema.org/InStock",
        }
      : undefined,
    sameAs: p.whatsapp ? [p.whatsapp] : undefined,
  };
  const ldBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Productos",
        item: `${SITE_URL}/index.html#productos`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: p.nombre,
        item: `${SITE_URL}${pagePath}`,
      },
    ],
  };
  const extraHead = `\n<script type=\"application/ld+json\">${JSON.stringify(
    ldProduct
  )}</script>\n<script type=\"application/ld+json\">${JSON.stringify(
    ldBreadcrumbs
  )}</script>`;
  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#productos">Productos</a> / <span>${
    p.nombre
  }</span>
</nav>
<article class="detail detail--product">
  <div class="detail-grid">
    <div class="detail-main">
      <header class="detail-header">
        ${
          p.imagen
            ? `<img class="detail-icon" src="${p.imagen}" alt="${p.nombre}" width="72" height="72" loading="lazy" decoding="async">`
            : ""
        }
        <div>
          <h1 class="detail-title">${p.nombre}</h1>
          <div class="detail-sub">
            <span class="chip producto">Producto</span>
            ${p.precio ? `<span class="price-lg">${p.precio}</span>` : ""}
          </div>
        </div>
      </header>
      ${
        p.imagen
          ? `<figure class="detail-hero"><img src="${p.imagen}" alt="${p.nombre}" loading="lazy" decoding="async"></figure>`
          : ""
      }
      ${p.descripcion ? `<p>${p.descripcion}</p>` : ""}
      <div class="detail-actions">
        ${
          p.whatsapp
            ? `<a class="btn-wa" href="${p.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`
            : `<a class=\"btn-wa\" href=\"https://wa.me/573000000000?text=${encodeURIComponent(
                `Hola, me interesa el producto ${p.nombre}`
              )}\" target=\"_blank\" rel=\"noopener\">WhatsApp</a>`
        }
        <a class="btn-outline" href="/index.html#productos">Volver a productos</a>
      </div>
      <h3 class="section-title">Detalles</h3>
      <dl class="detail-dl">${detailsRows}</dl>
    </div>
    <aside class="detail-side">${relatedHtml}</aside>
  </div>
</article>
`;
  return baseHtml({
    title,
    description: desc,
    body,
    seoAfterMain: seoHtml,
    path: pagePath,
    extraHead,
    ogType: "product",
    image: p.imagen || undefined,
  });
}

function serviceTemplate(s, related = []) {
  const title = `${s.nombre} | Servicio en Montería`;
  const desc = `${s.nombre}. ${s.descripcion || ""}`;
  // Derivar slug desde s.url si existe y apunta a /servicios/<slug>/
  let slug = slugify(s.nombre);
  if (s.url && typeof s.url === "string") {
    const idx = s.url.indexOf("servicios/");
    if (idx !== -1) {
      const rest = s.url.slice(idx + "servicios/".length);
      const seg = rest.split(/[\/#?]/)[0];
      if (seg) slug = seg;
    }
  }
  const pagePath = `/servicios/${slug}/`;
  const detailsRows = [
    ["Nombre", s.nombre],
    ["Precio", s.precio],
    ["Descripción", s.descripcion],
    ["Imagen", s.imagen],
    ["URL", s.url],
    ["WhatsApp", s.whatsapp],
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");
  const seoHtml = s.seo_md
    ? `<section class="seo-content container">${mdToHtml(s.seo_md)}</section>`
    : "";
  const relatedHtml =
    Array.isArray(related) && related.length
      ? `<section class="related"><h3 class="section-title">Relacionados</h3><ul class="related-list">${related
          .map((r) => `<li><a href="${r.url}">${r.nombre}</a></li>`)
          .join("")}</ul></section>`
      : "";
  const priceNum =
    typeof s.precio === "string"
      ? s.precio
          .replace(/[^0-9.,]/g, "")
          .replace(/\./g, "")
          .replace(",", ".")
      : undefined;
  const price =
    priceNum && !isNaN(parseFloat(priceNum)) ? parseFloat(priceNum) : undefined;
  const ldService = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.nombre,
    description: s.descripcion || undefined,
    image: s.imagen || undefined,
    url: `${SITE_URL.replace(/\/$/, "")}${pagePath}`,
    offers: price
      ? {
          "@type": "Offer",
          priceCurrency: "COP",
          price: price.toString(),
          availability: "https://schema.org/InStock",
        }
      : undefined,
    areaServed: { "@type": "City", name: "Montería" },
    sameAs: s.whatsapp ? [s.whatsapp] : undefined,
  };
  const ldBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Servicios",
        item: `${SITE_URL}/index.html#servicios`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: s.nombre,
        item: `${SITE_URL}${pagePath}`,
      },
    ],
  };
  const extraHead = `\n<script type=\"application/ld+json\">${JSON.stringify(
    ldService
  )}</script>\n<script type=\"application/ld+json\">${JSON.stringify(
    ldBreadcrumbs
  )}</script>`;
  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#servicios">Servicios</a> / <span>${
    s.nombre
  }</span>
</nav>
<article class="detail detail--service">
  <div class="detail-grid">
    <div class="detail-main">
      <header class="detail-header">
        ${
          s.imagen
            ? `<img class="detail-icon" src="${s.imagen}" alt="${s.nombre}" width="72" height="72" loading="lazy" decoding="async">`
            : ""
        }
        <div>
          <h1 class="detail-title">${s.nombre}</h1>
          <div class="detail-sub">
            <span class="chip servicio">Servicio</span>
            ${s.precio ? `<span class="price-lg">${s.precio}</span>` : ""}
          </div>
        </div>
      </header>
      ${
        s.imagen
          ? `<figure class="detail-hero"><img src="${s.imagen}" alt="${s.nombre}" loading="lazy" decoding="async"></figure>`
          : ""
      }
      ${s.descripcion ? `<p>${s.descripcion}</p>` : ""}
      <div class="detail-actions">
        ${
          s.whatsapp
            ? `<a class="btn-wa" href="${s.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`
            : `<a class=\"btn-wa\" href=\"https://wa.me/573000000000?text=${encodeURIComponent(
                `Hola, me interesa el servicio ${s.nombre}`
              )}\" target=\"_blank\" rel=\"noopener\">WhatsApp</a>`
        }
        <a class="btn-outline" href="/index.html#servicios">Volver a servicios</a>
      </div>
      <h3 class="section-title">Detalles</h3>
  <dl class="detail-dl">${detailsRows}</dl>
    </div>
  <aside class="detail-side">${relatedHtml}</aside>
  </div>
</article>
`;
  return baseHtml({
    title,
    description: desc,
    body,
    seoAfterMain: seoHtml,
    path: pagePath,
    extraHead,
    ogType: "website",
    image: s.imagen || undefined,
  });
}

function generateAll() {
  const negocios = readJson("negocios.json");
  const productos = readJson("productos.json");
  const servicios = readJson("servicios.json");
  const urls = [`${SITE_URL}/`, `${SITE_URL}/index.html`];

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
    urls.push(`${SITE_URL}/directorio/${cat}/${slug}/`);
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
    urls.push(`${SITE_URL}/productos/${slug}/`);
  }

  // Servicios → /servicios/<slug>/index.html
  for (const s of servicios) {
    // Permitir override de slug desde s.url si apunta a servicios/<slug>
    let slug = slugify(s.nombre);
    if (s.url && typeof s.url === "string") {
      const idx = s.url.indexOf("servicios/");
      if (idx !== -1) {
        const rest = s.url.slice(idx + "servicios/".length);
        const seg = rest.split(/[\/#?]/)[0];
        if (seg) slug = seg;
      }
    }
    const dir = path.join(root, "servicios", slug);
    const file = path.join(dir, "index.html");
    const related = servicios
      .filter((x) => x !== s)
      .slice(0, 5)
      .map((x) => {
        let rslug = slugify(x.nombre);
        if (x.url && typeof x.url === "string") {
          const idx2 = x.url.indexOf("servicios/");
          if (idx2 !== -1) {
            const rest2 = x.url.slice(idx2 + "servicios/".length);
            const seg2 = rest2.split(/[\/#?]/)[0];
            if (seg2) rslug = seg2;
          }
        }
        return { nombre: x.nombre, url: `/servicios/${rslug}/` };
      });
    writeFileSafe(file, serviceTemplate(s, related));
    urls.push(`${SITE_URL}/servicios/${slug}/`);
  }

  // sitemap.xml
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") +
    "\n</urlset>\n";
  writeFileSafe(path.join(root, "sitemap.xml"), sitemap);

  // robots.txt
  const robots = `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  writeFileSafe(path.join(root, "robots.txt"), robots);

  console.log("Páginas generadas.");
}

if (require.main === module) {
  generateAll();
}
