// El mundo 3D de la finca: relieve real, cielo, sol a la hora de verdad, bosque,
// y lo que hay (o se planea) en la finca. Un mismo motor dibuja tres estilos
// para que el dueño escoja: «juguete» (paisaje abierto en baja poligonización),
// «diorama» (la finca como una ficha de juego de mesa) y «satélite» (la foto real
// sobre el relieve).
//
// Escala: 1 unidad = 1 metro. x hacia el este, z hacia el sur, y hacia arriba,
// origen en el centro de la finca a la altura del suelo ahí.

import * as THREE from '../vendor/three/three.module.js'
import { cargarRelieve, crearRelieve } from './relieve.js'
import * as M from './modelos.js'
import { Controles } from './controles.js'
import { crearVida } from './vida.js'

export const ESTILOS = {
  // escalaEdificios: en los estilos de juego las construcciones se agrandan un
  // poco (como en todo juego de granja) para que se lean desde lejos; las
  // distancias entre ellas siguen siendo las reales.
  juguete: {
    nombre: 'Juguete', paisaje: true, diorama: false, satelite: false, escalaAnimales: 2.2, escalaArboles: 1.15, escalaEdificios: 1.6,
    cielo: ['#2f8fd8', '#cdeefc'], niebla: [700, 11000], exposicion: 1.08, fov: 40, hora: 9.3,
    camara: { distancia: 105, azimut: 2.34, azimutVertical: 3.0, elevacion: 0.45 }, nubes: 16, marDeNubes: true,
  },
  diorama: {
    nombre: 'Diorama', paisaje: false, diorama: true, satelite: false, lado: 240, escalaAnimales: 2.6, escalaArboles: 1.1, escalaEdificios: 1.35,
    cielo: null, niebla: null, exposicion: 1.05, fov: 26, hora: 15.4,
    camara: { distancia: 600, azimut: -0.8, elevacion: 0.6 }, nubes: 0, marDeNubes: false,
  },
  // APAGADO desde el 18-nov-2026: ni Ajustes lo ofrece ni finca.js lo pide. Las
  // fotos son de Esri World Imagery, y sus términos (resumen del 21-abr-2025)
  // exigen usarlas con software de Esri o con suscripción, y prohíben cosechar o
  // alojar las teselas aparte. Para prenderlo hay que escoger otra imagen o una
  // cuenta con llave: las opciones, con su licencia, están en
  // datos/fuentes-mapa.json («imagenes»), y su atribución va en el HUD de finca.js.
  realista: {
    nombre: 'Satélite', paisaje: true, diorama: false, satelite: true, escalaAnimales: 1.4, escalaArboles: 1, escalaEdificios: 1,
    cielo: ['#5d9fd3', '#dde8ee'], niebla: [500, 9000], exposicion: 1.0, fov: 44, hora: 9.3,
    camara: { distancia: 105, azimut: 2.34, azimutVertical: 3.0, elevacion: 0.45 }, nubes: 8, marDeNubes: true,
  },
}

// La finca de ejemplo: así se vería con el plan del año 1. Se diseña como si
// la ladera bajara hacia el occidente (x negativo) y después se gira `giro`
// grados para que coincida con la ladera real: la del ejemplo baja hacia el
// suroccidente (220°), así que se gira −50°. Las camas de la huerta quedan
// siempre sobre la curva de nivel.
export const FINCA_EJEMPLO = {
  nombre: 'Finca de ejemplo',
  giro: -50,
  centroVista: [28, -4],
  lindero: [[-95, -75], [95, -75], [95, 75], [-95, 75]],
  objetos: [
    { id: 'casa', tipo: 'casa', x: 54, z: -6, rot: -Math.PI / 2, etiqueta: '🏡 Casa' },
    { id: 'tanque', tipo: 'tanque', x: 60, z: 6, etiqueta: '💧 Tanque 1.000 L' },
    { id: 'galpon', tipo: 'galpon', x: 22, z: -36, etiqueta: '🐔 Gallinero · 30 aves' },
    { id: 'parque', tipo: 'parque', x: 22, z: -27.5, ancho: 16, fondo: 12, gallinas: 30 },
    { id: 'panel', tipo: 'panel', x: 35, z: -38, etiqueta: '☀️ Panel 600 W' },
    { id: 'huerta', tipo: 'huerta', x: 24, z: 24, camas: ['hoja', 'repollo', 'maiz', 'arveja', 'hoja', 'repollo'], etiqueta: '🥬 Huerta · 6 camas' },
    { id: 'compost', tipo: 'compostera', x: 8, z: 4, etiqueta: '♻️ Compostera' },
    { id: 'lombriz', tipo: 'lombricultivo', x: -2, z: 12, etiqueta: '🪱 Lombricultivo' },
    { id: 'frutales', tipo: 'frutales', x: -38, z: 34, filas: 4, columnas: 6, etiqueta: '🍊 Frutales' },
    { id: 'bosque', tipo: 'bosque', x: -68, z: -44, radio: 30, etiqueta: '🌳 Bosque nativo' },
    { id: 'invernadero', tipo: 'invernadero', x: -10, z: 46, plan: true, etiqueta: '🏗️ Invernadero · plan' },
    { id: 'reservorio', tipo: 'reservorio', x: -42, z: -6, plan: true, etiqueta: '💧 Reservorio · plan' },
    // Sale como «plan» hasta que exista un sistema Ganado; entonces lleva sus vacas (finca.js).
    { id: 'potrero', tipo: 'potrero', x: -14, z: -44, plan: true, etiqueta: '🐄 Potrero · plan' },
  ],
  camino: [[95, 1], [76, 0], [62, -1], [46, -12], [32, -28]],
}

// ---------- Ruido y azar con semilla (el mismo mapa cada vez) ----------
function hash2(i, j) {
  let h = (i * 374761393 + j * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function ruido(x, z, escala) {
  const gx = x / escala, gz = z / escala
  const i = Math.floor(gx), j = Math.floor(gz)
  const fx = gx - i, fz = gz - j
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}
// Parches tipo potrero (celdas de Voronoi): el «tablero» de la Sabana visto desde arriba.
function parche(x, z, tam) {
  const i = Math.floor(x / tam), j = Math.floor(z / tam)
  let mejor = 1e18, id = 0
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      const ci = i + di, cj = j + dj
      const cx = (ci + hash2(ci, cj * 7 + 3)) * tam, cz = (cj + hash2(ci * 5 + 1, cj)) * tam
      const d = (x - cx) ** 2 + (z - cz) ** 2
      if (d < mejor) {
        mejor = d
        id = hash2(ci * 13 + 7, cj * 11 + 5)
      }
    }
  return id
}

const COL = Object.fromEntries(
  Object.entries({
    p1: '#94c95a', p2: '#80b84d', p3: '#a9c95f', p4: '#6ca645', seco: '#c4c56c', arado: '#a8794d', tierra: '#8c6340',
    roca: '#8e887b', paramo: '#aaa56d', bosque: '#4b8439', bosqueOsc: '#3d7232', valle: '#79b553', finca: '#8fd05a', camino: '#b38c5b',
  }).map(([k, v]) => [k, new THREE.Color(v)])
)
const _c = new THREE.Color()

function puntoEnPoligono(x, z, pol) {
  let dentro = false
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, zi] = pol[i], [xj, zj] = pol[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro
  }
  return dentro
}
function distanciaBorde(x, z, pol) {
  let d = Infinity
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [ax, az] = pol[j], [bx, bz] = pol[i]
    const l2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2))
    d = Math.min(d, Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))))
  }
  return d
}
// margen > 0 agranda el lindero; margen < 0 lo encoge (para no sembrar sobre la cerca).
function dentroLindero(x, z, lindero, margen = 0) {
  const dentro = puntoEnPoligono(x, z, lindero)
  if (!margen) return dentro
  return margen > 0 ? dentro || distanciaBorde(x, z, lindero) < margen : dentro && distanciaBorde(x, z, lindero) > -margen
}

