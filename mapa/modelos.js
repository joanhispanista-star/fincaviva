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
// Gráficos realistas: cada pieza puede decir qué foto la viste (`tex`: 'teja',
// 'pared', 'madera'…). `usarTexturas` recibe de mapa/mundo.js cuántos metros
// cubre una repetición de cada una; sin eso `tex` no hace nada y el modelo
// queda de colores planos, como siempre.
let METROS = {}
export function usarTexturas(indice) {
  METROS = {}
  for (const [clave, d] of Object.entries(indice || {})) if (d.repetible && d.metros) METROS[clave] = d.metros
}

// Dónde cae la foto sobre la pieza, en metros. Una caja ya trae cada cara de 0
// a 1: basta estirarla a lo que mide la cara, y así una teja mide lo mismo en
// el techo de la casa que en cualquier otro, esté como esté de inclinado. Lo
// que no es caja (un hastial, un cilindro) se proyecta de frente.
function coordenadasDeTextura(geom, g, s, metros) {
  const n = g.attributes.position.count
  const uv = new Float32Array(n * 2)
  if (!metros) return uv
  const d = geom.parameters
  if (geom.type === 'BoxGeometry' && g.attributes.uv && n === 36) {
    const x = d.width * s[0], y = d.height * s[1], z = d.depth * s[2]
    const cara = [[z, y], [z, y], [x, z], [x, z], [x, y], [x, y]] // ±x, ±y, ±z, en el orden en que three.js arma la caja
    const o = g.attributes.uv.array
    for (let i = 0; i < n; i++) {
      const [a, b] = cara[Math.floor(i / 6)]
      uv[i * 2] = (o[i * 2] * a) / metros
      uv[i * 2 + 1] = (o[i * 2 + 1] * b) / metros
    }
  } else {
    const q = g.attributes.position.array
    for (let i = 0; i < n; i++) {
      uv[i * 2] = (q[i * 3] + q[i * 3 + 2]) / metros
      uv[i * 2 + 1] = q[i * 3 + 1] / metros
    }
  }
  return uv
}

export function parte(geom, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], tex = '' } = {}) {
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
  const viste = METROS[tex] ? tex : ''
  g.setAttribute('uv', new THREE.BufferAttribute(coordenadasDeTextura(geom, g, s, METROS[viste]), 2))
  g.userData.tex = viste
  return g
}

// Sombreado por altura (gráficos nuevos del estilo Juguete): cada modelo sale
// un poco más oscuro abajo y más claro arriba, como si el suelo le quitara luz.
// Se hornea en el color de los vértices: no le cuesta nada al teléfono. Lo
// prende mapa/mundo.js antes de armar los modelos.
let SOMBREADO = false
export function sombreadoPorAltura(encendido) {
  SOMBREADO = !!encendido
}

export function unir(piezas, { sombreado = SOMBREADO } = {}) {
  // Las piezas se juntan por textura: cada tanda es un «grupo» de la geometría
  // y se dibuja con su material (ver `poner` en mapa/mundo.js). Sin texturas
  // queda un solo grupo y nada cambia.
  const tanda = (g) => g.userData.tex || ''
  const partes = [...piezas].sort((a, b) => (tanda(a) < tanda(b) ? -1 : tanda(a) > tanda(b) ? 1 : 0))
  let total = 0
  for (const g of partes) total += g.attributes.position.count
  const pos = new Float32Array(total * 3)
  const nor = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  const uv = new Float32Array(total * 2)
  const r = new THREE.BufferGeometry()
  const texturas = []
  let o = 0, inicio = 0
  for (const g of partes) {
    if (!texturas.length || texturas[texturas.length - 1] !== tanda(g)) {
      if (texturas.length) r.addGroup(inicio, o - inicio, texturas.length - 1)
      texturas.push(tanda(g))
      inicio = o
    }
    pos.set(g.attributes.position.array, o * 3)
    nor.set(g.attributes.normal.array, o * 3)
    col.set(g.attributes.color.array, o * 3)
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2)
    o += g.attributes.position.count
  }
  r.addGroup(inicio, o - inicio, texturas.length - 1)
  if (texturas.length === 1 && !texturas[0]) r.clearGroups()
  r.userData.texturas = texturas
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  r.setAttribute('color', new THREE.BufferAttribute(col, 3))
  r.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  r.computeBoundingSphere()
  r.computeBoundingBox()
  const y0 = r.boundingBox.min.y, alto = r.boundingBox.max.y - y0
  if (sombreado && alto > 0.05) {
    for (let i = 0; i < total; i++) {
      const k = 0.74 + 0.34 * Math.pow((pos[i * 3 + 1] - y0) / alto, 0.75)
      col[i * 3] = Math.min(1, col[i * 3] * k)
      col[i * 3 + 1] = Math.min(1, col[i * 3 + 1] * k)
      col[i * 3 + 2] = Math.min(1, col[i * 3 + 2] * k)
    }
  }
  return r
}

