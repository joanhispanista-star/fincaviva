// Relieve real de la finca: carga la rejilla horneada y responde «¿qué altura
// hay en (x, z)?» en metros locales (x hacia el este, z hacia el sur, origen en
// el centro de la finca). Todo lo que se pone en el mapa se apoya aquí.

export async function cargarRelieve(base, nombre) {
  const [metaR, binR] = await Promise.all([fetch(`${base}datos/terreno-${nombre}.json`), fetch(`${base}datos/terreno-${nombre}.bin`)])
  if (!metaR.ok || !binR.ok) throw new Error(`No encontré el relieve «${nombre}»`)
  const meta = await metaR.json()
  const dm = new Uint16Array(await binR.arrayBuffer())
  const alturas = new Float32Array(dm.length)
  for (let i = 0; i < dm.length; i++) alturas[i] = dm[i] / 10
  return crearRelieve(meta, alturas)
}

export function crearRelieve(meta, alturas) {
  const n = meta.n
  const lado = meta.lado_m
  const paso = lado / (n - 1)
  const celda = (f, c) => alturas[Math.max(0, Math.min(n - 1, f)) * n + Math.max(0, Math.min(n - 1, c))]

  // Bilineal: rápida, para apoyar objetos.
  function alturaEn(x, z) {
    const gc = (x / lado + 0.5) * (n - 1)
    const gf = (z / lado + 0.5) * (n - 1)
    const c0 = Math.floor(gc), f0 = Math.floor(gf)
    const tc = gc - c0, tf = gf - f0
    const a = celda(f0, c0), b = celda(f0, c0 + 1), c = celda(f0 + 1, c0), d = celda(f0 + 1, c0 + 1)
    return a * (1 - tc) * (1 - tf) + b * tc * (1 - tf) + c * (1 - tc) * tf + d * tc * tf
  }

  // Catmull-Rom: más suave, para rehacer la malla con más detalle que el dato
  // de 30 m sin que aparezcan escalones.
  const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  function alturaSuave(x, z) {
    const gc = (x / lado + 0.5) * (n - 1)
    const gf = (z / lado + 0.5) * (n - 1)
    const c0 = Math.floor(gc), f0 = Math.floor(gf)
    const tc = gc - c0, tf = gf - f0
    const filas = []
    for (let k = -1; k <= 2; k++) filas.push(cr(celda(f0 + k, c0 - 1), celda(f0 + k, c0), celda(f0 + k, c0 + 1), celda(f0 + k, c0 + 2), tc))
    return cr(filas[0], filas[1], filas[2], filas[3], tf)
  }

  // Pendiente en % y dirección hacia donde baja (0 = norte, 90 = este).
  function pendienteEn(x, z, e = paso) {
    const gx = (alturaEn(x + e, z) - alturaEn(x - e, z)) / (2 * e)
    const gz = (alturaEn(x, z + e) - alturaEn(x, z - e)) / (2 * e)
    return { pct: Math.hypot(gx, gz) * 100, baja: (Math.atan2(-gx, gz) * 180 / Math.PI + 360) % 360 }
  }

  return { meta, n, lado, paso, alturas, alturaEn, alturaSuave, pendienteEn, hCentro: alturaEn(0, 0) }
}
