// Modelos de la finca hechos con código, en baja poligonización.
//
// Por qué no modelos descargados: no hay licencias que revisar, pesan casi nada
// (el mapa tiene que abrir en un iPhone en la ladera) y cada pieza se puede
// cambiar de tamaño con los datos reales (un galpón para 30 gallinas no mide lo
// mismo que uno para 150). Todo en metros; el origen de cada modelo es el piso,
// en su centro.
//
// Cada modelo es UNA geometría con el color en los vértices: así se dibuja en
// una sola llamada y los repetidos (árboles, gallinas, postes) van instanciados.

import * as THREE from '../vendor/three/three.module.js'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

export const PALETA = {
  madera: '#b07842', maderaOscura: '#7a4b28', zinc: '#aeb6bb', teja: '#b5553a', tejaOscura: '#8e3f2b',
  pared: '#f3eee3', zocalo: '#3e7c6c', puerta: '#6a3f22', vidrio: '#5a7f96', malla: '#3a3d3f',
  concreto: '#bdb5a6', tierra: '#5d3c26', tierraClara: '#8a5d3b', hoja: '#6cbf4a', hojaOscura: '#3f7f35',
  hojaClara: '#a6d86a', tronco: '#6e4a2f', troncoClaro: '#8d6a4a', tanque: '#2e3338', tanqueAzul: '#2f6fb3',
  panel: '#1d3b73', marco: '#c9ccd0', alambre: '#d8d8d8', paja: '#d9c27a', blanco: '#ffffff', rojo: '#d63a2f',
  amarillo: '#f2c230', naranja: '#f08a24', morado: '#8a55c2', gris: '#8c8f8a',
}

// Una pieza: geometría + color + posición/giro/escala, lista para unir.
export function parte(geom, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone()
  _e.set(r[0], r[1], r[2])
  _q.setFromEuler(_e)
  _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]))
  g.applyMatrix4(_m)
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  if (g.attributes.uv) g.deleteAttribute('uv')
  return g
}

export function unir(partes) {
  let total = 0
  for (const g of partes) total += g.attributes.position.count
  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  let o = 0
  for (const g of partes) {
    pos.set(g.attributes.position.array, o * 3)
    nor.set(g.attributes.normal.array, o * 3)
    col.set(g.attributes.color.array, o * 3)
    o += g.attributes.position.count
  }
  const r = new THREE.BufferGeometry()
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  r.setAttribute('color', new THREE.BufferAttribute(col, 3))
  r.computeBoundingSphere()
  r.computeBoundingBox()
  return r
}

const caja = (x, y, z) => new THREE.BoxGeometry(x, y, z)
const cil = (rArriba, rAbajo, h, lados = 8) => new THREE.CylinderGeometry(rArriba, rAbajo, h, lados)
const bola = (r, detalle = 1) => new THREE.IcosahedronGeometry(r, detalle)
const cono = (r, h, lados = 7) => new THREE.ConeGeometry(r, h, lados)

// Techo a dos aguas: dos láminas inclinadas con alero. La cumbrera va a lo largo de x.
function techo(ancho, fondo, altoParedes, subida, color, alero = 0.35, grosor = 0.08) {
  const mitad = fondo / 2 + alero
  const largo = Math.hypot(mitad, subida)
  const ang = Math.atan2(subida, mitad)
  return [
    parte(caja(ancho + alero * 2, grosor, largo), color, { p: [0, altoParedes + subida / 2, mitad / 2 - alero / 2 + 0.02], r: [ang, 0, 0] }),
    parte(caja(ancho + alero * 2, grosor, largo), color, { p: [0, altoParedes + subida / 2, -mitad / 2 + alero / 2 - 0.02], r: [-ang, 0, 0] }),
  ]
}