const caja = (x, y, z) => new THREE.BoxGeometry(x, y, z)
const cil = (rArriba, rAbajo, h, lados = 8) => new THREE.CylinderGeometry(rArriba, rAbajo, h, lados)
const bola = (r, detalle = 1) => new THREE.IcosahedronGeometry(r, detalle)
const cono = (r, h, lados = 7) => new THREE.ConeGeometry(r, h, lados)

// Techo a dos aguas: dos láminas inclinadas con alero. La cumbrera va a lo largo de x.
function techo(ancho, fondo, altoParedes, subida, color, alero = 0.35, grosor = 0.08, tex = '') {
  const mitad = fondo / 2 + alero
  const largo = Math.hypot(mitad, subida)
  const ang = Math.atan2(subida, mitad)
  const aguas = [
    parte(caja(ancho + alero * 2, grosor, largo), color, { p: [0, altoParedes + subida / 2, mitad / 2 - alero / 2 + 0.02], r: [ang, 0, 0], tex }),
    parte(caja(ancho + alero * 2, grosor, largo), color, { p: [0, altoParedes + subida / 2, -mitad / 2 + alero / 2 - 0.02], r: [-ang, 0, 0], tex }),
  ]
  // Con foto hace falta el caballete. Las dos láminas se cruzan en la cumbrera
  // y el canto de cada una (unos centímetros) muestra una sola tira de la foto
  // a todo lo largo: dos rayas claras encima del techo. El caballete las tapa,
  // como en un techo de verdad, y va sin foto para no repetir el problema en
  // sus propios cantos. Sin foto los cantos son del color del techo y no se
  // nota: el modelo queda como siempre.
  if (METROS[tex]) aguas.push(parte(caja(ancho + alero * 2, grosor + 0.06, alero + 0.1), new THREE.Color(color).multiplyScalar(0.72), { p: [0, altoParedes + subida + 0.05, 0] }))
  return aguas
}

// Hastial: el triángulo de pared bajo el techo, como prisma que llena el entretecho.
function hastiales(ancho, fondo, altoParedes, subida, color, tex = '') {
  const forma = new THREE.Shape([new THREE.Vector2(-fondo / 2, 0), new THREE.Vector2(fondo / 2, 0), new THREE.Vector2(0, subida)])
  const g = new THREE.ExtrudeGeometry(forma, { depth: ancho, bevelEnabled: false })
  // La forma queda en XY y se extruye en Z; girada 90° queda el triángulo en ZY
  // con la punta arriba, y la extrusión a lo ancho de la casa (eje X).
  g.rotateY(Math.PI / 2)
  g.translate(-ancho / 2, altoParedes, 0)
  return parte(g, color, { tex })
}

