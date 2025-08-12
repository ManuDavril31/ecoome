#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

// Carpeta raíz (contiene JSON y carpeta de salida)
const root = path.resolve(__dirname, "..");
// URL base del sitio
const SITE_URL = (process.env.SITE_URL || "http://localhost").replace(
  /\/$/,
  ""
);

function slugify(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readJson(fileName) {
  const p = path.join(root, fileName);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Error leyendo", fileName, e.message);
    return [];
  }
}

function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

// Conversor Markdown sencillo
function mdToHtml(md = "") {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let listMode = null; // "ul" | "ol"

  function flushList() {
    if (listMode) {
      out.push(listMode === "ul" ? "</ul>" : "</ol>");
      listMode = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCode) {
        flushList();
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

    // Enlaces, imágenes, negritas/itálicas, código inline
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
  return out.join("\n");
}

function baseHtml({
  title,
  description,
  body,
  seoAfterMain = "",
  path: pagePath = "/",
  extraHead = "",
  ogType = "website",
  image,
}) {
  // Prefijo de rutas para assets (CSS/JS) según la profundidad del path
  const depth = (pagePath || "/").split("/").filter(Boolean).length;
  const assetPrefix = depth ? "../".repeat(depth) : "";
  const canonical =
    SITE_URL + (pagePath.startsWith("/") ? pagePath : "/" + pagePath);
  const metaImg = image || "/og-image.png";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${(description || "").replace(
    /"/g,
    "&quot;"
  )}" />
  <link rel="canonical" href="${canonical}" />
  <link rel="stylesheet" href="${assetPrefix}styles.css" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${(description || "").replace(
    /"/g,
    "&quot;"
  )}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${metaImg}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${(description || "").replace(
    /"/g,
    "&quot;"
  )}" />
  <meta name="twitter:image" content="${metaImg}" />
  ${extraHead}
</head>
<body>
  <main class="container">
    ${body}
  </main>
  ${seoAfterMain}
</body>
</html>`;
}

function businessTemplate(b) {
  const title = `${b.nombre} | ${b.categoria || "Negocio"} en Montería`;
  const desc = `${b.nombre} en ${b.categoria || "Negocio"}. Dirección: ${
    b.direccion || ""
  }. Tel: ${b.telefono || ""}.`;
  let catSlug = slugify(b.categoria || "otros");
  let slug = slugify(b.nombre);
  // Si b.url proporciona /directorio/<cat>/<slug>/, úsalo para estabilidad de URLs
  if (b.url && typeof b.url === "string") {
    const idx = b.url.indexOf("directorio/");
    if (idx !== -1) {
      const rest = b.url.slice(idx + "directorio/".length);
      const parts = rest.split(/[\/#?]/).filter(Boolean);
      if (parts[0]) catSlug = slugify(parts[0]);
      if (parts[1]) slug = slugify(parts[1]);
    }
  }
  const pagePath = `/directorio/${catSlug}/${slug}/`;

  const detailsRows = [
    ["Nombre", b.nombre],
    ["Categoría", b.categoria],
    ["Dirección", b.direccion],
    ["Teléfono", b.telefono],
    ["Horario", b.horario],
    ["Descripción", b.descripcion],
    ["Sitio", b.url],
    ["WhatsApp", b.whatsapp],
  ]
    .filter(([, v]) => v && String(v).trim() !== "")
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join("");

  const seoHtml = b.seo_md
    ? `<section class="seo-content container">${mdToHtml(b.seo_md)}</section>`
    : "";

  const ldBiz = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: b.nombre,
    description: b.descripcion || undefined,
    image: b.icono || b.logo || b.imagen || undefined,
    url: `${SITE_URL}${pagePath}`,
    address: b.direccion
      ? { "@type": "PostalAddress", streetAddress: b.direccion }
      : undefined,
    telephone: b.telefono || undefined,
    openingHours: b.horario || undefined,
    sameAs: b.whatsapp ? [b.whatsapp] : undefined,
  };
  const ldBreadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: SITE_URL + "/",
      },
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
        item: `${SITE_URL}/index.html#directorio`,
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
    ldBiz
  )}</script>\n<script type="application/ld+json">${JSON.stringify(
    ldBreadcrumbs
  )}</script>`;

  const wa =
    b.whatsapp ||
    `https://wa.me/573000000000?text=${encodeURIComponent(
      `Hola, me interesa ${b.nombre}`
    )}`;

  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <a href="/index.html#directorio">Directorio</a> / <a href="/index.html#directorio">${
    b.categoria || "Categoría"
  }</a> / <span>${b.nombre}</span>
</nav>
<article class="detail detail--business">
  <div class="detail-grid">
    <div class="detail-main">
      <header class="detail-header">
        ${
          b.icono || b.logo || b.imagen
            ? `<img class="detail-icon" src="${
                b.icono || b.logo || b.imagen
              }" alt="${
                b.nombre
              }" width="72" height="72" loading="lazy" decoding="async">`
            : ""
        }
        <div>
          <h1 class="detail-title">${b.nombre}</h1>
          <div class="pill-cat">${b.categoria || "Negocio"}</div>
        </div>
      </header>
      ${b.descripcion ? `<p>${b.descripcion}</p>` : ""}
      <div class="detail-actions">
        <a class="btn-wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn-info" href="/index.html#directorio">Volver al directorio</a>
      </div>
      <h3 class="section-title">Detalles</h3>
      <dl class="detail-dl">${detailsRows}</dl>
    </div>
  </div>