// Hastial: el triángulo de pared bajo el techo, como prisma que llena el entretecho.
function hastiales(ancho, fondo, altoParedes, subida, color) {
  const forma = new THREE.Shape([new THREE.Vector2(-fondo / 2, 0), new THREE.Vector2(fondo / 2, 0), new THREE.Vector2(0, subida)])
  const g = new THREE.ExtrudeGeometry(forma, { depth: ancho, bevelEnabled: false })
  // La forma queda en XY y se extruye en Z; girada 90° queda el triángulo en ZY
  // con la punta arriba, y la extrusión a lo ancho de la casa (eje X).
  g.rotateY(Math.PI / 2)
  g.translate(-ancho / 2, altoParedes, 0)
  return parte(g, color)
}

export function geomGalpon({ ancho = 4, fondo = 3, alto = 2.2 } = {}) {
  const P = PALETA
  const zocalo = alto * 0.5
  const partes = [
    parte(caja(ancho + 0.4, 0.15, fondo + 0.4), P.concreto, { p: [0, 0.075, 0] }),
    parte(caja(ancho, zocalo, fondo), P.madera, { p: [0, 0.15 + zocalo / 2, 0] }),
    // Malla arriba: ventila el amoníaco sin dejar entrar al zorro.
    parte(caja(ancho - 0.06, alto - zocalo - 0.15, fondo - 0.06), P.malla, { p: [0, 0.15 + zocalo + (alto - zocalo - 0.15) / 2, 0] }),
    parte(caja(0.8, 1.7, 0.06), P.puerta, { p: [ancho * 0.25, 0.15 + 0.85, fondo / 2 + 0.03] }),
    // Postes de las esquinas.
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => parte(caja(0.12, alto, 0.12), P.maderaOscura, { p: [sx * (ancho / 2), alto / 2 + 0.15, sz * (fondo / 2)] }))),
    // Nidales por fuera, del lado oriental (se recogen los huevos sin entrar).
    parte(caja(0.5, 0.45, fondo * 0.7), P.maderaOscura, { p: [-ancho / 2 - 0.25, 0.9, 0] }),
    parte(caja(0.62, 0.06, fondo * 0.75), P.zinc, { p: [-ancho / 2 - 0.27, 1.16, 0], r: [0, 0, -0.35] }),
    ...techo(ancho, fondo, alto + 0.15, 0.9, P.zinc),
    hastiales(ancho, fondo, alto + 0.15, 0.9, P.madera),
  ]
  return unir(partes)
}

// Parque de pastoreo: postes y malla. La malla va como dos hilos para que se lea desde lejos.
export function geomCerco(ancho, fondo, { alto = 1.6, cada = 1.8, puerta = true } = {}) {
  const P = PALETA
  const partes = []
  const lados = [
    [[-ancho / 2, -fondo / 2], [ancho / 2, -fondo / 2]],
    [[ancho / 2, -fondo / 2], [ancho / 2, fondo / 2]],
    [[ancho / 2, fondo / 2], [-ancho / 2, fondo / 2]],
    [[-ancho / 2, fondo / 2], [-ancho / 2, -fondo / 2]],
  ]
  lados.forEach(([a, b], i) => {
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.round(largo / cada))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      partes.push(parte(caja(0.1, alto, 0.1), P.maderaOscura, { p: [a[0] + (b[0] - a[0]) * t, alto / 2, a[1] + (b[1] - a[1]) * t] }))
    }
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2
    const hueco = puerta && i === 2 ? 1.2 : 0
    for (const y of [alto * 0.35, alto * 0.95]) {
      partes.push(parte(caja(largo - hueco, 0.03, 0.03), P.alambre, { p: [cx, y, cz], r: [0, -ang, 0] }))
    }
  })
  return unir(partes)
}

