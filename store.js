// Sencillo almacenamiento en localStorage para productos y servicios
const STORAGE_KEYS = {
  productos: "mv_productos",
  servicios: "mv_servicios",
};

function loadCollection(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("Error leyendo", key, e);
    return fallback;
  }
}

function saveCollection(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Error guardando", key, e);
  }
}

export function getProductos() {
  return loadCollection(STORAGE_KEYS.productos);
}
export function getServicios() {
  return loadCollection(STORAGE_KEYS.servicios);
}
export function upsertProducto(p) {
  const items = getProductos();
  const idx = items.findIndex((x) => x.id === p.id);
  if (idx >= 0) items[idx] = p;
  else items.push(p);
  saveCollection(STORAGE_KEYS.productos, items);
  return p;
}
export function upsertServicio(s) {
  const items = getServicios();
  const idx = items.findIndex((x) => x.id === s.id);
  if (idx >= 0) items[idx] = s;
  else items.push(s);
  saveCollection(STORAGE_KEYS.servicios, items);
  return s;
}
export function removeProducto(id) {
  const items = getProductos().filter((x) => x.id !== id);
  saveCollection(STORAGE_KEYS.productos, items);
}
export function removeServicio(id) {
  const items = getServicios().filter((x) => x.id !== id);
  saveCollection(STORAGE_KEYS.servicios, items);
}