// Gira la finca diseñada «ladera hacia el occidente» para que calce con la ladera real.
// Encuadre inicial: dónde mirar y desde qué distancia para que el núcleo de la
// finca (lo construido, sin bosque, frutales ni planes) quepa a lo ancho de la
// pantalla. Sirve para cualquier finca, no solo la de ejemplo: cuando el campesino
// ponga la suya, la primera vista ya la muestra entera.
function encuadre(finca, azimut, aspecto, fovVertical) {
  const paisaje = ['bosque', 'frutales']
  let nucleo = finca.objetos.filter((o) => !o.plan && !paisaje.includes(o.tipo))
  // Una finca que apenas empieza (solo la casa) se encuadra con lo que planea
  // construir: si no, la primera vista sería un primer plano del techo.
  if (nucleo.length < 3) nucleo = finca.objetos.filter((o) => !paisaje.includes(o.tipo))
  if (!nucleo.length) return null
  const d = [-Math.sin(azimut), -Math.cos(azimut)] // hacia dónde mira la cámara, en (x, z)
  const der = [-d[1], d[0]] // la derecha de la pantalla, sobre el suelo
  let r0 = Infinity, r1 = -Infinity, p0 = Infinity, p1 = -Infinity
  for (const o of nucleo) {
    const r = o.x * der[0] + o.z * der[1], p = o.x * d[0] + o.z * d[1]
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); p0 = Math.min(p0, p); p1 = Math.max(p1, p)
  }
  const rc = (r0 + r1) / 2, pc = (p0 + p1) / 2
  const medioAncho = (r1 - r0) / 2 + 9 // margen: techos y letreros sobresalen del punto
  const tanH = Math.tan(((fovVertical * Math.PI) / 180) / 2) * aspecto
  return { objetivo: [rc * der[0] + pc * d[0], rc * der[1] + pc * d[1]], distancia: medioAncho / tanH }
}

function girarFinca(finca) {
  const g = ((finca.giro || 0) * Math.PI) / 180
  if (!g) return finca
  const c = Math.cos(g), s = Math.sin(g)
  const rot = ([x, z]) => [x * c - z * s, x * s + z * c]
  return {
    ...finca,
    lindero: finca.lindero.map(rot),
    camino: finca.camino?.map(rot),
    centroVista: finca.centroVista && rot(finca.centroVista),
    // En three.js girar el objeto `−g` en Y es lo mismo que girar sus coordenadas `g` en el plano.
    objetos: finca.objetos.map((o) => {
      const [x, z] = rot([o.x, o.z])
      return { ...o, x, z, rot: (o.rot || 0) - g }
    }),
  }
}

// ¿Hay bosque aquí? Cañadas empinadas y manchas: así se ve la cordillera alrededor de la Sabana.
function hayBosque(x, z, h, pend, finca) {
  if (dentroLindero(x, z, finca.lindero, 25)) return false
  return ruido(x + 913, z - 377, 260) > 0.6 || pend > 0.62 || (h < 2300 && ruido(x, z, 180) > 0.5)
}

function colorSuelo(x, z, h, pend, finca, estilo, nuevo = false) {
  if (estilo.satelite) return _c.setRGB(1, 1, 1)
  if (dentroLindero(x, z, finca.lindero)) {
    _c.copy(COL.finca).lerp(COL.p2, ruido(x, z, 18) * 0.35)
    // Gráficos nuevos: el potrero no es de un solo verde. Manchas más grandes
    // de pasto más oscuro y un grano fino, vértice a vértice.
    if (nuevo) _c.lerp(COL.p4, Math.max(0, ruido(x + 300, z - 120, 46) - 0.45) * 0.5).offsetHSL(0, 0, (hash2(Math.round(x), Math.round(z)) - 0.5) * 0.045)
    return _c
  }
  if (hayBosque(x, z, h, pend, finca)) return _c.copy(COL.bosque).lerp(COL.bosqueOsc, ruido(x, z, 40))
  const id = parche(x, z, 110)
  const base = id < 0.28 ? COL.p1 : id < 0.52 ? COL.p2 : id < 0.68 ? COL.p3 : id < 0.82 ? COL.p4 : id < 0.92 ? COL.seco : COL.arado
  _c.copy(base)
  if (h > 2780) _c.lerp(COL.paramo, Math.min(1, (h - 2780) / 150))
  if (h < 1900) _c.lerp(COL.valle, Math.min(1, (1900 - h) / 400))
  if (pend > 0.45) _c.lerp(pend > 0.9 ? COL.roca : COL.tierra, Math.min(0.75, (pend - 0.45) * 1.6))
  return _c.offsetHSL(0, 0, (ruido(x, z, 25) - 0.5) * 0.05)
}

