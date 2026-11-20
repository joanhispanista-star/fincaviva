// Arma el relieve de la finca a partir de mosaicos «Terrarium» (los mismos de
// herramientas/terreno.mjs), pero sin Node: así el celular lo baja solo, una
// vez, cuando el dueño toca «Estoy en la finca».
//
// Aquí va solo la cuenta (qué mosaicos hacen falta, cómo se lee la altura de un
// píxel, cómo se llena la rejilla). Quién trae cada mosaico se recibe por
// parámetro: el navegador los pide por internet (mapa/relieve-vivo.js) y las
// pruebas le pasan mosaicos inventados.
//
// Fuente: AWS Terrain Tiles. En Colombia el dato de fondo es SRTM, una medida
// cada ~30 m tomada en el año 2000: da la forma de la ladera, no cada zanja.
// Crédito obligatorio al USGS (ver datos/fuentes-mapa.json).

export const FUENTE_RELIEVE = {
  nombre: 'AWS Terrain Tiles (Terrarium); en Colombia el dato de fondo es SRTM ~30 m',
  plantilla: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  atribucion: 'Relieve: datos SRTM, cortesía del U.S. Geological Survey (AWS Terrain Tiles)',
}

// Lo mismo que hornea la herramienta para el mapa de ejemplo: un cuadro fino
// cerca (3 km, una medida cada 12 m) y uno grueso con las montañas de alrededor.
export const CAPAS_RELIEVE = {
  cerca: { lado: 3000, n: 257, z: 14 },
  paisaje: { lado: 14000, n: 129, z: 12 },
}

const metrosPorGrado = (lat) => ({ lat: 111132.92 - 559.82 * Math.cos((2 * lat * Math.PI) / 180), lon: 111412.84 * Math.cos((lat * Math.PI) / 180) })

// Posición (con decimales) de un punto en la cuadrícula de mosaicos web (Web Mercator).
export function aMosaico(lat, lon, z) {
  const n = 2 ** z
  const r = (lat * Math.PI) / 180
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n }
}

// Fórmula Terrarium: (R·256 + G + B/256) − 32768 metros.
export const alturaTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768

// Los puntos de la rejilla: fila 0 = norte, columna 0 = oeste (así la lee
// mapa/relieve.js: x hacia el este, z hacia el sur).
function puntosRejilla(lat, lon, lado, n, z) {
  const m = metrosPorGrado(lat)
  const pts = new Float64Array(n * n * 2)
  for (let f = 0; f < n; f++)
    for (let c = 0; c < n; c++) {
      const dx = (c / (n - 1) - 0.5) * lado, dz = (f / (n - 1) - 0.5) * lado
      const p = aMosaico(lat - dz / m.lat, lon + dx / m.lon, z)
      pts[(f * n + c) * 2] = p.x * 256 - 0.5
      pts[(f * n + c) * 2 + 1] = p.y * 256 - 0.5
    }
  return pts
}

// Qué mosaicos toca un cuadro de `lado` metros centrado en el punto.
export function mosaicosPara(lat, lon, lado, n, z) {
  const pts = puntosRejilla(lat, lon, lado, n, z)
  const claves = new Set()
  for (let i = 0; i < pts.length; i += 2) {
    const x0 = Math.floor(pts[i]), y0 = Math.floor(pts[i + 1])
    for (const [X, Y] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]]) claves.add(`${z}/${Math.floor(X / 256)}/${Math.floor(Y / 256)}`)
  }
  return [...claves].map((k) => { const [zz, x, y] = k.split('/').map(Number); return { z: zz, x, y } })
}

// Llena la rejilla. `traer(z, x, y)` devuelve { ancho, alto, canales, px }:
// los píxeles de un mosaico de 256 × 256, con 3 o 4 números por píxel.
export async function hornear({ lat, lon, lado, n, z, traer, nombre = 'finca' }) {
  const lista = mosaicosPara(lat, lon, lado, n, z)
  const mosaicos = new Map()
  await Promise.all(lista.map(async (t) => mosaicos.set(`${t.x}/${t.y}`, await traer(t.z, t.x, t.y))))
  const pixel = (X, Y) => {
    const img = mosaicos.get(`${Math.floor(X / 256)}/${Math.floor(Y / 256)}`)
    const i = ((((Y % 256) + 256) % 256) * img.ancho + (((X % 256) + 256) % 256)) * img.canales
    return alturaTerrarium(img.px[i], img.px[i + 1], img.px[i + 2])
  }
  const pts = puntosRejilla(lat, lon, lado, n, z)
  const dm = new Uint16Array(n * n)
  let min = Infinity, max = -Infinity
  for (let k = 0; k < n * n; k++) {
    // Bilineal entre píxeles (y entre mosaicos vecinos).
    const gx = pts[k * 2], gy = pts[k * 2 + 1]
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0
    const h = pixel(x0, y0) * (1 - fx) * (1 - fy) + pixel(x0 + 1, y0) * fx * (1 - fy) + pixel(x0, y0 + 1) * (1 - fx) * fy + pixel(x0 + 1, y0 + 1) * fx * fy
    min = Math.min(min, h)
    max = Math.max(max, h)
    dm[k] = Math.max(0, Math.min(65535, Math.round(h * 10)))
  }
  // Un mosaico mal leído (por ejemplo, con los colores cambiados por el
  // navegador) da alturas absurdas. Mejor fallar que dibujar una montaña falsa.
  if (!(min > -500 && max < 9000)) throw new Error(`El relieve bajó mal: alturas entre ${Math.round(min)} y ${Math.round(max)} m`)
  const centro = dm[Math.floor(n / 2) * n + Math.floor(n / 2)] / 10
  return {
    meta: {
      nombre, lat, lon, lado_m: lado, n, zoom: z,
      formato: 'Uint16, decímetros sobre el nivel del mar; fila 0 = norte, columna 0 = oeste',
      altura_min_m: Math.round(min), altura_max_m: Math.round(max), altura_centro_m: Math.round(centro),
      fuente: FUENTE_RELIEVE.nombre, atribucion: FUENTE_RELIEVE.atribucion, mosaicos: lista.length,
    },
    dm,
  }
}

// Relieve plano a la altura que dio el GPS: lo que se dibuja mientras no se ha
// podido bajar el de verdad (sin señal en la finca). Mejor una mesa plana que
// la montaña de otro sitio.
export function relievePlano(altura_m, { lado, n }, nombre = 'plano') {
  const dm = new Uint16Array(n * n).fill(Math.max(0, Math.min(65535, Math.round((altura_m || 0) * 10))))
  return { meta: { nombre, lado_m: lado, n, plano: true, altura_centro_m: Math.round(altura_m || 0) }, dm }
}

export const aMetrosDeAltura = (dm) => { const a = new Float32Array(dm.length); for (let i = 0; i < dm.length; i++) a[i] = dm[i] / 10; return a }
