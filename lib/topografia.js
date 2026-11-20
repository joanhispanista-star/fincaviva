// La geometría del escáner: pasar lo que entrega el celular (grados del GPS,
// rumbo de la brújula) a metros sobre el suelo de la finca, que es en lo que
// trabaja el mapa 3D (x hacia el este, z hacia el sur, origen en el punto donde
// se tocó «Estoy en la finca»).
//
// Todo aquí es cuenta pura, sin GPS ni pantalla: se prueba en Node con un
// recorrido inventado. Lo que mide de verdad vive en app/pantallas/escanear.js.
//
// Precisión honesta: el GPS de un celular acierta a unos 3 a 10 m con cielo
// abierto. Estas cuentas no lo mejoran; solo evitan empeorarlo (descartan
// lecturas malas y no dejan que el temblor de la señal dibuje un lindero de
// serrucho).

const RAD = Math.PI / 180

// Metros por grado cerca de una latitud (aproximación local: error menor de
// 0,5 % en 10 km, de sobra para una finca). La misma de herramientas/terreno.mjs.
export function metrosPorGrado(lat) {
  return { lat: 111132.92 - 559.82 * Math.cos(2 * lat * RAD), lon: 111412.84 * Math.cos(lat * RAD) }
}

// {lat, lon} → [x, z] en metros desde el origen. El norte queda en −z, como en el mapa.
export function aMetros(origen, p) {
  const m = metrosPorGrado(origen.lat)
  return [(p.lon - origen.lon) * m.lon, -(p.lat - origen.lat) * m.lat]
}

export function aGrados(origen, [x, z]) {
  const m = metrosPorGrado(origen.lat)
  return { lat: origen.lat - z / m.lat, lon: origen.lon + x / m.lon }
}

export function distanciaM(a, b) {
  const [x, z] = aMetros(a, b)
  return Math.hypot(x, z)
}

// Área de un polígono [[x, z], …] en m² (fórmula del agrimensor).
export function areaM2(pol) {
  let s = 0
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) s += pol[j][0] * pol[i][1] - pol[i][0] * pol[j][1]
  return Math.abs(s) / 2
}

export function perimetroM(pol) {
  let s = 0
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) s += Math.hypot(pol[i][0] - pol[j][0], pol[i][1] - pol[j][1])
  return s
}

// Centro de masa del polígono; si no tiene área (una línea), el promedio de sus puntos.
export function centroide(pol) {
  let a = 0, cx = 0, cz = 0
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const k = pol[j][0] * pol[i][1] - pol[i][0] * pol[j][1]
    a += k
    cx += (pol[j][0] + pol[i][0]) * k
    cz += (pol[j][1] + pol[i][1]) * k
  }
  if (Math.abs(a) < 1e-6) return pol.length ? [pol.reduce((s, p) => s + p[0], 0) / pol.length, pol.reduce((s, p) => s + p[1], 0) / pol.length] : [0, 0]
  return [cx / (3 * a), cz / (3 * a)]
}

// La hectárea la entiende el banco; la fanegada (6.400 m², un cuadro de 80 × 80 m)
// es la que se usa en la Sabana para hablar de tierra.
export const M2_POR_FANEGADA = 6400
export function medidas(area_m2) {
  return { m2: area_m2, hectareas: area_m2 / 10000, fanegadas: area_m2 / M2_POR_FANEGADA }
}

// ---------- Lecturas del GPS ----------

// ¿Sirve esta lectura para el lindero? Se descarta la imprecisa y la que casi
// no se movió: quieto, el GPS sigue bailando unos metros, y ese baile dibujado
// suma perímetro y área que no existen.
export function aceptarPunto(ultimo, nuevo, { precisionMax = 20, pasoMin = 4 } = {}) {
  if (!(nuevo.precision <= precisionMax)) return { ok: false, motivo: 'imprecisa' }
  if (!ultimo) return { ok: true }
  const paso = Math.max(pasoMin, 0.6 * Math.max(nuevo.precision, ultimo.precision || 0))
  return distanciaM(ultimo, nuevo) >= paso ? { ok: true } : { ok: false, motivo: 'quieto' }
}

