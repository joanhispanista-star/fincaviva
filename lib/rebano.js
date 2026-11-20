// El rebaño del mapa: cuántas vacas se dibujan, en cuál potrero, y cómo se
// mueven dentro de él.
//
// Todo aquí es cuenta pura, sin three.js ni pantalla, para probarlo en Node: lo
// que importa (que no se dibujen vacas que el libro no tiene, que no salgan dos
// veces y que ninguna se salga del cerco) no depende de cómo se pinten.
//
// Las vacas se mueven en los ejes propios del potrero: `u` a lo ancho y `w` a lo
// hondo, en metros desde su centro. mapa/vida.js las pasa al mundo y a la ladera.

// ---------- Cuántas y dónde ----------

// Cada vaca dibujada necesita unos 26 m² para caminar sin montarse en otra. El
// potrero del mapa mide lo que se dibuja (26 × 18 m), no lo que mide el de
// verdad: un hato grande no cabe, y entonces se dibujan menos y la ficha lo dice.
export const M2_POR_VACA_DIBUJADA = 26
export const cupoDeDibujo = (ancho = 26, fondo = 18) => Math.max(1, Math.floor((ancho * fondo) / M2_POR_VACA_DIBUJADA))

// Los animales del libro (el «tamaño» de los sistemas de tipo ganado) y el
// potrero donde se dibujan. La app no sabe en qué potrero están hoy: van todos
// al primero que ya existe, y los demás quedan vacíos. Así nunca salen dos veces.
// `potreros`: [{ id, plan, ancho?, fondo? }] en el orden en que se marcaron.
export function ganadoDelMapa(sistemas, potreros) {
  const hatos = sistemas.filter((s) => s.tipo === 'ganado' && !s.archivado)
  const animales = hatos.reduce((n, s) => n + Math.max(0, Math.round(Number(s.tamano) || 0)), 0)
  const reales = potreros.filter((p) => !p.plan)
  const potrero = animales > 0 && reales.length ? reales[0] : null
  return {
    hatos: hatos.length,
    nombre: hatos[0]?.nombre || null,
    animales,
    potrero: potrero ? potrero.id : null,
    dibujadas: potrero ? Math.min(animales, cupoDeDibujo(potrero.ancho, potrero.fondo)) : 0,
    otrosPotreros: Math.max(0, reales.length - 1),
  }
}

// ---------- Cómo se mueven ----------

