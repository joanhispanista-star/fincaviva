// Precios que el campesino ve en tiendas, plazas y ferias.
//
// Existe porque la investigación (investigacion/08-legal-y-mercado.md, sección
// 6) no encontró NINGÚN precio publicado y con fecha del huevo azul, verde o
// criollo al detal. Todo el negocio depende de ese número: el huevo cuesta unos
// $1.000 producirlo y el mayorista paga $536. Antes de comprar una sola gallina
// hay que medir cuánto paga la gente por el huevo de color, y medirlo bien:
// cada precio con su fecha, su lugar y su presentación, llevado a precio por
// huevo para poder comparar una cubeta con una docena.

export const PRESENTACIONES = {
  unidad: { nombre: 'Por unidad', huevos: 1 },
  docena: { nombre: 'Docena', huevos: 12 },
  media: { nombre: 'Media docena', huevos: 6 },
  cubeta: { nombre: 'Cubeta de 30', huevos: 30 },
  otra: { nombre: 'Otra cantidad', huevos: null },
}

export const TIPOS_HUEVO = ['Azul o verde', 'Criollo o campesino', 'Rojo AA', 'Blanco AA', 'Otro']

export function huevosDe(p) {
  return PRESENTACIONES[p.presentacion]?.huevos ?? p.cantidad ?? null
}

export function porHuevo(p) {
  const n = huevosDe(p)
  return n > 0 && p.precio > 0 ? p.precio / n : null
}

export function validarPrecio(p) {
  const problemas = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '')) problemas.push('Falta la fecha')
  if (!p.lugar?.trim()) problemas.push('Escribe dónde lo viste: sin lugar, el precio no se puede volver a comprobar')
  if (!TIPOS_HUEVO.includes(p.tipo)) problemas.push('Escoge qué huevo era')
  if (!PRESENTACIONES[p.presentacion]) problemas.push('Escoge cómo se vendía')
  else if (p.presentacion === 'otra' && !(p.cantidad > 0)) problemas.push('Escribe cuántos huevos traía')
  if (!(p.precio > 0)) problemas.push('El precio tiene que ser mayor que cero')
  const u = porHuevo(p)
  // Un huevo a menos de $100 o a más de $10.000 casi siempre es un cero de más
  // o de menos, o una cubeta anotada como unidad.
  if (u != null && (u < 100 || u > 10000)) problemas.push(`Sale a $${Math.round(u)} por huevo: revisa el precio y la presentación`)
  return problemas
}

// Mediana y no promedio: con pocos datos, una tienda de lujo en Bogotá no debe
// mover la cifra como lo haría en un promedio.
export function resumenPrecios(precios, { tipo = null, desde = null } = {}) {
  const valores = precios
    .filter((p) => (!tipo || p.tipo === tipo) && (!desde || p.fecha >= desde))
    .map(porHuevo)
    .filter((v) => v != null)
    .sort((a, b) => a - b)
  if (!valores.length) return { n: 0, mediana: null, min: null, max: null }
  const m = valores.length >> 1
  const mediana = valores.length % 2 ? valores[m] : (valores[m - 1] + valores[m]) / 2
  return { n: valores.length, mediana, min: valores[0], max: valores[valores.length - 1] }
}