// Para marcar un sitio se juntan las lecturas de unos segundos: las mejores
// pesan más (1 / precisión²) y las que doblan a la mejor no cuentan.
export function mejorLectura(lecturas) {
  const validas = lecturas.filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lon) && l.precision > 0)
  if (!validas.length) return null
  const mejor = Math.min(...validas.map((l) => l.precision))
  const buenas = validas.filter((l) => l.precision <= mejor * 2)
  let w = 0, lat = 0, lon = 0, alt = 0, wAlt = 0
  for (const l of buenas) {
    const p = 1 / (l.precision * l.precision)
    w += p
    lat += l.lat * p
    lon += l.lon * p
    if (Number.isFinite(l.alt)) { alt += l.alt * p; wAlt += p }
  }
  return { lat: lat / w, lon: lon / w, alt: wAlt ? alt / wAlt : null, precision: mejor, lecturas: buenas.length }
}

// Quita los puntos que no cambian la forma (Douglas-Peucker). `tolerancia` en
// metros: lo que se desvíe menos que eso de la línea recta se considera temblor.
function simplificarLinea(pts, tolerancia) {
  if (pts.length < 3) return pts.slice()
  const [ax, az] = pts[0], [bx, bz] = pts[pts.length - 1]
  const l2 = (bx - ax) ** 2 + (bz - az) ** 2
  let peor = -1, iPeor = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, z] = pts[i]
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2)) : 0
    const d = Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az)))
    if (d > peor) { peor = d; iPeor = i }
  }
  if (peor <= tolerancia) return [pts[0], pts[pts.length - 1]]
  return [...simplificarLinea(pts.slice(0, iPeor + 1), tolerancia).slice(0, -1), ...simplificarLinea(pts.slice(iPeor), tolerancia)]
}

// Lo mismo para un lindero cerrado: se parte en el punto más lejano del primero
// y se simplifica cada mitad, para que el cierre no se trague una esquina.
export function simplificar(pol, tolerancia = 2) {
  if (pol.length < 4) return pol.slice()
  let lejos = 0, dMax = -1
  for (let i = 1; i < pol.length; i++) {
    const d = Math.hypot(pol[i][0] - pol[0][0], pol[i][1] - pol[0][1])
    if (d > dMax) { dMax = d; lejos = i }
  }
  const ida = simplificarLinea(pol.slice(0, lejos + 1), tolerancia)
  const vuelta = simplificarLinea([...pol.slice(lejos), pol[0]], tolerancia)
  return [...ida.slice(0, -1), ...vuelta.slice(0, -1)]
}

// Resumen de un lindero caminado: [{lat, lon, precision}] → polígono en metros y sus medidas.
export function resumenLindero(origen, puntos, { tolerancia = 2 } = {}) {
  const crudo = puntos.map((p) => aMetros(origen, p))
  const pol = simplificar(crudo, tolerancia)
  const precisiones = puntos.map((p) => p.precision).filter((x) => x > 0).sort((a, b) => a - b)
  const area = pol.length >= 3 ? areaM2(pol) : 0
  return {
    poligono: pol,
    area_m2: area,
    perimetro_m: pol.length >= 2 ? perimetroM(pol) : 0,
    ...medidas(area),
    // La mediana: una sola lectura mala bajo un árbol no debe asustar ni esconderse.
    precision_m: precisiones.length ? precisiones[Math.floor(precisiones.length / 2)] : null,
    puntos: pol.length,
  }
}

// ---------- Brújula ----------

// Rumbo en grados (0 = norte, 90 = este) hacia donde mira la cámara de atrás.
// iPhone lo entrega hecho (webkitCompassHeading). Android entrega los tres
// ángulos del aparato y hay que proyectar el eje de la cámara sobre el suelo
// (la cuenta es la del ejemplo de la especificación de DeviceOrientation).
// Devuelve null si el aparato no sabe dónde queda el norte.
export function rumboBrujula(ev) {
  if (!ev) return null
  if (typeof ev.webkitCompassHeading === 'number' && ev.webkitCompassHeading >= 0) return ev.webkitCompassHeading >= 360 ? ev.webkitCompassHeading % 360 : ev.webkitCompassHeading
  if (ev.absolute !== true || ev.alpha == null) return null
  const x = (ev.beta || 0) * RAD, y = (ev.gamma || 0) * RAD, z = ev.alpha * RAD
  const cX = Math.cos(x), cY = Math.cos(y), cZ = Math.cos(z), sX = Math.sin(x), sY = Math.sin(y), sZ = Math.sin(z)
  const vx = -cZ * sY - sZ * sX * cY
  const vy = -sZ * sY + cZ * sX * cY
  if (Math.abs(vx) < 1e-9 && Math.abs(vy) < 1e-9) return null // mirando recto al suelo o al cielo: no hay rumbo
  return ((Math.atan2(vx, vy) / RAD) % 360 + 360) % 360
}