export function geomGalpon({ ancho = 4, fondo = 3, alto = 2.2 } = {}) {
  const P = PALETA
  const zocalo = alto * 0.5
  const partes = [
    parte(caja(ancho + 0.4, 0.15, fondo + 0.4), P.concreto, { p: [0, 0.075, 0], tex: 'concreto' }),
    parte(caja(ancho, zocalo, fondo), P.madera, { p: [0, 0.15 + zocalo / 2, 0], tex: 'madera' }),
    // Malla arriba: ventila el amoníaco sin dejar entrar al zorro.
    parte(caja(ancho - 0.06, alto - zocalo - 0.15, fondo - 0.06), P.malla, { p: [0, 0.15 + zocalo + (alto - zocalo - 0.15) / 2, 0] }),
    parte(caja(0.8, 1.7, 0.06), P.puerta, { p: [ancho * 0.25, 0.15 + 0.85, fondo / 2 + 0.03] }),
    // Postes de las esquinas.
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => parte(caja(0.12, alto, 0.12), P.maderaOscura, { p: [sx * (ancho / 2), alto / 2 + 0.15, sz * (fondo / 2)] }))),
    // Nidales por fuera, del lado oriental (se recogen los huevos sin entrar).
    parte(caja(0.5, 0.45, fondo * 0.7), P.maderaOscura, { p: [-ancho / 2 - 0.25, 0.9, 0] }),
    parte(caja(0.62, 0.06, fondo * 0.75), P.zinc, { p: [-ancho / 2 - 0.27, 1.16, 0], r: [0, 0, -0.35] }),
    ...techo(ancho, fondo, alto + 0.15, 0.9, P.zinc, 0.35, 0.08, 'zinc'),
    hastiales(ancho, fondo, alto + 0.15, 0.9, P.madera, 'madera'),
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
    parte(caja(ancho + 2.2, 0.2, fondo + 0.6), P.concreto, { p: [0, 0.1, 0.9], tex: 'concreto' }),
    parte(caja(ancho, alto, fondo), P.pared, { p: [0, 0.2 + alto / 2, 0], tex: 'pared' }),
    parte(caja(ancho + 0.02, 0.6, fondo + 0.02), P.zocalo, { p: [0, 0.5, 0], tex: 'pared' }),
    parte(caja(1, 2, 0.06), P.puerta, { p: [0, 1.2, fondo / 2 + 0.03] }),
    ...[-2.8, 2.8].map((x) => parte(caja(1.2, 1, 0.06), P.vidrio, { p: [x, 1.7, fondo / 2 + 0.03] })),
    ...[-2.8, 2.8].map((x) => parte(caja(1.4, 1.2, 0.04), P.zocalo, { p: [x, 1.7, fondo / 2 + 0.01] })),
    ...techo(ancho, fondo + 2.2, alto + 0.2, 1.5, P.teja, 0.5, 0.12, 'teja').map((g) => {
      g.translate(0, 0, 1.1)
      return g
    }),
    // El techo cubre también el corredor, así que su triángulo va corrido hacia el frente.
    hastiales(ancho, fondo + 2.2, alto + 0.2, 1.5, P.pared, 'pared').translate(0, 0, 1.1),
    // Corredor: postes de madera bajo el alero.
    ...[-4, -1.3, 1.3, 4].map((x) => parte(caja(0.15, alto, 0.15), P.maderaOscura, { p: [x, 0.2 + alto / 2, fondo / 2 + 1.6], tex: 'madera' })),
    // Chimenea del fogón de leña.
    parte(caja(0.6, 1.4, 0.6), P.tejaOscura, { p: [ancho / 2 - 1.2, alto + 1.4, -1] }),
  ]
  return unir(partes)
}

// Dónde va cada mata de una cama: [x, z, fila, puesto], en metros desde el
// centro. El maíz va más ralo (dos surcos); lo demás, a tres. Lo comparten el
// dibujo de siempre y el realista (mapa/mundo.js), que pone una lámina con foto
// en cada puesto: la huerta tiene las mismas matas con los dos.
export function puestosDeCama(largo = 4, ancho = 1.2, cultivo = 'hoja') {
  const filas = cultivo === 'maiz' ? 2 : 3
  const porFila = Math.floor(largo / (cultivo === 'maiz' ? 0.5 : 0.35))
  const puestos = []
  for (let f = 0; f < filas; f++)
    for (let k = 0; k < porFila; k++) puestos.push([(f / (filas - 1) - 0.5) * (ancho - 0.4), (k / (porFila - 1) - 0.5) * (largo - 0.4), f, k])
  return puestos
}