// Azar con semilla (mulberry32): el mismo rebaño hace lo mismo cada vez, y una
// prueba que falla se puede repetir.
export function crearAzar(semilla = 1) {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const MARGEN = 1.8 // del centro de la vaca al cerco: media vaca y un poco más
export const SEPARACION = 2.8 // entre dos vacas, de centro a centro
const RADIO_BANDERIN = 4 // el poste que marca el potrero está en el centro; una vaca dibujada mide 3 m de largo
// Hasta dónde llega el centro de una vaca (lu, lw) y cuánto se aparta del
// banderín. En un potrero pequeño el radio se encoge: si no, no quedaría pasto.
function cancha(ancho, fondo) {
  const lu = Math.max(0.1, ancho / 2 - MARGEN), lw = Math.max(0.1, fondo / 2 - MARGEN)
  return { lu, lw, radio: Math.min(RADIO_BANDERIN, 0.5 * Math.min(lu, lw)) }
}
const VELOCIDAD = { pastar: 0.07, caminar: 0.5, parada: 0 } // m/s: una vaca pastando apenas avanza
const GIRO = 0.8 // rad/s: una vaca no voltea en seco
const ZANCADA = 1.5 // metros por ciclo de patas

const sujetar = (x, a, b) => Math.max(a, Math.min(b, x))
const diferencia = (a) => Math.atan2(Math.sin(a), Math.cos(a)) // ángulo llevado a −π…π

// `n` vacas repartidas en una rejilla desordenada: ninguna nace encima de otra
// ni del banderín.
export function crearRebano(n, { ancho = 26, fondo = 18, semilla = 7 } = {}) {
  const azar = crearAzar(semilla)
  const { lu, lw, radio } = cancha(ancho, fondo)
  // La rejilla se afina hasta que haya puesto para todas por fuera del banderín.
  let columnas = Math.max(1, Math.ceil(Math.sqrt((n * lu) / lw))), filas = 1, puestos = []
  for (; ; columnas++) {
    filas = Math.max(1, Math.round((columnas * lw) / lu))
    puestos = []
    for (let j = 0; j < filas; j++)
      for (let i = 0; i < columnas; i++) {
        const u = -lu + ((i + 0.5) * 2 * lu) / columnas, w = -lw + ((j + 0.5) * 2 * lw) / filas
        if (Math.hypot(u, w) >= radio + 0.4) puestos.push([u, w])
      }
    if (puestos.length >= n || columnas > 40) break
  }
  const cu = (2 * lu) / columnas, cw = (2 * lw) / filas
  const vacas = []
  for (let i = 0; i < n; i++) {
    // Repartidas por todo el potrero, no amontonadas en las primeras filas.
    const [u0, w0] = puestos[Math.floor((i * puestos.length) / n)] || [0, 0]
    const u = u0 + (azar() - 0.5) * 0.3 * cu, w = w0 + (azar() - 0.5) * 0.3 * cw
    const rumbo = azar() * 6.283
    vacas.push({
      u: sujetar(u, -lu, lu), w: sujetar(w, -lw, lw), rumbo, rumboMeta: rumbo,
      estado: azar() < 0.6 ? 'pastar' : 'parada', reloj: azar() * 8,
      cabeza: 0, // 0 = cabeza arriba, 1 = en el pasto
      marcha: 0, // 0 = patas quietas, 1 = caminando
      paso: azar() * 6.283, // fase del ciclo de las patas
      pinta: i, // qué colores le tocan (lo decide quien dibuja)
    })
  }
  return vacas
}

function decidir(v, azar, lu, lw) {
  const r = azar()
  if (r < 0.5) { v.estado = 'pastar'; v.reloj = 7 + azar() * 14 }
  else if (r < 0.78) { v.estado = 'caminar'; v.reloj = 3 + azar() * 6 }
  else { v.estado = 'parada'; v.reloj = 3 + azar() * 6 }
  if (v.estado === 'parada') return
  // Caminando escoge un rumbo nuevo; pastando apenas se desvía.
  v.rumboMeta = v.rumbo + (azar() - 0.5) * (v.estado === 'caminar' ? 2.6 : 1)
  // Cerca del cerco se devuelve hacia adentro.
  if (Math.abs(v.u) > lu - 1.5 || Math.abs(v.w) > lw - 1.5) v.rumboMeta = Math.atan2(-v.w, -v.u) + (azar() - 0.5) * 1.2
}

// ¿Puede dar ese paso? No sale del cerco, no atropella el banderín ni a otra
// vaca. Alejarse siempre se puede: si no, dos que nacieron cerca quedarían
// trabadas para siempre.
function libre(v, nu, nw, vacas, { lu, lw, radio }) {
  if (Math.abs(nu) > lu || Math.abs(nw) > lw) return false
  const rn = Math.hypot(nu, nw)
  if (rn < radio && rn < Math.hypot(v.u, v.w)) return false
  for (const o of vacas) {
    if (o === v) continue
    const dn = (nu - o.u) ** 2 + (nw - o.w) ** 2
    if (dn < SEPARACION * SEPARACION && dn < (v.u - o.u) ** 2 + (v.w - o.w) ** 2) return false
  }
  return true
}

// Avanza el rebaño `dt` segundos. Caminan despacio, se paran y pastan.
export function avanzarRebano(vacas, dt, { ancho = 26, fondo = 18, azar }) {
  const limites = cancha(ancho, fondo)
  const { lu, lw } = limites
  for (const v of vacas) {
    v.reloj -= dt
    if (v.reloj <= 0) decidir(v, azar, lu, lw)
    const falta = diferencia(v.rumboMeta - v.rumbo)
    const giro = sujetar(falta, -GIRO * dt, GIRO * dt)
    v.rumbo += giro
    // Mientras voltea camina más despacio: no describe un círculo enorme.
    const vel = VELOCIDAD[v.estado] * (Math.abs(falta) > 0.6 ? 0.4 : 1)
    let avanzo = 0
    if (vel > 0) {
      const nu = v.u + Math.cos(v.rumbo) * vel * dt, nw = v.w + Math.sin(v.rumbo) * vel * dt
      if (libre(v, nu, nw, vacas, limites)) {
        v.u = nu
        v.w = nw
        avanzo = vel * dt
      } else {
        // Topó con algo: se queda quieta un momento y después busca hacia adentro.
        v.estado = 'parada'
        v.reloj = 1 + azar() * 2
        v.rumboMeta = Math.atan2(-v.w, -v.u) + (azar() - 0.5) * 1.6
      }
    }
    // Las patas se mueven al avanzar y también al voltear en el puesto.
    v.paso += ((avanzo + Math.abs(giro) * 0.35) * 6.283) / ZANCADA
    const marcha = avanzo > 0 ? (v.estado === 'caminar' ? 1 : 0.35) : Math.abs(giro) > 1e-5 ? 0.5 : 0
    v.marcha += (marcha - v.marcha) * Math.min(1, dt * 6)
    v.cabeza += ((v.estado === 'pastar' ? 1 : 0) - v.cabeza) * Math.min(1, dt * 2.2)
  }
}

// ---------- La bandada ----------

// Formación en V de `n` pájaros: cuánto va cada uno detrás y al lado del guía.
export function formacionEnV(n, { atras = 2.6, lado = 2 } = {}) {
  const puestos = []
  for (let k = 0; k < n; k++) {
    const fila = Math.ceil(k / 2)
    puestos.push({ atras: fila * atras, lado: (k % 2 ? 1 : -1) * fila * lado })
  }
  return puestos
}