// ---------- Mallas del relieve ----------
// Rejilla de `lado` metros con celdas de `paso`. Si hay `hueco`, no dibuja los
// cuadros que caen dentro (ahí va la malla más fina) y la baja un poco para que
// en el borde la fina quede encima sin parpadeo.
function mallaRelieve(rel, h0, { lado, paso, suave = false, hueco = 0, bajar = 0, colorDe, uvDe = null, facetas = false }) {
  const n = Math.round(lado / paso) + 1
  if (facetas) return mallaEnFacetas(rel, h0, { lado, paso, suave, bajar, colorDe, n })
  const pos = new Float32Array(n * n * 3)
  const col = new Float32Array(n * n * 3)
  const uv = uvDe ? new Float32Array(n * n * 2) : null
  const H = new Float32Array(n * n)
  for (let f = 0; f < n; f++)
    for (let c = 0; c < n; c++) {
      const x = -lado / 2 + c * paso, z = -lado / 2 + f * paso
      H[f * n + c] = suave ? rel.alturaSuave(x, z) : rel.alturaEn(x, z)
    }
  for (let f = 0; f < n; f++)
    for (let c = 0; c < n; c++) {
      const i = f * n + c
      const x = -lado / 2 + c * paso, z = -lado / 2 + f * paso
      const h = H[i]
      const gx = (H[f * n + Math.min(n - 1, c + 1)] - H[f * n + Math.max(0, c - 1)]) / (2 * paso)
      const gz = (H[Math.min(n - 1, f + 1) * n + c] - H[Math.max(0, f - 1) * n + c]) / (2 * paso)
      const pend = Math.hypot(gx, gz)
      // La malla de lejos baja más en su borde exterior: la curvatura de la
      // Tierra no se nota a 7 km, pero así el horizonte no corta en seco.
      pos.set([x, h - h0 - bajar, z], i * 3)
      const k = colorDe(x, z, h, pend)
      col.set([k.r, k.g, k.b], i * 3)
      if (uv) {
        const [u, v] = uvDe(x, z)
        uv[i * 2] = u
        uv[i * 2 + 1] = v
      }
    }
  const indices = []
  const lim = hueco / 2 - paso
  for (let f = 0; f < n - 1; f++)
    for (let c = 0; c < n - 1; c++) {
      if (hueco) {
        const x0 = -lado / 2 + c * paso, z0 = -lado / 2 + f * paso
        if (x0 >= -lim - paso && x0 + paso <= lim + paso && z0 >= -lim - paso && z0 + paso <= lim + paso) continue
      }
      const a = f * n + c, b = a + 1, d = a + n, e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

// Gráficos nuevos: el mismo relieve, pero cada triángulo de un solo color (el
// de su centro) y con un tono apenas distinto al del vecino. Con el color en los
// vértices, el borde entre un potrero y otro salía como una mancha borrosa en
// escalera; en facetas sale nítido, que es como se ve un paisaje de juguete.
// Cuesta memoria (cada triángulo lleva sus tres vértices), no triángulos.
function mallaEnFacetas(rel, h0, { lado, paso, suave, bajar, colorDe, n }) {
  const H = new Float32Array(n * n)
  for (let f = 0; f < n; f++)
    for (let c = 0; c < n; c++) H[f * n + c] = (suave ? rel.alturaSuave(-lado / 2 + c * paso, -lado / 2 + f * paso) : rel.alturaEn(-lado / 2 + c * paso, -lado / 2 + f * paso))
  const total = (n - 1) * (n - 1) * 2
  const pos = new Float32Array(total * 9), col = new Float32Array(total * 9)
  let o = 0
  const cara = (x1, z1, h1, x2, z2, h2, x3, z3, h3, semilla) => {
    // Pendiente de la cara: la de su plano.
    const ux = x2 - x1, uy = h2 - h1, uz = z2 - z1, vx = x3 - x1, vy = h3 - h1, vz = z3 - z1
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const k = colorDe((x1 + x2 + x3) / 3, (z1 + z2 + z3) / 3, (h1 + h2 + h3) / 3, Math.hypot(nx, nz) / (Math.abs(ny) || 1e-6))
    k.offsetHSL(0, 0, (semilla - 0.5) * 0.035)
    pos.set([x1, h1 - h0 - bajar, z1, x2, h2 - h0 - bajar, z2, x3, h3 - h0 - bajar, z3], o)
    col.set([k.r, k.g, k.b, k.r, k.g, k.b, k.r, k.g, k.b], o)
    o += 9
  }
  for (let f = 0; f < n - 1; f++)
    for (let c = 0; c < n - 1; c++) {
      const x0 = -lado / 2 + c * paso, z0 = -lado / 2 + f * paso, x1 = x0 + paso, z1 = z0 + paso
      const a = H[f * n + c], b = H[f * n + c + 1], d = H[(f + 1) * n + c], e = H[(f + 1) * n + c + 1]
      cara(x0, z0, a, x0, z1, d, x1, z0, b, hash2(c * 2, f))
      cara(x1, z0, b, x0, z1, d, x1, z1, e, hash2(c * 2 + 1, f))
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// Diorama: la finca recortada como ficha de juego, con las capas del suelo a los lados.
function mallaDiorama(rel, h0, lado, paso, colorDe) {
  const sup = mallaRelieve(rel, h0, { lado, paso, suave: true, colorDe })
  const pos = sup.attributes.position.array
  const n = Math.round(lado / paso) + 1
  let minY = Infinity
  for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i])
  const base = minY - 16
  const capas = [
    [0, new THREE.Color('#4a3020')], [1.2, new THREE.Color('#6e4a2e')], [5, new THREE.Color('#8b6544')],
    [9, new THREE.Color('#a08a6a')], [99, new THREE.Color('#7d776c')],
  ]
  const borde = []
  for (let c = 0; c < n; c++) borde.push(c)
  for (let f = 1; f < n; f++) borde.push(f * n + n - 1)
  for (let c = n - 2; c >= 0; c--) borde.push((n - 1) * n + c)
  for (let f = n - 2; f >= 0; f--) borde.push(f * n)
  const P = []
  const C = []
  // Cada lado de la falda se parte en franjas horizontales para pintar las capas del suelo.
  for (let k = 0; k < borde.length - 1; k++) {
    const a = borde[k], b = borde[k + 1]
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]
    const bx = pos[b * 3], by = pos[b * 3 + 1], bz = pos[b * 3 + 2]
    let profA = 0
    for (let li = 0; li < capas.length; li++) {
      const hasta = li < capas.length - 1 ? capas[li + 1][0] : 1e9
      const ya1 = ay - profA, yb1 = by - profA
      const ya2 = Math.max(base, ay - hasta), yb2 = Math.max(base, by - hasta)
      if (ya1 <= base && yb1 <= base) break
      P.push(ax, ya1, az, bx, yb1, bz, ax, ya2, az, bx, yb1, bz, bx, yb2, bz, ax, ya2, az)
      const col = capas[li][1]
      for (let v = 0; v < 6; v++) C.push(col.r, col.g, col.b)
      profA = hasta
    }
  }
  const falda = new THREE.BufferGeometry()
  falda.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  falda.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  falda.computeVertexNormals()
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(lado, 2, lado), new THREE.MeshLambertMaterial({ color: '#5f5a52' }))
  fondo.position.y = base - 1
  return { sup, falda, fondo, base }
}