// La gallina va en dos geometrías: el cuerpo (se tiñe por instancia: cada una
// de su color) y los detalles que no cambian (cresta roja, pico y patas).
export function geomGallina() {
  const P = PALETA
  const cuerpo = unir([
    parte(bola(0.2, 1), P.blanco, { p: [0, 0.3, 0], s: [1.35, 1, 0.95] }),
    parte(bola(0.1, 1), P.blanco, { p: [0.2, 0.47, 0] }),
    parte(cono(0.12, 0.26, 5), P.blanco, { p: [-0.25, 0.42, 0], r: [0, 0, 0.9] }),
    parte(bola(0.09, 0), P.blanco, { p: [-0.02, 0.33, 0.17], s: [1.6, 0.8, 0.4] }),
    parte(bola(0.09, 0), P.blanco, { p: [-0.02, 0.33, -0.17], s: [1.6, 0.8, 0.4] }),
  ])
  const detalles = unir([
    parte(caja(0.05, 0.07, 0.025), P.rojo, { p: [0.21, 0.58, 0] }),
    parte(cono(0.03, 0.08, 4), P.amarillo, { p: [0.31, 0.47, 0], r: [0, 0, -Math.PI / 2] }),
    parte(caja(0.025, 0.18, 0.025), P.amarillo, { p: [0.02, 0.09, 0.07] }),
    parte(caja(0.025, 0.18, 0.025), P.amarillo, { p: [0.02, 0.09, -0.07] }),
  ])
  return { cuerpo, detalles }
}

// Casa campesina de la Sabana: paredes blancas, zócalo verde, teja de barro y corredor.
export function geomCasa({ ancho = 9, fondo = 6, alto = 2.6 } = {}) {
  const P = PALETA
  const partes = [
    parte(caja(ancho + 2.2, 0.2, fondo + 0.6), P.concreto, { p: [0, 0.1, 0.9] }),
    parte(caja(ancho, alto, fondo), P.pared, { p: [0, 0.2 + alto / 2, 0] }),
    parte(caja(ancho + 0.02, 0.6, fondo + 0.02), P.zocalo, { p: [0, 0.5, 0] }),
    parte(caja(1, 2, 0.06), P.puerta, { p: [0, 1.2, fondo / 2 + 0.03] }),
    ...[-2.8, 2.8].map((x) => parte(caja(1.2, 1, 0.06), P.vidrio, { p: [x, 1.7, fondo / 2 + 0.03] })),
    ...[-2.8, 2.8].map((x) => parte(caja(1.4, 1.2, 0.04), P.zocalo, { p: [x, 1.7, fondo / 2 + 0.01] })),
    ...techo(ancho, fondo + 2.2, alto + 0.2, 1.5, P.teja, 0.5, 0.12).map((g) => {
      g.translate(0, 0, 1.1)
      return g
    }),
    // El techo cubre también el corredor, así que su triángulo va corrido hacia el frente.
    hastiales(ancho, fondo + 2.2, alto + 0.2, 1.5, P.pared).translate(0, 0, 1.1),
    // Corredor: postes de madera bajo el alero.
    ...[-4, -1.3, 1.3, 4].map((x) => parte(caja(0.15, alto, 0.15), P.maderaOscura, { p: [x, 0.2 + alto / 2, fondo / 2 + 1.6] })),
    // Chimenea del fogón de leña.
    parte(caja(0.6, 1.4, 0.6), P.tejaOscura, { p: [ancho / 2 - 1.2, alto + 1.4, -1] }),
  ]
  return unir(partes)
}