// Cama de huerta elevada, con borde de madera, y sus plantas. `matas: false`
// deja solo la cama: las plantas las pone quien la pidió (gráficos realistas).
export function geomCama(largo = 4, ancho = 1.2, cultivo = 'hoja', { matas = true } = {}) {
  const P = PALETA
  const partes = [
    parte(caja(ancho, 0.25, largo), P.maderaOscura, { p: [0, 0.125, 0], tex: 'madera' }),
    parte(caja(ancho - 0.12, 0.06, largo - 0.12), P.tierra, { p: [0, 0.27, 0], tex: 'tierra' }),
  ]
  for (const [x, z, f, k] of matas ? puestosDeCama(largo, ancho, cultivo) : []) {
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
  return unir(partes)
}

// Compostera de tres cajones: entra, madura, sale.
export function geomCompostera() {
  const P = PALETA
  const partes = []
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.15
    for (const dz of [-0.5, 0.5]) partes.push(parte(caja(1.05, 0.9, 0.06), P.madera, { p: [x, 0.45, dz], tex: 'madera' }))
    partes.push(parte(caja(0.06, 0.9, 1.05), P.madera, { p: [x - 0.52, 0.45, 0], tex: 'madera' }))
    partes.push(parte(bola(0.48, 1), i === 2 ? P.tierra : P.tierraClara, { p: [x, 0.45 - i * 0.1, 0], s: [1, 0.55 + (2 - i) * 0.15, 1] }))
  }
  partes.push(parte(caja(0.06, 0.9, 1.05), P.madera, { p: [1.7, 0.45, 0], tex: 'madera' }))
  return unir(partes)
}

// El lombricultivo va en dos piezas: el lecho con sus postes, y el techo de
// paja aparte, porque al acercar la cámara el techo se desvanece para dejar ver
// las lombrices (mapa/vida.js). El lecho mide por dentro 0,98 × 2,9 m y su
// tierra queda a LECHO_LOMBRIZ.y del piso: de ahí salen las lombrices.
export const LECHO_LOMBRIZ = { ancho: 0.98, largo: 2.9, y: 0.485 }

function partesLecho() {
  const P = PALETA
  return [
    parte(caja(1.1, 0.45, 3), P.madera, { p: [0, 0.225, 0], tex: 'madera' }),
    parte(caja(0.98, 0.05, 2.9), P.tierra, { p: [0, 0.46, 0], tex: 'tierra' }),
    ...[-1, 1].flatMap((sz) => [-1, 1].map((sx) => parte(caja(0.08, 1.4, 0.08), P.maderaOscura, { p: [sx * 0.6, 0.7, sz * 1.45] }))),
  ]
}
const partesTecho = () => [parte(caja(1.6, 0.05, 3.4), PALETA.paja, { p: [0, 1.42, 0], r: [0, 0, 0.12], tex: 'paja' })]

// De una sola pieza: así se dibuja el que todavía es «plan».
export function geomLombricultivo() {
  return unir([...partesLecho(), ...partesTecho()])
}

export function geomLombricultivoPartes() {
  const P = PALETA
  // Lo que comen: cáscaras y sobras de cocina sobre la tierra. Se ven solo de cerca.
  const sobras = [
    [-0.28, -1.05, P.hojaClara, 0.4], [0.22, -0.62, P.naranja, 1.1], [-0.1, -0.2, P.pared, 2.0], [0.3, 0.35, P.hoja, 0.7],
    [-0.3, 0.75, P.amarillo, 1.6], [0.12, 1.1, P.hojaClara, 2.6], [-0.18, 1.25, P.pared, 0.2], [0.33, -1.2, P.hojaOscura, 1.9],
  ].map(([x, z, color, giro]) => parte(caja(0.11, 0.012, 0.07), color, { p: [x, LECHO_LOMBRIZ.y + 0.006, z], r: [0, giro, 0] }))
  return {
    lecho: unir([...partesLecho(), ...sobras]),
    // El techo no lleva sombreado por altura: es una lámina, quedaría de un solo tono igual.
    techo: unir(partesTecho(), { sombreado: false }),
  }
}