</article>`;

  return baseHtml({
    title,
    description: desc,
    body,
    seoAfterMain: seoHtml,
    path: pagePath,
    extraHead,
    ogType: "business",
    image: b.icono || b.logo || b.imagen || undefined,
  });
}

function categoryIndexTemplate(catName, catSlug, items) {
  const title = `Directorio de ${catName} en Montería`;
  const desc = `Negocios de ${catName} en Montería: contactos, dirección y WhatsApp.`;
  const listHtml = items
    .map((b) => {
      let urlPath = `/directorio/${catSlug}/${slugify(b.nombre)}/`;
      if (b.url && typeof b.url === "string") {
        const idx = b.url.indexOf("directorio/");
        if (idx !== -1) {
          const rest = b.url.slice(idx + "directorio/".length);
          const parts = rest.split(/[\/#?]/).filter(Boolean);
          if (parts[0] && parts[1]) {
            urlPath = `/directorio/${slugify(parts[0])}/${slugify(parts[1])}/`;
          }
        }
      }
      return `<li><a href="${urlPath}">${b.nombre}</a>${
        b.direccion ? ` — <small>${b.direccion}</small>` : ""
      }</li>`;
    })
    .join("\n");

  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <span>${catName}</span>
</nav>
<section>
  <h1 class="section-title">${catName}</h1>
  <ul class="list-simple">
    ${listHtml}
  </ul>
  <p><a class="btn-info" href="/index.html#directorio">Volver al directorio</a></p>
</section>`;

  return baseHtml({
    title,
    description: desc,
    body,
    path: `/directorio/${catSlug}/`,
    ogType: "website",
  });
}

function directoryIndexTemplate(categories) {
  const title = `Directorio de categorías en Montería`;
  const desc = `Explora negocios por categoría en Montería: contacto, dirección y WhatsApp.`;
  const listHtml = categories
    .map((c) => {
      const href = `/directorio/${c.slug}/`;
      const icon = c.icono
        ? `<img src="${c.icono}" alt="${c.nombre}" width="28" height="28" loading="lazy" decoding="async" /> `
        : "";
      const count =
        typeof c.count === "number" ? ` <small>(${c.count})</small>` : "";
      return `<li class="cat-item">${icon}<a href="${href}">${c.nombre}</a>${count}</li>`;
    })
    .join("\n");

  const body = `
<nav class="breadcrumbs">
  <a href="/">Inicio</a> / <span>Directorio</span>
</nav>
<section>
  <h1 class="section-title">Directorio por categorías</h1>
  <ul class="list-simple cats">
    ${listHtml}
  </ul>
  <p><a class="btn-info" href="/index.html#directorio">Volver</a></p>
</section>`;

  return baseHtml({
    title,
    description: desc,
    body,
    path: `/directorio/`,
    ogType: "website",
  });
}

function productTemplate(p) {
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
    ? `<section class=\"seo-content container\">${mdToHtml(p.seo_md)}</section>`
    : "";

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
    url: `${SITE_URL}${pagePath}`,
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
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: SITE_URL + "/",
      },
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

  const wa =
    p.whatsapp ||
    `https://wa.me/573000000000?text=${encodeURIComponent(
      `Hola, me interesa el producto ${p.nombre}`
    )}`;

  const body = `
<nav class=\"breadcrumbs\">
  <a href=\"/\">Inicio</a> / <a href=\"/index.html#productos\">Productos</a> / <span>${
    p.nombre
  }</span>
</nav>
<article class=\"detail detail--product\"> 
  <div class=\"detail-grid\"> 
    <div class=\"detail-main\"> 
      <header class="detail-header"> 
        ${
          p.imagen
            ? `<img class="detail-icon" src="${p.imagen}" alt="${p.nombre}" width="72" height="72" loading="lazy" decoding="async">`
            : ""
        }
        <div>
          <h1 class=\"detail-title\">${p.nombre}</h1>
          <div class=\"pill-cat\">Producto</div>
        </div>
      </header>
      ${p.precio ? `<p class=\"price-lg\">${p.precio}</p>` : ""}
      ${p.descripcion ? `<p>${p.descripcion}</p>` : ""}
      <div class=\"detail-actions\"> 
        <a class=\"btn-wa\" href=\"${wa}\" target=\"_blank\" rel=\"noopener\">WhatsApp</a>
        <a class=\"btn-info\" href=\"/index.html#productos\">Volver a productos</a>
      </div>
      <h3 class=\"section-title\">Detalles</h3>
      <dl class=\"detail-dl\">${detailsRows}</dl>
    </div>
  </div>
