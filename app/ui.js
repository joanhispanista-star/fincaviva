// Ayudas de interfaz que usan todas las pantallas.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const finito = (n) => typeof n === 'number' && Number.isFinite(n)

export const pesos = (n) => (finito(n) ? (n < 0 ? '−' : '') + '$ ' + Math.round(Math.abs(n)).toLocaleString('es-CO') : '—')
export const numero = (n, dec = 0) => (finito(n) ? n.toLocaleString('es-CO', { maximumFractionDigits: dec }) : '—')
export const porcentaje = (f, dec = 0) => (finito(f) ? (f * 100).toLocaleString('es-CO', { maximumFractionDigits: dec }) + ' %' : '—')

// Lee un número como lo escribe una persona en Colombia: «1.500» son mil
// quinientos y «2,5» es dos y medio. Con `entero` (plata) se ignoran puntos y comas.
export function leerNumero(texto, { entero = false } = {}) {
  let t = String(texto ?? '').trim().replace(/\s|\$/g, '')
  if (!t) return null
  if (entero) t = t.replace(/[.,]/g, '')
  else if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function cabeza(titulo, { atras = true, derecha = '' } = {}) {
  return `<header class="cabeza">${atras ? '<button class="atras" data-atras aria-label="Volver">‹</button>' : ''}<h1>${esc(titulo)}</h1>${derecha}</header>`
}

export function opciones(lista, valor) {
  return lista.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(valor ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('')
}

export function errores(lista) {
  if (!lista.length) return ''
  return `<div class="ob-error">No se pudo guardar:<ul>${lista.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`
}

let temporizador = null
export function avisar(texto, tipo = '') {
  let n = document.getElementById('aviso')
  if (!n) {
    n = document.createElement('div')
    n.id = 'aviso'
    n.setAttribute('role', 'status')
    document.body.appendChild(n)
  }
  n.textContent = texto
  n.className = 'ver ' + tipo
  clearTimeout(temporizador)
  temporizador = setTimeout(() => (n.className = tipo), 2600)
}

export function celebrar(emoji, titulo, texto) {
  const v = document.createElement('div')
  v.className = 'velo'
  v.innerHTML = `<div class="celebra"><div class="grande">${emoji}</div><h2>${esc(titulo)}</h2><p class="suave">${esc(texto)}</p><button class="btn ancho">¡Vamos!</button></div>`
  v.addEventListener('click', (e) => { if (e.target === v || e.target.closest('button')) v.remove() })
  document.body.appendChild(v)
}

// Enlaces de la pantalla: data-ir="ruta" navega, data-atras vuelve.
const enlazados = new WeakSet()
export function enlazar(raiz, ctx) {
  // Cada pantalla llama aquí con #app, que vive toda la sesión: sin esta guarda
  // quedaba un oyente por pantalla pintada y «atrás» retrocedía una vez por cada
  // una (cinco pantallas visitadas, cinco pasos atrás de un toque).
  if (enlazados.has(raiz)) return
  enlazados.add(raiz)
  raiz.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir]')
    if (ir) { e.preventDefault(); ctx.ir(ir.dataset.ir); return }
    if (e.target.closest('[data-atras]')) { e.preventDefault(); ctx.atras() }
  })
}

// Descarga un texto como archivo (respaldo). En iPhone abre la hoja de compartir.
export function descargar(nombre, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function nombreProducto(p) {
  const fijos = { 'huevo-azul': 'Huevo azul', 'huevo-verde': 'Huevo verde', 'huevo-marron': 'Huevo marrón', 'huevo-crema': 'Huevo crema', gallinaza: 'Gallinaza', humus: 'Humus', lombriz: 'Lombriz', compost: 'Compost', bocashi: 'Bocashi', biol: 'Biol' }
  return fijos[p] || (p ? p.charAt(0).toUpperCase() + p.slice(1) : '')
}