// ---------- Satélite ----------
const MPG = (lat) => ({ lat: 111132.92 - 559.82 * Math.cos((2 * lat * Math.PI) / 180), lon: 111412.84 * Math.cos((lat * Math.PI) / 180) })
function mercator(lat, lon, z) {
  const n = 2 ** z * 256
  const r = (lat * Math.PI) / 180
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n }
}
// Arma una textura con los mosaicos de Esri World Imagery que cubren el cuadro.
// Necesita internet; si falla, el estilo se queda con el color plano. Solo la
// usa el estilo Satélite, que está apagado por la licencia (ver ESTILOS).
async function texturaSatelite(lat, lon, lado, zoom) {
  const m = MPG(lat)
  const esquina = (dx, dz) => mercator(lat - dz / m.lat, lon + dx / m.lon, zoom)
  const a = esquina(-lado / 2, -lado / 2), b = esquina(lado / 2, lado / 2)
  const tx0 = Math.floor(a.x / 256), ty0 = Math.floor(a.y / 256), tx1 = Math.floor(b.x / 256), ty1 = Math.floor(b.y / 256)
  const lienzo = document.createElement('canvas')
  lienzo.width = (tx1 - tx0 + 1) * 256
  lienzo.height = (ty1 - ty0 + 1) * 256
  const ctx = lienzo.getContext('2d')
  const cargas = []
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      cargas.push(
        new Promise((ok) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            ctx.drawImage(img, (tx - tx0) * 256, (ty - ty0) * 256)
            ok(true)
          }
          img.onerror = () => ok(false)
          img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`
        })
      )
    }
  const res = await Promise.all(cargas)
  const tex = new THREE.CanvasTexture(lienzo)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const uvDe = (x, z) => {
    const p = mercator(lat - z / m.lat, lon + x / m.lon, zoom)
    return [(p.x - tx0 * 256) / lienzo.width, 1 - (p.y - ty0 * 256) / lienzo.height]
  }
  return { tex, uvDe, cargados: res.filter(Boolean).length, total: res.length }
}

// ---------- Sol ----------
// Posición del sol para la latitud de la finca, el día del año y la hora de Colombia.
export function direccionSol(hora, diaDelAnio, lat = 4.68) {
  const φ = (lat * Math.PI) / 180
  const δ = ((-23.44 * Math.cos(((2 * Math.PI) / 365) * (diaDelAnio + 10))) * Math.PI) / 180
  const H = ((15 * (hora + 0.2 - 12)) * Math.PI) / 180 // +0,2 h: en nov. el sol va ~12 min adelantado al reloj
  const sinE = Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(H)
  const e = Math.asin(sinE)
  let A = Math.acos(THREE.MathUtils.clamp((Math.sin(δ) - sinE * Math.sin(φ)) / (Math.cos(e) * Math.cos(φ)), -1, 1))
  if (H > 0) A = 2 * Math.PI - A
  return { elevacion: e, vector: new THREE.Vector3(Math.cos(e) * Math.sin(A), Math.sin(e), -Math.cos(e) * Math.cos(A)) }
}

// ---------- El mundo ----------
export async function crearMundo(lienzo, op = {}) {
  const estilo = ESTILOS[op.estilo] || ESTILOS.juguete
  // Los gráficos nuevos (22-nov-2026) son solo del estilo Juguete, el único que
  // se mejora: pasto, flores y piedras, parches de tierra, modelos sombreados
  // por altura, sombras nítidas de cerca y una luz más cálida. Con
  // `graficos: 'clasico'` el mapa se dibuja como antes (para comparar, o para
  // devolverse si en el teléfono pesa).
  const nuevo = estilo === ESTILOS.juguete && op.graficos !== 'clasico'
  M.sombreadoPorAltura(nuevo)
  const base = op.base || './'
  const finca = girarFinca(op.finca || FINCA_EJEMPLO)
  const etiquetas = []
  const animables = []
  const tocables = []

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: !!estilo.diorama, powerPreference: 'high-performance' })
  // En iPhone se limita a 2x: con 3x la memoria de lienzo se dispara y Safari cierra la pestaña.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = estilo.exposicion
  const escena = new THREE.Scene()
  const camara = new THREE.PerspectiveCamera(estilo.fov, 1, 1, 40000)

  // El relieve llega de dos maneras: horneado en datos/ (el mapa de ejemplo) o
  // ya leído del teléfono (`op.relieveDatos`: la finca escaneada, ver
  // mapa/relieve-vivo.js).
  const rel = op.relieveDatos ? crearRelieve(op.relieveDatos.cerca.meta, op.relieveDatos.cerca.alturas) : await cargarRelieve(base, op.relieve || 'ejemplo')
  const h0 = rel.hCentro
  const suelo = (x, z) => rel.alturaSuave(x, z) - h0

  // Cielo y niebla. A 2.600 m la neblina es parte del paisaje: se nota.
  if (estilo.cielo) {
    const [arriba, horizonte] = estilo.cielo.map((c) => new THREE.Color(c))
    const cielo = new THREE.SphereGeometry(30000, 24, 12)
    const cc = []
    const p = cielo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getY(i) / 30000)
      const k = horizonte.clone().lerp(arriba, Math.pow(t, 0.6))
      cc.push(k.r, k.g, k.b)
    }
    cielo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3))
    // Gráficos nuevos: el cielo no pasa por la curva de tonos del resto de la
    // escena, que lo dejaba gris. Queda del azul que se escogió.
    escena.add(new THREE.Mesh(cielo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: !nuevo })))
    escena.fog = new THREE.Fog(horizonte, estilo.niebla[0], estilo.niebla[1])
  }

  // Luz: sol real a la hora pedida + luz de cielo.
  const hora = op.hora ?? estilo.hora
  const sol = direccionSol(hora, op.diaDelAnio ?? 322)
  // Gráficos nuevos: sol un poco más cálido y fuerte, y cielo más azul en lo
  // que queda a la sombra. Así los volúmenes se leen sin subir el brillo.
  const luzSol = new THREE.DirectionalLight(nuevo ? '#ffe9c4' : '#fff1d6', (2.4 * Math.max(0.15, Math.sin(Math.max(0.05, sol.elevacion))) + 0.6) * (nuevo ? 1.12 : 1))
  luzSol.position.copy(sol.vector).multiplyScalar(600)
  luzSol.castShadow = true
  luzSol.shadow.mapSize.set(2048, 2048)
  const sc = luzSol.shadow.camera
  sc.left = sc.bottom = -170
  sc.right = sc.top = 170
  sc.near = 10
  sc.far = 1600
  luzSol.shadow.bias = -0.0006
  luzSol.shadow.normalBias = nuevo ? 0.4 : 0.6
  escena.add(luzSol, luzSol.target)
  escena.add(nuevo ? new THREE.HemisphereLight('#bfdcff', '#7d6a42', 0.9) : new THREE.HemisphereLight('#cfe8ff', '#6b5a3c', estilo.diorama ? 1.15 : 1.0))

  // Materiales compartidos (antes del terreno: el bosque del terreno ya los usa).
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  const matPlan = new THREE.MeshBasicMaterial({ color: '#59c8ff', transparent: true, opacity: 0.32, depthWrite: false })
  const matPlanBorde = new THREE.LineBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.9 })
  const matSuelo = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !estilo.satelite })
  const colorDe = (x, z, h, pend) => colorSuelo(x, z, h, pend, finca, estilo, nuevo)
  const info = { estilo: op.estilo || 'juguete', graficos: nuevo ? 'nuevo' : 'clasico', satelite: null }

  if (estilo.diorama) {
    const d = mallaDiorama(rel, h0, estilo.lado, 4, colorDe)
    const sup = new THREE.Mesh(d.sup, matSuelo)
    sup.receiveShadow = true
    escena.add(sup, new THREE.Mesh(d.falda, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), d.fondo)
    tocables.push(sup)
    // En la ficha también hay vecinos: árboles sueltos fuera del lindero.
    bosqueCercano(escena, rel, h0, finca, estilo, estilo.lado / 2 - 6, 0.5)
  } else {
    const cerca = { lado: 1200, paso: 6 }
    let matCerca = matSuelo, uvDe = null
    if (estilo.satelite) {
      try {
        const sat = await texturaSatelite(rel.meta.lat, rel.meta.lon, cerca.lado, 17)
        info.satelite = `${sat.cargados}/${sat.total} mosaicos`
        matCerca = new THREE.MeshLambertMaterial({ map: sat.tex })
        uvDe = sat.uvDe
      } catch (e) {
        info.satelite = 'sin conexión: ' + e.message
      }
    }
    const gCerca = mallaRelieve(rel, h0, { ...cerca, suave: true, colorDe, uvDe, facetas: nuevo })
    const mCerca = new THREE.Mesh(gCerca, matCerca)
    mCerca.receiveShadow = true
    escena.add(mCerca)
    tocables.push(mCerca)
    let matMedia = matSuelo
    let uvMedia = null
    if (estilo.satelite) {
      try {
        const sat = await texturaSatelite(rel.meta.lat, rel.meta.lon, rel.lado, 15)
        matMedia = new THREE.MeshLambertMaterial({ map: sat.tex })
        uvMedia = sat.uvDe
      } catch {}
    }
    escena.add(new THREE.Mesh(mallaRelieve(rel, h0, { lado: rel.lado, paso: rel.paso, hueco: cerca.lado, bajar: 0.6, colorDe, uvDe: uvMedia }), matMedia))
    if (estilo.paisaje) {
      const pai = op.relieveDatos ? crearRelieve(op.relieveDatos.paisaje.meta, op.relieveDatos.paisaje.alturas) : await cargarRelieve(base, op.paisaje || 'ejemplo-paisaje')
      let matPai = matSuelo, uvPai = null
      if (estilo.satelite) {
        try {
          const sat = await texturaSatelite(pai.meta.lat, pai.meta.lon, pai.lado, 13)
          matPai = new THREE.MeshLambertMaterial({ map: sat.tex })
          uvPai = sat.uvDe
        } catch {}
      }
      const colorLejos = (x, z, h, pend) => colorSuelo(x, z, h, pend, finca, estilo)
      escena.add(new THREE.Mesh(mallaRelieve(pai, h0, { lado: pai.lado, paso: pai.paso, hueco: rel.lado, bajar: 3, colorDe: colorLejos, uvDe: uvPai }), matPai))
      if (!estilo.satelite) bosqueLejano(escena, pai, h0, finca, rel.lado)
    }
    if (!estilo.satelite) bosqueCercano(escena, rel, h0, finca, estilo)
    if (estilo.marDeNubes) escena.add(marDeNubes(pai_altura(h0)))
  }

  // ---------- La finca ----------
  // Punto (dx, dz) medido en los ejes propios de un objeto girado `o.rot`, pasado al mundo.
  function local(o, dx, dz) {
    const φ = o.rot || 0
    return [o.x + dx * Math.cos(φ) + dz * Math.sin(φ), o.z - dx * Math.sin(φ) + dz * Math.cos(φ)]
  }

  // `toque`: radio (m) de una zona invisible alrededor, para que un banderín o
  // un trípode de pocos centímetros se pueda tocar con el dedo.
  const matInvisible = new THREE.MeshBasicMaterial({ visible: false })
  const ocupado = []
  function poner(geom, x, z, rot = 0, { plan = false, sombra = true, etiqueta = null, id = null, clase = null, alto = 3, edificio = false, toque = 0 } = {}) {
    const r = geom.boundingBox ? Math.max(geom.boundingBox.max.x - geom.boundingBox.min.x, geom.boundingBox.max.z - geom.boundingBox.min.z) / 2 : 1
    // Se apoya en el punto más bajo bajo la planta para que nada quede flotando en la ladera.
    let y = Infinity
    for (const [dx, dz] of [[0, 0], [r, r], [-r, r], [r, -r], [-r, -r]]) y = Math.min(y, suelo(x + dx * 0.8, z + dz * 0.8))
    // Donde hay algo construido o sembrado no crece el pasto suelto (vida.pasto).
    if (!plan) ocupado.push([x, z, r * (edificio ? estilo.escalaEdificios || 1 : 1) + 0.5])
    const g = new THREE.Group()
    const malla = new THREE.Mesh(geom, plan ? matPlan : mat)
    malla.castShadow = sombra && !plan
    malla.receiveShadow = !plan
    g.add(malla)
    if (plan) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom, 30), matPlanBorde))
    g.position.set(x, y, z)
    g.rotation.y = rot
    const escala = edificio ? estilo.escalaEdificios || 1 : 1
    g.scale.setScalar(escala)
    escena.add(g)
    if (id) {
      // `clase` dice qué es (gallinero, huerta…) cuando el id es el de un sitio
      // escaneado; en la finca de ejemplo el id ya lo dice.
      malla.userData = { id, etiqueta, plan, clase: clase || id }
      tocables.push(malla)
      if (toque) {
        const zona = new THREE.Mesh(new THREE.CylinderGeometry(toque, toque, alto, 8), matInvisible)
        zona.position.y = alto / 2
        zona.userData = malla.userData
        g.add(zona)
        tocables.push(zona)
      }
    }
    // El letrero sube con el edificio agrandado; si no, queda clavado en el techo.
    if (etiqueta) etiquetas.push({ id, texto: etiqueta, plan, punto: new THREE.Vector3(x, y + alto * escala, z) })
    return g
  }

  // Lo que se mueve (mapa/vida.js). `controles` se crea más abajo: por eso el
  // punto que se está mirando se pide con una función y no se pasa ya resuelto.
  const vida = crearVida({ escena, mat, suelo, local, poner, animables, tocables, estilo, camara, objetivo: () => controles.objetivo, distancia: () => controles.dist })
  // A qué se le puede pedir «acércame» y dónde se para la cámara (ver acercarA).
  const acercables = new Map()

  for (const o of finca.objetos) {
    const plan = !!o.plan
    const comun = { plan, etiqueta: o.etiqueta, id: o.id, clase: o.clase }
    switch (o.tipo) {
      case 'casa': poner(M.geomCasa(), o.x, o.z, o.rot, { ...comun, alto: 7.5, edificio: true }); break
      case 'tanque': poner(M.geomTanque(), o.x, o.z, o.rot, { ...comun, alto: 3.5, edificio: true }); break
      case 'galpon': poner(M.geomGalpon(), o.x, o.z, o.rot, { ...comun, alto: 5.5, edificio: true }); break
      case 'panel': poner(M.geomPanelSolar(), o.x, o.z, o.rot, { ...comun, alto: 3.5, edificio: true }); break
      case 'compostera': poner(M.geomCompostera(), o.x, o.z, o.rot, { ...comun, alto: 2.8, edificio: true }); break
      // El que ya existe va en dos piezas, con lombrices que se ven de cerca; el
      // que es «plan» no tiene lombrices: sería dibujar lo que no hay.
      case 'lombricultivo':
        if (plan) poner(M.geomLombricultivo(), o.x, o.z, o.rot, { ...comun, alto: 2.8, edificio: true })
        else acercables.set(o.id, vida.lombricultivo(o, comun))
        break
      // En la finca de ejemplo el invernadero y el reservorio traen plan: true;
      // en una escaneada los decide quien los marcó.
      case 'invernadero': poner(M.geomInvernadero(), o.x, o.z, o.rot, { ...comun, alto: 5 }); break
      case 'reservorio': poner(M.geomReservorio(6), o.x, o.z, o.rot, { ...comun, alto: 2 }); break
      // Lo que solo existe en una finca escaneada.
      // El agua (nacimiento, quebrada, reservorio) va como banderín azul: un
      // estanque redondo sería inventarle forma a lo que se marcó con un punto.
      case 'agua': poner(M.geomBandera(M.PALETA.tanqueAzul), o.x, o.z, o.rot, { ...comun, alto: 4.2, toque: 3 }); break
      case 'potrero': {
        // Tamaño de dibujo (26 × 18 m): el escáner marca el potrero con un punto, no lo mide.
        const a = (o.ancho || 26) / 2, f = (o.fondo || 18) / 2
        cerca([local(o, -a, -f), local(o, a, -f), local(o, a, f), local(o, -a, f)], { cada: 3, plan })
        poner(M.geomBandera(M.PALETA.hoja), o.x, o.z, o.rot, { ...comun, alto: 4.2, toque: 3 })
        // Sin vacas anotadas (o.vacas ausente o 0) el potrero queda vacío, y un
        // potrero que todavía es «plan» no tiene animales.
        if (!plan) vida.vacas(o, o.vacas)
        break
      }
      case 'marca': poner(M.geomBandera(), o.x, o.z, o.rot, { ...comun, alto: 4.2, toque: 3 }); break
      case 'panoramica': poner(M.geomCamara(), o.x, o.z, o.rot, { ...comun, alto: 3.2, toque: 3 }); break
      case 'parque': {
        // En una finca escaneada (ladera de verdad) el cerco sigue el terreno; el
        // modelo rígido solo sirve en el llano de la finca de ejemplo.
        if (finca.escaneada) {
          const a = o.ancho / 2, f = o.fondo / 2
          cerca([local(o, -a, -f), local(o, a, -f), local(o, a, f), local(o, -a, f)], { cada: 2, plan })
        } else poner(M.geomCerco(o.ancho, o.fondo), o.x, o.z, o.rot, { sombra: true, plan })
        // Donde escarban gallinas no queda pasto: tierra pelada, y sin matas encima.
        if (nuevo && !plan && o.gallinas !== 0) {
          vida.parche(o, o.ancho + 3, o.fondo + 3, '#a98558')
          ocupado.push([o.x, o.z, Math.min(o.ancho, o.fondo) / 2])
        }
        gallinas(o, plan)
        break
      }
      case 'huerta': {
        if (nuevo && !plan) vida.parche(o, o.camas.length * 2.1 + 2, 8, '#7b5a3a', 0.55)
        o.camas.forEach((cultivo, i) => {
          // Las camas van a lo largo de la curva de nivel y se separan ladera
          // abajo: así el agua no arrastra el suelo entre surcos.
          const [x, z] = local(o, (i - (o.camas.length - 1) / 2) * 2.1, 0)
          const g = poner(M.geomCama(5, 1.2, cultivo), x, z, o.rot, { sombra: true, plan })
          // Gráficos nuevos: la cama se acuesta sobre la ladera. Apoyada en su
          // punto más bajo (como una casa) quedaba enterrada y solo asomaban las matas.
          if (nuevo) {
            const alto = (dx, dz) => suelo(...local({ x, z, rot: o.rot }, dx, dz))
            g.position.y = suelo(x, z)
            g.rotation.order = 'YXZ'
            g.rotation.x = -Math.atan2(alto(0, 2.5) - alto(0, -2.5), 5)
            g.rotation.z = Math.atan2(alto(0.6, 0) - alto(-0.6, 0), 1.2)
          }
        })
        etiquetas.push({ id: o.id, texto: o.etiqueta, plan, punto: new THREE.Vector3(o.x, suelo(o.x, o.z) + 3, o.z) })
        break
      }
      case 'frutales': {
        const g = M.geomArbol('frutal')
        for (let f = 0; f < o.filas; f++)
          for (let c = 0; c < o.columnas; c++) {
            const [x, z] = local(o, (c - o.columnas / 2) * 5, (f - o.filas / 2) * 5)
            poner(g, x, z, hash2(f, c) * 6)
          }
        etiquetas.push({ id: o.id, texto: o.etiqueta, punto: new THREE.Vector3(o.x, suelo(o.x, o.z) + 5, o.z) })
        break
      }
      case 'bosque': {
        const tipos = ['aliso', 'roble', 'encenillo', 'sietecueros', 'arrayan']
        const geoms = Object.fromEntries(tipos.map((t) => [t, M.geomArbol(t)]))
        let k = 0
        for (let i = 0; i < 70; i++) {
          const a = hash2(i, 3) * Math.PI * 2, r = Math.sqrt(hash2(i, 9)) * o.radio
          const x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r
          if (!dentroLindero(x, z, finca.lindero, -2)) continue
          const t = tipos[k++ % tipos.length]
          const g = poner(geoms[t], x, z, hash2(i, 1) * 6)
          g.scale.setScalar((0.6 + hash2(i, 5) * 0.7) * estilo.escalaArboles)
        }
        etiquetas.push({ id: o.id, texto: o.etiqueta, punto: new THREE.Vector3(o.x, suelo(o.x, o.z) + 14, o.z) })
        break
      }
    }
  }
  // Un lindero provisional (todavía no se ha caminado) no se cerca: sería
  // dibujar una cerca que nadie midió.
  if (!finca.linderoProvisional) cerca(finca.lindero)
  if (finca.camino) camino(finca.camino)
  // Las garzas solo cruzan en el estilo Juguete, que es el paisaje abierto.
  if (estilo === ESTILOS.juguete) vida.pajaros()
  if (nuevo) vida.pasto({ lindero: finca.lindero, enFinca: (x, z, margen) => dentroLindero(x, z, finca.lindero, margen), ocupado, camino: finca.camino })

  function gallinas(o, plan) {
    // Sin gallinas anotadas, el parque queda vacío: el mapa no inventa animales.
    // (`gallinas` ausente = finca de ejemplo, que sí muestra su bandada.)
    const n = o.gallinas ?? 20
    if (!(n > 0)) return
    const { cuerpo, detalles } = M.geomGallina()
    const mCuerpo = new THREE.InstancedMesh(cuerpo, mat, n)
    const mDet = new THREE.InstancedMesh(detalles, mat, n)
    mCuerpo.castShadow = true
    // Colores de una bandada de araucanas y sus cruces: negra, trigueña, lavanda, blanca, barrada, castaña.
    const colores = ['#2b2b2e', '#d8a45c', '#a9a5bd', '#f3f0e8', '#9a9a98', '#a2562f', '#e6d3a3']
    const aves = []
    for (let i = 0; i < n; i++) {
      mCuerpo.setColorAt(i, new THREE.Color(colores[i % colores.length]))
      const [x, z] = local(o, (hash2(i, 2) - 0.5) * (o.ancho - 2), (hash2(i, 4) - 0.5) * (o.fondo - 2))
      aves.push({ x, z, rumbo: hash2(i, 6) * 6.28, vel: 0, picar: 0, t: hash2(i, 8) * 3 })
    }
    // ¿Sigue dentro del parque? Se mide en los ejes del parque, que puede estar girado.
    const φ = o.rot || 0
    const dentroParque = (x, z) => {
      const dx = x - o.x, dz = z - o.z
      const u = dx * Math.cos(φ) - dz * Math.sin(φ), w = dx * Math.sin(φ) + dz * Math.cos(φ)
      return Math.abs(u) < o.ancho / 2 - 0.8 && Math.abs(w) < o.fondo / 2 - 0.8
    }
    escena.add(mCuerpo, mDet)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3().setScalar(estilo.escalaAnimales), p = new THREE.Vector3()
    function dibujar() {
      aves.forEach((a, i) => {
        e.set(0, -a.rumbo, a.picar ? -0.5 : 0)
        q.setFromEuler(e)
        p.set(a.x, suelo(a.x, a.z) + (a.vel > 0 ? Math.abs(Math.sin(a.t * 14)) * 0.05 : 0), a.z)
        m4.compose(p, q, s)
        mCuerpo.setMatrixAt(i, m4)
        mDet.setMatrixAt(i, m4)
      })
      mCuerpo.instanceMatrix.needsUpdate = mDet.instanceMatrix.needsUpdate = true
    }
    dibujar()
    // Caminan, se paran y picotean, sin salirse del parque.
    animables.push((dt) => {
      for (const [i, a] of aves.entries()) {
        a.t += dt
        if (a.t > 1.5 + hash2(i, Math.floor(a.t)) * 2) {
          a.t = 0
          a.vel = hash2(i, Math.floor(performance.now() / 997)) > 0.55 ? 0.6 + hash2(i, 3) * 0.6 : 0
          a.picar = a.vel === 0 && hash2(i, Math.floor(performance.now() / 613)) > 0.4
          a.rumbo += (hash2(i, Math.floor(performance.now() / 331)) - 0.5) * 2.4
        }
        if (a.vel) {
          const nx = a.x + Math.cos(a.rumbo) * a.vel * dt, nz = a.z + Math.sin(a.rumbo) * a.vel * dt
          if (dentroParque(nx, nz)) {
            a.x = nx
            a.z = nz
          } else a.rumbo += Math.PI * 0.7
        }
      }
      dibujar()
    })
  }

  // Cerca que sigue el terreno: un poste cada `cada` metros y dos hilos de
  // poste a poste. Sirve para el lindero y para los potreros. Un cerco rígido (un
  // solo modelo plano) se entierra en la ladera: el primer potrero escaneado
  // quedó bajo tierra por eso.
  function cerca(puntos, { cada = 4, plan = false } = {}) {
    const geo = M.geomPoste()
    const lista = []
    for (let k = 0; k < puntos.length; k++) {
      const a = puntos[k], b = puntos[(k + 1) % puntos.length]
      const largo = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.round(largo / cada))
      for (let i = 0; i < n; i++) lista.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n])
    }
    const postes = new THREE.InstancedMesh(geo, plan ? matPlan : mat, lista.length)
    const alambre = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 0.04), plan ? new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.9 }) : new THREE.MeshLambertMaterial({ color: '#e2e2e2' }), lista.length * 2)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    lista.forEach(([x, z], i) => {
      const y = suelo(x, z)
      postes.setMatrixAt(i, m4.makeTranslation(x, y, z))
      const [x2, z2] = lista[(i + 1) % lista.length]
      const y2 = suelo(x2, z2)
      const largo = Math.hypot(x2 - x, y2 - y, z2 - z)
      for (const [j, alto] of [[0, 0.7], [1, 1.3]]) {
        e.set(0, -Math.atan2(z2 - z, x2 - x), Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z)), 'YZX')
        q.setFromEuler(e)
        m4.compose(new THREE.Vector3((x + x2) / 2, (y + y2) / 2 + alto, (z + z2) / 2), q, new THREE.Vector3(largo, 1, 1))
        alambre.setMatrixAt(i * 2 + j, m4)
      }
    })
    postes.castShadow = !plan
    escena.add(postes, alambre)
  }

  function camino(puntos) {
    const pos = [], col = []
    const ancho = 2.6
    const muestras = []
    for (let k = 0; k < puntos.length - 1; k++) {
      const [ax, az] = puntos[k], [bx, bz] = puntos[k + 1]
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2)
      for (let i = 0; i < n; i++) muestras.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n])
    }
    muestras.push(puntos[puntos.length - 1])
    for (let i = 0; i < muestras.length - 1; i++) {
      const [ax, az] = muestras[i], [bx, bz] = muestras[i + 1]
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1
      const nx = (-dz / l) * (ancho / 2), nz = (dx / l) * (ancho / 2)
      const v = [[ax + nx, az + nz], [ax - nx, az - nz], [bx + nx, bz + nz], [bx - nx, bz - nz]].map(([x, z]) => [x, suelo(x, z) + 0.12, z])
      pos.push(...v[0], ...v[1], ...v[2], ...v[1], ...v[3], ...v[2])
      for (let j = 0; j < 6; j++) col.push(COL.camino.r, COL.camino.g, COL.camino.b)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }))
    m.receiveShadow = true
    escena.add(m)
  }

  // `azar` > 0 siembra además árboles sueltos con esa probabilidad (para el diorama,
  // donde la ficha es tan pequeña que casi no le caen manchas de bosque).
  function bosqueCercano(esc, rel, h0, finca, estilo, lim = rel.lado / 2 - 30, azar = 0) {
    const tipos = ['encenillo', 'roble', 'aliso', 'eucalipto', 'pino', 'sietecueros']
    const listas = Object.fromEntries(tipos.map((t) => [t, []]))
    const paso = azar ? 9 : 22
    for (let x = -lim; x < lim; x += paso)
      for (let z = -lim; z < lim; z += paso) {
        const jx = x + (hash2(x, z) - 0.5) * paso, jz = z + (hash2(z, x) - 0.5) * paso
        if (Math.abs(jx) > lim || Math.abs(jz) > lim) continue
        const h = rel.alturaEn(jx, jz)
        const pend = rel.pendienteEn(jx, jz).pct / 100
        const suelto = azar && !dentroLindero(jx, jz, finca.lindero, 3) && hash2(jx * 7, jz * 3) < azar
        if (!suelto && !hayBosque(jx, jz, h, pend, finca)) continue
        // Plantaciones de eucalipto y pino en manchas (así está la zona); nativos en las cañadas.
        const plantacion = ruido(jx - 400, jz + 200, 300)
        const t = plantacion > 0.66 ? (plantacion > 0.8 ? 'pino' : 'eucalipto') : tipos[Math.floor(hash2(jx * 3, jz * 7) * 3)]
        listas[hash2(jx, jz * 3) > 0.93 ? 'sietecueros' : t].push([jx, h - h0, jz, hash2(jz, jx)])
      }
    for (const t of tipos) {
      const l = listas[t]
      if (!l.length) continue
      const im = new THREE.InstancedMesh(M.geomArbol(t), mat, l.length)
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), tinte = new THREE.Color()
      l.forEach(([x, y, z, r], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6.28)
        s.setScalar((0.8 + r * 0.6) * estilo.escalaArboles)
        m4.compose(new THREE.Vector3(x, y - 0.3, z), q, s)
        im.setMatrixAt(i, m4)
        // Gráficos nuevos: ningún bosque tiene todos los árboles del mismo verde.
        if (nuevo) im.setColorAt(i, tinte.setRGB(0.86 + hash2(i, 11) * 0.26, 0.9 + hash2(i, 17) * 0.18, 0.8 + hash2(i, 23) * 0.3))
      })
      im.castShadow = true
      esc.add(im)
    }
  }

  function bosqueLejano(esc, pai, h0, finca, hueco) {
    // Lejos basta un cono por árbol: a 5 km nadie distingue un roble de un aliso.
    const g = M.unir([M.parte(new THREE.ConeGeometry(9, 26, 5), '#3f7633', { p: [0, 13, 0] })])
    const lista = []
    const paso = 85
    const lim = pai.lado / 2 - 100
    for (let x = -lim; x < lim; x += paso)
      for (let z = -lim; z < lim; z += paso) {
        if (Math.abs(x) < hueco / 2 && Math.abs(z) < hueco / 2) continue
        const jx = x + (hash2(x, z) - 0.5) * paso, jz = z + (hash2(z, x) - 0.5) * paso
        const h = pai.alturaEn(jx, jz)
        const pend = pai.pendienteEn(jx, jz).pct / 100
        if (hayBosque(jx, jz, h, pend, finca)) lista.push([jx, h - h0 - 3, jz, hash2(jx, jz)])
      }
    const im = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), lista.length)
    const m4 = new THREE.Matrix4()
    lista.forEach(([x, y, z, r], i) => im.setMatrixAt(i, m4.makeScale(0.7 + r * 0.6, 0.7 + r * 0.6, 0.7 + r * 0.6).setPosition(x, y, z)))
    esc.add(im)
  }

  function pai_altura(h0) {
    // El mar de nubes del valle hacia La Mesa: queda unos 750 m por debajo de la finca.
    return 1850 - h0
  }

  function marDeNubes(y) {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const ctx = c.getContext('2d')
    for (let i = 0; i < 260; i++) {
      const x = hash2(i, 1) * 512, yy = hash2(i, 2) * 512, r = 20 + hash2(i, 3) * 70
      const gr = ctx.createRadialGradient(x, yy, 0, x, yy, r)
      gr.addColorStop(0, 'rgba(255,255,255,0.55)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gr
      ctx.fillRect(x - r, yy - r, r * 2, r * 2)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(5, 5)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.95 }))
    m.rotation.x = -Math.PI / 2
    m.position.y = y
    animables.push((dt) => (tex.offset.x += dt * 0.002))
    return m
  }

  // Nubes sueltas que pasan despacio.
  const nubes = []
  for (let i = 0; i < estilo.nubes; i++) {
    const n = new THREE.Mesh(M.geomNube(i + 1), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, transparent: true, opacity: 0.93 }))
    const r = estilo.diorama ? 150 + hash2(i, 7) * 60 : 300 + hash2(i, 7) * 1600
    const a = hash2(i, 9) * Math.PI * 2
    n.position.set(Math.cos(a) * r, estilo.diorama ? 30 + hash2(i, 5) * 50 : 160 + hash2(i, 5) * 260, Math.sin(a) * r)
    n.scale.setScalar(estilo.diorama ? 0.9 + hash2(i, 3) : 2 + hash2(i, 3) * 3)
    escena.add(n)
    nubes.push(n)
  }
  animables.push((dt) => {
    for (const n of nubes) {
      n.position.x += dt * (estilo.diorama ? 1.2 : 4)
      const lim = estilo.diorama ? 230 : 2200
      if (n.position.x > lim) n.position.x = -lim
    }
  })

  // ---------- Cámara, controles y cuadro a cuadro ----------
  const raycaster = new THREE.Raycaster()
  // En un celular vertical el campo horizontal se encoge a menos de la mitad: con la
  // cámara de escritorio la casa llena la pantalla y el galpón —lo que da la plata—
  // queda por fuera. Se abre un poco el lente (abrirlo más deforma los bordes como
  // ojo de pez), se mira más desde arriba y la distancia sale del encuadre.
  const esVertical = (a) => a < 0.9
  const fovPara = (a) => (esVertical(a) ? Math.min(estilo.fov * 1.55, 70) : estilo.fov)
  const aspecto0 = (lienzo.clientWidth || 800) / (lienzo.clientHeight || 600)
  const vertical0 = esVertical(aspecto0)
  const az0 = vertical0 ? estilo.camara.azimutVertical ?? estilo.camara.azimut : estilo.camara.azimut
  const el0 = estilo.camara.elevacion + (vertical0 ? 0.25 : 0)
  const enc = estilo.diorama ? null : encuadre(finca, az0, aspecto0, fovPara(aspecto0))
  const [cvx, cvz] = enc ? enc.objetivo : estilo.diorama ? [0, 0] : finca.centroVista || [0, 0]
  const controles = new Controles(camara, lienzo, {
    ...estilo.camara,
    distancia: enc ? THREE.MathUtils.clamp(enc.distancia, estilo.camara.distancia * 0.8, estilo.camara.distancia * 2) : estilo.camara.distancia,
    elevacion: el0,
    azimut: az0,
    objetivo: [cvx, suelo(cvx, cvz), cvz],
    suelo,
    // Hasta 3 m: lo justo para ver las lombrices en su lecho, o una gallina de cerca.
    minDist: 3,
    maxDist: estilo.diorama ? 1100 : 1400,
    radioMax: estilo.diorama ? 110 : 500,
    alTocar: (nx, ny) => {
      raycaster.setFromCamera({ x: nx, y: ny }, camara)
      const golpe = raycaster.intersectObjects(tocables, false).find((h) => h.object.userData?.id)
      op.alTocar?.(golpe ? golpe.object.userData : null)
    },
  })

  function ajustar() {
    const w = lienzo.clientWidth || 800, h = lienzo.clientHeight || 600
    renderer.setSize(w, h, false)
    camara.aspect = w / h
    camara.fov = fovPara(camara.aspect)
    camara.updateProjectionMatrix()
  }
  ajustar()
  const alCambiar = () => ajustar()
  window.addEventListener('resize', alCambiar)

  const v = new THREE.Vector3()
  function proyectarEtiquetas() {
    const w = lienzo.clientWidth, h = lienzo.clientHeight
    return etiquetas.map((e) => {
      v.copy(e.punto).project(camara)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      return { ...e, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible, distancia: camara.position.distanceTo(e.punto) }
    })
  }

  let sombraMedio = 170 // medio lado, en metros, del cuadro que cubre el mapa de sombras
  // Un cuadro: mueve la cámara y lo que está vivo `dt` segundos, y dibuja.
  function paso(dt) {
    controles.actualizar(dt)
    // De cerca (las lombrices están a 4 m) el plano cercano de la cámara tiene
    // que acercarse o cortaría lo que se mira. De lejos se queda en 1 m: con
    // uno más corto las montañas del fondo parpadean.
    const cercano = THREE.MathUtils.clamp(controles.dist / 20, 0.15, 1)
    if (camara.near !== cercano) {
      camara.near = cercano
      camara.updateProjectionMatrix()
    }
    for (const f of animables) f(dt)
    // Gráficos nuevos: el cuadro de la sombra se encoge al acercarse. El mismo
    // mapa de sombras repartido en menos terreno da sombras nítidas y pegadas a
    // las patas; con el cuadro fijo de 340 m, de cerca eran manchas corridas.
    // Cambia por escalones: ajustarlo en cada cuadro haría temblar las sombras.
    if (nuevo) {
      const medio = THREE.MathUtils.clamp(controles.dist * 1.8, 25, 170)
      if (medio > sombraMedio * 1.2 || medio < sombraMedio / 1.2 || (medio === 170 && sombraMedio !== 170)) {
        sombraMedio = medio
        sc.left = sc.bottom = -medio
        sc.right = sc.top = medio
        sc.updateProjectionMatrix()
        luzSol.shadow.normalBias = Math.max(0.05, 0.4 * (medio / 170))
      }
    }
    // La sombra sigue a la cámara: solo importa cerca de donde se mira.
    luzSol.target.position.copy(controles.objetivo)
    luzSol.position.copy(controles.objetivo).addScaledVector(sol.vector, 600)
    renderer.render(escena, camara)
    const lista = proyectarEtiquetas()
    op.alDibujar?.(lista)
    return lista
  }

  let ultimo = performance.now()
  let vivo = true
  function cuadro() {
    if (!vivo) return
    const ahora = performance.now()
    const dt = Math.min(0.1, (ahora - ultimo) / 1000)
    ultimo = ahora
    paso(dt)
    requestAnimationFrame(cuadro)
  }
  // Un dibujo inmediato, sin esperar al primer cuadro: con el panel oculto
  // requestAnimationFrame no corre y la pantalla quedaría negra.
  paso(0)
  requestAnimationFrame(cuadro)

  return {
    escena, camara, renderer, controles, info, relieve: rel,
    dibujar: () => paso(0),
    // Avanza el mundo a mano (pruebas y pantallazos: con el panel oculto el
    // navegador no llama al ciclo de dibujo).
    paso,
    // Lleva la cámara hasta algo que se mira de cerca (hoy, el lombricultivo).
    // Devuelve false si a ese objeto no hay cómo acercarse.
    acercarA(id) {
      const a = acercables.get(id)
      if (!a) return false
      // De los dos extremos del lecho, el que quede más cerca de donde ya está la cámara.
      const deFrente = Math.cos(a.largo - controles.azimut) >= 0
      controles.volar(a.objetivo, { dist: a.dist, elev: a.elev, azimut: deFrente ? a.largo : a.largo + Math.PI })
      return true
    },
    destruir() {
      vivo = false
      window.removeEventListener('resize', alCambiar)
      renderer.dispose()
    },
  }
}