</article>`;

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

function serviceTemplate(s) {
  const title = `${s.nombre} | Servicio en Montería`;
  const desc = `${s.nombre}. ${s.descripcion || ""}`;
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
    ? `<section class=\"seo-content container\">${mdToHtml(s.seo_md)}</section>`
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
    url: `${SITE_URL}${pagePath}`,
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
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: SITE_URL + "/",
      },
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

  const wa =
    s.whatsapp ||
    `https://wa.me/573000000000?text=${encodeURIComponent(
      `Hola, me interesa el servicio ${s.nombre}`
    )}`;

  const body = `
<nav class=\"breadcrumbs\">
  <a href=\"/\">Inicio</a> / <a href=\"/index.html#servicios\">Servicios</a> / <span>${
    s.nombre
  }</span>
</nav>
<article class=\"detail detail--service\"> 
  <div class=\"detail-grid\"> 
    <div class=\"detail-main\"> 
      <header class="detail-header"> 
        ${
          s.imagen
            ? `<img class="detail-icon" src="${s.imagen}" alt="${s.nombre}" width="72" height="72" loading="lazy" decoding="async">`
            : ""
        }
        <div>
          <h1 class=\"detail-title\">${s.nombre}</h1>
          <div class=\"pill-cat\">Servicio</div>
        </div>
      </header>
      ${s.precio ? `<p class=\"price-lg\">${s.precio}</p>` : ""}
      ${s.descripcion ? `<p>${s.descripcion}</p>` : ""}
      <div class=\"detail-actions\"> 
        <a class=\"btn-wa\" href=\"${wa}\" target=\"_blank\" rel=\"noopener\">WhatsApp</a>
        <a class=\"btn-info\" href=\"/index.html#servicios\">Volver a servicios</a>
      </div>
      <h3 class=\"section-title\">Detalles</h3>
      <dl class=\"detail-dl\">${detailsRows}</dl>
    </div>
  </div>
</article>`;

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
  const categorias = readJson("categorias.json");
  const urls = [`${SITE_URL}/`, `${SITE_URL}/index.html`];

  // Directorio por categoría (silo)
  const byCat = new Map();
  for (const b of negocios) {
    // Derivar cat/slug, respetando b.url si provee estructura
    let cat = slugify(b.categoria || "otros");
    let slug = slugify(b.nombre);
    if (b.url && typeof b.url === "string") {
      const idx = b.url.indexOf("directorio/");
      if (idx !== -1) {
        const rest = b.url.slice(idx + "directorio/".length);
        const parts = rest.split(/[\/#?]/).filter(Boolean);
        if (parts[0]) cat = slugify(parts[0]);
        if (parts[1]) slug = slugify(parts[1]);
      }
    }
    const dir = path.join(root, "directorio", cat, slug);
    const file = path.join(dir, "index.html");
    writeFileSafe(file, businessTemplate({ ...b, categoria: b.categoria }));
    urls.push(`${SITE_URL}/directorio/${cat}/${slug}/`);
    // Agrupar por categoría para crear índice
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(b);
  }

  // Índices por categoría
  for (const [catSlug, items] of byCat.entries()) {
    const catName = items[0]?.categoria || catSlug;
    const dir = path.join(root, "directorio", catSlug);
    writeFileSafe(
      path.join(dir, "index.html"),
      categoryIndexTemplate(catName, catSlug, items)
    );
    urls.push(`${SITE_URL}/directorio/${catSlug}/`);
  }

  // Índice general del directorio
  const counts = {};
  for (const [catSlug, items] of byCat.entries())
    counts[catSlug] = items.length;
  const catsForIndex = (
    Array.isArray(categorias) && categorias.length
      ? categorias.map((c) => ({
          nombre: c.nombre || c.name || "Otros",
          slug: c.slug
            ? slugify(c.slug)
            : slugify(c.nombre || c.name || "otros"),
          icono: c.icono || c.icon || undefined,
        }))
      : Array.from(byCat.keys()).map((slug) => ({ nombre: slug, slug }))
  ).map((c) => ({ ...c, count: counts[c.slug] || 0 }));
  const dirRoot = path.join(root, "directorio");
  writeFileSafe(
    path.join(dirRoot, "index.html"),
    directoryIndexTemplate(catsForIndex)
  );
  urls.push(`${SITE_URL}/directorio/`);

  // Productos
  for (const p of productos) {
    const slug = slugify(p.nombre);
    const dir = path.join(root, "productos", slug);
    const file = path.join(dir, "index.html");
    writeFileSafe(file, productTemplate(p));
    urls.push(`${SITE_URL}/productos/${slug}/`);
  }

  // Servicios (con posible slug en s.url)
  for (const s of servicios) {
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
    writeFileSafe(file, serviceTemplate(s));
    urls.push(`${SITE_URL}/servicios/${slug}/`);
  }

  // sitemap.xml
  const sitemap =
    `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
    `<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n` +
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
