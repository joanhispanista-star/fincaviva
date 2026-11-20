// Fechas en hora de Colombia, sin depender del reloj del teléfono ni de su zona.
//
// Por qué no usar la fecha local del aparato: si el teléfono quedó en otra zona
// (pasa con iPhones configurados en viajes) el huevo de las 7 p. m. se anota al
// día siguiente y la postura del día sale mal. Colombia es UTC−5 todo el año
// (no tiene horario de verano), así que basta restar cinco horas.
// Las fechas de los registros se guardan como texto 'AAAA-MM-DD': se ordenan bien
// como cadena y no arrastran horas ni zonas.

const DESFASE_MS = 5 * 3600 * 1000
const DIA_MS = 86400000

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function hoyISO(ahora = new Date()) {
  return new Date(ahora.getTime() - DESFASE_MS).toISOString().slice(0, 10)
}

// 'AAAA-MM-DD' → milisegundos del mediodía de ese día en Colombia (mediodía para
// que ningún redondeo lo pase de día).
export function aMs(iso) {
  return Date.parse(iso + 'T12:00:00-05:00')
}

export function deMs(ms) {
  return hoyISO(new Date(ms))
}

export function sumarDias(iso, n) {
  return deMs(aMs(iso) + n * DIA_MS)
}

export function diasEntre(desde, hasta) {
  return Math.round((aMs(hasta) - aMs(desde)) / DIA_MS)
}

export function diaSemana(iso) {
  return new Date(aMs(iso)).getUTCDay() // a mediodía de Colombia ya es el mismo día en UTC
}

// Lunes de la semana de la fecha (en Colombia la semana arranca el lunes).
export function inicioSemana(iso) {
  const d = diaSemana(iso)
  return sumarDias(iso, d === 0 ? -6 : 1 - d)
}

export function mesDe(iso) {
  return iso.slice(0, 7)
}

export function rangoMes(iso) {
  const [a, m] = iso.split('-').map(Number)
  const desde = `${a}-${String(m).padStart(2, '0')}-01`
  const siguiente = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`
  return { desde, hasta: sumarDias(siguiente, -1) }
}

export function diasDelMes(iso) {
  const { desde, hasta } = rangoMes(iso)
  return diasEntre(desde, hasta) + 1
}

export function fechaLarga(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${DIAS[diaSemana(iso)]} ${d} de ${MESES[m - 1]}`
}

export function fechaCorta(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES_CORTOS[m - 1]}`
}

// ¿La fecha cae dentro del rango (ambos extremos incluidos)? Comparar cadenas ISO es exacto.
export function enRango(iso, desde, hasta) {
  return (!desde || iso >= desde) && (!hasta || iso <= hasta)
}