const VIENTOS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
export const nombreRumbo = (g) => VIENTOS[Math.round((((g % 360) + 360) % 360) / 45) % 8]

// En cuál de las `n` tajadas de la vuelta cae un rumbo (la 0 está centrada en el norte).
export const sectorDe = (rumbo, n = 12) => Math.round((((rumbo % 360) + 360) % 360) / (360 / n)) % n

// Giro del modelo 3D para que su frente mire hacia un rumbo. Los modelos tienen
// la puerta hacia +z (el sur del mapa) y three.js gira +z hacia +x.
export const giroParaRumbo = (rumbo) => Math.PI - rumbo * RAD

// ---------- De lo escaneado al mapa ----------

// Qué se puede marcar y con qué modelo del mapa se dibuja. `sistema` es el tipo
// de sistema de la app que lleva sus cuentas (ver TIPOS_SISTEMA).
export const CLASES_SITIO = {
  casa: { nombre: 'Casa', emoji: '🏡', modelo: 'casa' },
  gallinero: { nombre: 'Gallinero', emoji: '🐔', modelo: 'galpon', sistema: 'gallinas' },
  huerta: { nombre: 'Huerta', emoji: '🥬', modelo: 'huerta', sistema: 'cultivo' },
  potrero: { nombre: 'Potrero', emoji: '🐄', modelo: 'potrero', sistema: 'ganado' },
  lombricultivo: { nombre: 'Lombricultivo', emoji: '🪱', modelo: 'lombricultivo', sistema: 'lombricultura' },
  compostera: { nombre: 'Compostera', emoji: '♻️', modelo: 'compostera', sistema: 'compost' },
  agua: { nombre: 'Agua (nacimiento, quebrada, reservorio)', emoji: '💧', modelo: 'agua', sistema: 'agua' },
  tanque: { nombre: 'Tanque', emoji: '🛢️', modelo: 'tanque', sistema: 'agua' },
  panel: { nombre: 'Panel solar', emoji: '☀️', modelo: 'panel', sistema: 'energia' },
  bosque: { nombre: 'Bosque', emoji: '🌳', modelo: 'bosque', sistema: 'bosque' },
  frutales: { nombre: 'Frutales', emoji: '🍊', modelo: 'frutales', sistema: 'cultivo' },
  invernadero: { nombre: 'Invernadero', emoji: '🏗️', modelo: 'invernadero', sistema: 'cultivo' },
  otro: { nombre: 'Otro sitio', emoji: '📍', modelo: 'marca' },
  panoramica: { nombre: 'Panorámica', emoji: '📷', modelo: 'panoramica' },
}

// Convierte el terreno escaneado y los sitios marcados en la «finca» que
// dibuja mapa/mundo.js. Sin lindero caminado se pone un cuadro provisional
// alrededor de lo marcado, y `linderoProvisional` lo avisa.
export function armarFinca(terreno, sitios = []) {
  const origen = terreno.origen
  const objetos = sitios
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon) && CLASES_SITIO[s.clase])
    .map((s) => {
      const [x, z] = aMetros(origen, s)
      const c = CLASES_SITIO[s.clase]
      return { id: s.id, clase: s.clase, tipo: c.modelo, x, z, rot: s.rumbo == null ? 0 : giroParaRumbo(s.rumbo), plan: !!s.plan, nombre: s.nombre || c.nombre, emoji: c.emoji }
    })
  let lindero = terreno.lindero?.puntos?.length >= 3 ? simplificar(terreno.lindero.puntos.map(([lat, lon]) => aMetros(origen, { lat, lon })), 2) : null
  const linderoProvisional = !lindero
  if (!lindero) {
    const xs = [0, ...objetos.map((o) => o.x)], zs = [0, ...objetos.map((o) => o.z)]
    const m = 45
    const x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m, z0 = Math.min(...zs) - m, z1 = Math.max(...zs) + m
    lindero = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
  }
  return { giro: 0, lindero, linderoProvisional, objetos, centroVista: centroide(lindero), escaneada: true }
}