// Un anillo de lombriz: cada lombriz son varios, que se mueven uno tras otro.
export function geomAnilloLombriz() {
  return unir([parte(bola(1, 0), PALETA.blanco)], { sombreado: false })
}

// La vaca va en cuatro geometrías blancas que se tiñen por instancia: el cuerpo
// y la cabeza con el color del pelo, las manchas con el suyo, y las patas (una
// geometría, cuatro por vaca) para que caminen. Lo que debe quedar oscuro o
// rosado con cualquier pelo (pezuñas, ojos, hocico, ubre) lleva ese tono en el
// vértice y el tinte solo lo multiplica.
// Mira hacia +x. La cabeza tiene el origen en la base del cuello y las patas en
// la cadera: quien las dibuja las pone en VACA.cuello y VACA.caderas y las gira.
export const VACA = {
  cuello: [0.7, 1.08, 0],
  caderas: [[0.55, 0.74, 0.22], [0.55, 0.74, -0.22], [-0.6, 0.74, 0.22], [-0.6, 0.74, -0.22]],
  cabezaArriba: 0.3, // rad sobre el lomo
  cabezaAbajo: -1.15, // rad: el hocico llega al pasto
}

export function geomVaca() {
  const B = PALETA.blanco, oscuro = '#2e2a28', rosado = '#f2b8b4'
  // Las cuatro son piezas que se tiñen y se mueven sueltas: sin sombreado por
  // altura, que oscurecería cada pata desde su propia punta.
  const suelta = { sombreado: false }
  const cuerpo = unir([
    parte(caja(1.55, 0.72, 0.66), B, { p: [0, 1.02, 0] }),
    parte(bola(0.42, 1), B, { p: [-0.05, 0.86, 0], s: [1.5, 0.75, 0.86] }),
    parte(bola(0.3, 0), B, { p: [0.55, 1.36, 0], s: [1, 0.6, 0.9] }),
    parte(caja(0.05, 0.62, 0.05), B, { p: [-0.81, 1.04, 0], r: [0, 0, -0.12] }),
    parte(caja(0.09, 0.16, 0.09), oscuro, { p: [-0.86, 0.67, 0] }),
    parte(bola(0.17, 0), rosado, { p: [-0.35, 0.62, 0], s: [1.2, 0.8, 1] }),
  ], suelta)
  // Un poco más anchas que el cuerpo, para que no parpadeen contra él.
  const manchas = unir([
    parte(caja(0.42, 0.74, 0.69), B, { p: [0.36, 1.02, 0] }),
    parte(caja(0.5, 0.4, 0.69), B, { p: [-0.45, 1.19, 0] }),
  ], suelta)
  const cabeza = unir([
    parte(caja(0.6, 0.34, 0.28), B, { p: [0.3, 0, 0] }),
    parte(caja(0.46, 0.32, 0.32), B, { p: [0.72, 0.03, 0] }),
    parte(caja(0.14, 0.22, 0.28), rosado, { p: [1.0, -0.02, 0] }),
    ...[-1, 1].map((s) => parte(caja(0.07, 0.11, 0.2), B, { p: [0.52, 0.17, s * 0.24], r: [s * 0.4, 0, 0] })),
    ...[-1, 1].map((s) => parte(caja(0.04, 0.06, 0.03), oscuro, { p: [0.8, 0.1, s * 0.165] })),
  ], suelta)
  const pata = unir([
    parte(caja(0.14, 0.66, 0.14), B, { p: [0, -0.33, 0] }),
    parte(caja(0.15, 0.09, 0.15), oscuro, { p: [0, -0.695, 0] }),
  ], suelta)
  return { cuerpo, manchas, cabeza, pata }
}