// Cama de huerta elevada, con borde de madera, y sus plantas.
export function geomCama(largo = 4, ancho = 1.2, cultivo = 'hoja') {
  const P = PALETA
  const partes = [
    parte(caja(ancho, 0.25, largo), P.maderaOscura, { p: [0, 0.125, 0] }),
    parte(caja(ancho - 0.12, 0.06, largo - 0.12), P.tierra, { p: [0, 0.27, 0] }),
  ]
  const filas = cultivo === 'maiz' ? 2 : 3
  const porFila = Math.floor(largo / (cultivo === 'maiz' ? 0.5 : 0.35))
  for (let f = 0; f < filas; f++) {
    for (let k = 0; k < porFila; k++) {
      const x = (f / (filas - 1) - 0.5) * (ancho - 0.4)
      const z = (k / (porFila - 1) - 0.5) * (largo - 0.4)
      if (cultivo === 'maiz') {
        partes.push(parte(cil(0.02, 0.025, 1.6, 4), P.hojaClara, { p: [x, 1.1, z] }))
        partes.push(parte(cono(0.22, 0.9, 4), P.hoja, { p: [x, 1.3, z], r: [0, k, 0] }))
      } else if (cultivo === 'repollo') {
        partes.push(parte(bola(0.16, 0), (k + f) % 2 ? P.hojaClara : '#93cf7a', { p: [x, 0.42, z] }))
      } else if (cultivo === 'arveja') {
        partes.push(parte(cil(0.01, 0.01, 1.2, 3), P.troncoClaro, { p: [x, 0.9, z] }))
        partes.push(parte(bola(0.14, 0), P.hojaOscura, { p: [x, 0.75 + (k % 3) * 0.15, z], s: [0.8, 1.6, 0.8] }))
      } else {
        partes.push(parte(bola(0.13, 0), (k + f) % 3 === 0 ? P.hojaOscura : P.hoja, { p: [x, 0.36, z], s: [1, 0.7, 1] }))
      }
    }
  }
  return unir(partes)
}

// Compostera de tres cajones: entra, madura, sale.
export function geomCompostera() {
  const P = PALETA
  const partes = []
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.15
    for (const dz of [-0.5, 0.5]) partes.push(parte(caja(1.05, 0.9, 0.06), P.madera, { p: [x, 0.45, dz] }))
    partes.push(parte(caja(0.06, 0.9, 1.05), P.madera, { p: [x - 0.52, 0.45, 0] }))
    partes.push(parte(bola(0.48, 1), i === 2 ? P.tierra : P.tierraClara, { p: [x, 0.45 - i * 0.1, 0], s: [1, 0.55 + (2 - i) * 0.15, 1] }))
  }
  partes.push(parte(caja(0.06, 0.9, 1.05), P.madera, { p: [1.7, 0.45, 0] }))
  return unir(partes)
}

export function geomLombricultivo() {
  const P = PALETA
  return unir([
    parte(caja(1.1, 0.45, 3), P.madera, { p: [0, 0.225, 0] }),
    parte(caja(0.98, 0.05, 2.9), P.tierra, { p: [0, 0.46, 0] }),
    ...[-1, 1].flatMap((sz) => [-1, 1].map((sx) => parte(caja(0.08, 1.4, 0.08), P.maderaOscura, { p: [sx * 0.6, 0.7, sz * 1.45] }))),
    parte(caja(1.6, 0.05, 3.4), P.paja, { p: [0, 1.42, 0], r: [0, 0, 0.12] }),
  ])
}

// Tanque de 1.000 litros sobre su base: recoge la lluvia del techo.
export function geomTanque({ azul = false } = {}) {
  const P = PALETA
  return unir([
    parte(caja(1.5, 0.6, 1.5), P.concreto, { p: [0, 0.3, 0] }),
    parte(cil(0.62, 0.66, 1.3, 12), azul ? P.tanqueAzul : P.tanque, { p: [0, 1.25, 0] }),
    parte(cil(0.25, 0.25, 0.12, 10), azul ? P.tanqueAzul : P.tanque, { p: [0, 1.96, 0] }),
  ])
}

// Dos paneles casi planos: a 4,7° de latitud el mejor ángulo es bajo (~10°),
// mirando al sur, y con algo de inclinación para que la lluvia los lave.
export function geomPanelSolar() {
  const P = PALETA
  const inclinacion = (10 * Math.PI) / 180
  return unir([
    ...[-0.9, 0.9].map((x) => parte(caja(1.7, 0.05, 1.05), P.panel, { p: [x, 1.35, 0], r: [inclinacion, 0, 0] })),
    ...[-0.9, 0.9].map((x) => parte(caja(1.74, 0.03, 1.09), P.marco, { p: [x, 1.32, 0], r: [inclinacion, 0, 0] })),
    ...[-1.6, 1.6].flatMap((x) => [parte(caja(0.08, 1.45, 0.08), P.gris, { p: [x, 0.72, 0.4] }), parte(caja(0.08, 1.2, 0.08), P.gris, { p: [x, 0.6, -0.4] })]),
  ])
}