// Garza del ganado: blanca, pico amarillo y patas largas hacia atrás. Es la que
// anda con las vacas de la Sabana y cruza en bandadas. El cuerpo mira hacia +x;
// el ala es una sola geometría (nace en el origen y se abre hacia +z) que se
// usa dos veces por pájaro y se gira para aletear.
export function geomPajaro() {
  const P = PALETA
  const cuerpo = unir([
    parte(bola(0.11, 0), P.blanco, { s: [2.2, 0.8, 0.8] }),
    parte(caja(0.2, 0.05, 0.05), P.blanco, { p: [0.32, 0.03, 0] }),
    parte(cono(0.03, 0.14, 4), P.amarillo, { p: [0.48, 0.03, 0], r: [0, 0, -Math.PI / 2] }),
    parte(caja(0.3, 0.02, 0.03), '#4a4a44', { p: [-0.36, -0.03, 0] }),
  ], { sombreado: false })
  const ala = unir([
    parte(caja(0.24, 0.02, 0.34), P.blanco, { p: [0, 0, 0.19] }),
    parte(caja(0.16, 0.02, 0.28), '#e9e9e4', { p: [-0.02, 0, 0.48] }),
  ], { sombreado: false })
  return { cuerpo, ala }
}

// ---------- Detalle del suelo (gráficos nuevos del estilo Juguete) ----------
// Van por miles, instanciados y sin sombra propia: por eso cada uno son unos
// pocos triángulos sueltos y no un modelo. Cada triángulo va dos veces, una por
// cara: con un material «de dos caras» three.js le voltea la normal a la cara
// de atrás y media mata sale negra, alumbrada desde el suelo.

function triangulos(lista) {
  const pos = [], col = []
  const c = new THREE.Color()
  for (const [a, b, d, [ka, kb, kd]] of lista) {
    pos.push(...a, ...b, ...d, ...a, ...d, ...b)
    for (const k of [ka, kb, kd, ka, kd, kb]) {
      c.set(k)
      col.push(c.r, c.g, c.b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  // Todas las normales hacia arriba: una hoja recibe la misma luz que el suelo
  // donde crece. Con su normal de verdad (de lado) cada mata salía casi negra.
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  return g
}

// Mata de pasto: cuatro hojas cortas, del verde del potrero abajo y claras en la punta.
export function geomMata() {
  const base = '#63a83c', punta = '#9fd65e'
  return triangulos([[0.3, 0.4, 0.16], [1.9, 0.3, 0.2], [3.4, 0.36, 0.14], [4.9, 0.27, 0.21]].map(([a, alto, cae]) => {
    const cx = Math.cos(a), cz = Math.sin(a)
    return [[-cz * 0.09, 0, cx * 0.09], [cz * 0.09, 0, -cx * 0.09], [cx * cae, alto, cz * cae], [base, base, punta]]
  }))
}

// Flor de potrero (diente de león, trébol): el tallo y un rombo que se tiñe por instancia.
export function geomFlor() {
  const tallo = '#6fae4a', B = '#ffffff'
  return triangulos([
    [[-0.02, 0, 0], [0.02, 0, 0], [0, 0.24, 0], [tallo, tallo, tallo]],
    [[-0.09, 0.25, 0], [0, 0.27, 0.09], [0.09, 0.25, 0], [B, B, B]],
    [[-0.09, 0.25, 0], [0.09, 0.25, 0], [0, 0.27, -0.09], [B, B, B]],
  ])
}

export function geomPiedra() {
  return unir([parte(bola(0.3, 0), '#9d998f', { p: [0, 0.08, 0], s: [1.25, 0.6, 1] })], { sombreado: false })
}

// Tanque de 1.000 litros sobre su base: recoge la lluvia del techo.
export function geomTanque({ azul = false } = {}) {
  const P = PALETA
  return unir([
    parte(caja(1.5, 0.6, 1.5), P.concreto, { p: [0, 0.3, 0], tex: 'concreto' }),
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
  return unir([parte(caja(0.12, 1.5, 0.12), PALETA.maderaOscura, { p: [0, 0.75, 0], tex: 'madera' })])
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