// Invernadero (para el modo «lo que se puede construir»).
export function geomInvernadero(largo = 15, ancho = 6) {
  const P = PALETA
  const partes = []
  const arcos = Math.round(largo / 2)
  for (let i = 0; i <= arcos; i++) {
    const z = (i / arcos - 0.5) * largo
    partes.push(parte(new THREE.TorusGeometry(ancho / 2, 0.04, 4, 12, Math.PI), P.marco, { p: [0, 1, z] }))
  }
  partes.push(parte(new THREE.CylinderGeometry(ancho / 2, ancho / 2, largo, 12, 1, true, -Math.PI / 2, Math.PI), '#e8f4f0', { p: [0, 1, 0], r: [Math.PI / 2, 0, 0] }))
  for (const x of [-ancho / 2, ancho / 2]) partes.push(parte(caja(0.04, 1, largo), '#e8f4f0', { p: [x, 0.5, 0] }))
  return unir(partes)
}

// Reservorio: una lámina de agua con borde de tierra (para el modo plan).
export function geomReservorio(radio = 5) {
  const P = PALETA
  return unir([
    parte(cil(radio + 1, radio + 1.4, 0.5, 16), P.tierraClara, { p: [0, 0.1, 0] }),
    parte(cil(radio, radio, 0.08, 16), '#3a8fd1', { p: [0, 0.38, 0] }),
  ])
}

// Árboles. Los nativos del bosque altoandino se distinguen por la silueta:
// el aliso es alto y angosto, el roble redondo, el encenillo de copa partida,
// el sietecueros florece morado. El eucalipto está porque abunda en la zona,
// aunque la finca quiera nativos.
export const TIPOS_ARBOL = ['aliso', 'roble', 'encenillo', 'sietecueros', 'arrayan', 'eucalipto', 'pino', 'frutal']

export function geomArbol(tipo = 'roble') {
  const P = PALETA
  switch (tipo) {
    case 'aliso':
      return unir([parte(cil(0.12, 0.2, 4, 5), P.troncoClaro, { p: [0, 2, 0] }), parte(cono(1.5, 6, 6), '#4f8a3a', { p: [0, 6, 0] }), parte(cono(1.2, 3.5, 6), '#5d9a44', { p: [0, 8.4, 0] })])
    case 'roble':
      return unir([parte(cil(0.2, 0.32, 4, 5), P.tronco, { p: [0, 2, 0] }), parte(bola(2.6, 1), '#4a7f34', { p: [0, 5.6, 0], s: [1, 0.85, 1] }), parte(bola(1.7, 1), '#558c3c', { p: [1.2, 6.6, 0.6] })])
    case 'encenillo':
      return unir([
        parte(cil(0.14, 0.22, 3, 5), P.tronco, { p: [0, 1.5, 0] }),
        parte(bola(1.5, 0), '#3e6e34', { p: [-0.8, 4, 0.3] }),
        parte(bola(1.4, 0), '#467a38', { p: [0.9, 4.6, -0.2] }),
        parte(bola(1.1, 0), '#3a6630', { p: [0, 5.5, 0.4] }),
      ])
    case 'sietecueros':
      return unir([
        parte(cil(0.1, 0.16, 2.4, 5), P.tronco, { p: [0, 1.2, 0] }),
        parte(bola(1.4, 1), '#4c7b3a', { p: [0, 3.3, 0], s: [1, 0.8, 1] }),
        ...[[0.8, 3.9, 0.5], [-0.7, 3.6, -0.6], [0.1, 4.2, -0.3], [-0.4, 3.9, 0.8]].map((p) => parte(bola(0.45, 0), P.morado, { p })),
      ])
    case 'arrayan':
      return unir([parte(cil(0.1, 0.16, 2, 5), '#a0613a', { p: [0, 1, 0] }), parte(bola(1.3, 1), '#3d7031', { p: [0, 2.8, 0], s: [1.2, 0.8, 1.2] })])
    case 'eucalipto':
      return unir([parte(cil(0.15, 0.3, 12, 5), '#b9ad9a', { p: [0, 6, 0] }), parte(bola(2, 0), '#7f9e8c', { p: [0, 13, 0], s: [1, 1.8, 1] })])
    case 'pino':
      return unir([parte(cil(0.15, 0.25, 4, 5), P.tronco, { p: [0, 2, 0] }), parte(cono(2.2, 5, 7), '#2f5a33', { p: [0, 5.5, 0] }), parte(cono(1.6, 4, 7), '#356338', { p: [0, 8, 0] })])
    case 'frutal':
    default:
      return unir([
        parte(cil(0.07, 0.11, 1.4, 5), P.tronco, { p: [0, 0.7, 0] }),
        parte(bola(0.95, 1), '#5a9640', { p: [0, 2, 0] }),
        ...[[0.6, 2.1, 0.5], [-0.5, 1.8, 0.6], [0.3, 2.5, -0.6], [-0.6, 2.3, -0.3]].map((p) => parte(bola(0.13, 0), P.naranja, { p })),
      ])
  }
}

export function geomNube(semilla = 1) {
  const partes = []
  const n = 5 + (semilla % 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + semilla
    const r = 5 + ((semilla * 7 + i * 13) % 5)
    partes.push(parte(bola(r, 1), '#ffffff', { p: [Math.cos(a) * r * 1.2, ((i * 37) % 5) - 1, Math.sin(a) * r * 0.6], s: [1.3, 0.75, 1] }))
  }
  return unir(partes)
}

// Poste de cerca (instanciado a lo largo del lindero).
export function geomPoste() {
  return unir([parte(caja(0.12, 1.5, 0.12), PALETA.maderaOscura, { p: [0, 0.75, 0] })])
}

// ---------- Lo que solo aparece en una finca escaneada ----------

// Marca de un sitio sin modelo propio: un poste con banderín (naranja para un
// sitio cualquiera, azul para el agua, verde para un potrero).
export function geomBandera(color = PALETA.naranja) {
  const P = PALETA
  return unir([
    parte(cil(0.35, 0.45, 0.12, 8), P.concreto, { p: [0, 0.06, 0] }),
    parte(cil(0.06, 0.06, 3.2, 6), P.maderaOscura, { p: [0, 1.6, 0] }),
    parte(caja(0.9, 0.55, 0.04), color, { p: [0.5, 2.85, 0] }),
  ])
}

// Donde se tomó una panorámica: una cámara en su trípode. Al tocarla en el
// mapa se abre la vuelta de fotos.
export function geomCamara() {
  const P = PALETA
  const pata = (ang) => parte(cil(0.04, 0.04, 1.9, 5), P.gris, { p: [Math.cos(ang) * 0.32, 0.9, Math.sin(ang) * 0.32], r: [Math.sin(ang) * 0.34, 0, -Math.cos(ang) * 0.34] })
  return unir([
    pata(0), pata(2.094), pata(4.189),
    parte(caja(0.7, 0.45, 0.4), P.tanque, { p: [0, 2.0, 0] }),
    parte(cil(0.16, 0.16, 0.3, 10), P.vidrio, { p: [0, 2.0, 0.3], r: [Math.PI / 2, 0, 0] }),
    parte(caja(0.2, 0.12, 0.2), P.amarillo, { p: [-0.18, 2.28, 0] }),
  ])
}
