// El juego de la finca.
//
// Regla de oro: TODO sale de lo anotado. No hay monedas inventadas ni puntos
// regalados. La experiencia (XP) premia ANOTAR, porque sin datos no hay costo
// por huevo ni utilidad; y el marcador de verdad es la utilidad del mes, en
// pesos. Si se borra un registro se pierde su XP: el juego no puede mentir más
// que el libro de cuentas.
//
// Se premia la constancia más que el volumen: un día con datos vale lo mismo con
// un registro que con veinte. Si no, el juego empuja a anotar de a poquitos.

import { hoyISO, inicioSemana, sumarDias, enRango, rangoMes, mesDe } from './fechas.js'
import { resumen, indicadoresGallinas, avesVivas } from './libro.js'

// Ritmo medido con la finca de prueba: quien anota todos los días, vende dos
// veces por semana y cumple misiones gana unos 250 XP por semana. Así sube de
// nivel cada 2 o 3 semanas al principio y llega al último en casi dos años: el
// juego dura lo que tarda una finca en volverse autosuficiente.
export const NIVELES = [
  { nombre: 'Semilla', xp: 0, emoji: '🌰' },
  { nombre: 'Germinado', xp: 300, emoji: '🌱' },
  { nombre: 'Plántula', xp: 750, emoji: '🌿' },
  { nombre: 'Retoño', xp: 1500, emoji: '🪴' },
  { nombre: 'Mata', xp: 2700, emoji: '🌾' },
  { nombre: 'Arbusto', xp: 4500, emoji: '🌳' },
  { nombre: 'Árbol', xp: 7200, emoji: '🌲' },
  { nombre: 'Bosque', xp: 10800, emoji: '🏞️' },
  { nombre: 'Montaña', xp: 15600, emoji: '⛰️' },
  { nombre: 'Páramo', xp: 22500, emoji: '🌄' },
]

export const XP = {
  dia_anotado: 10,
  venta: 15,
  compra: 5,
  gasto: 3,
  tecnica: { 1: 30, 2: 60, 3: 100 },
  tarea: 10,
  arbol: 2,
  precio: 5, // antes de tener gallinas, medir el mercado es el trabajo
}

const esHuevo = (p) => typeof p === 'string' && p.startsWith('huevo')
const tiposPorSistema = (estado) => Object.fromEntries(estado.sistemas.map((s) => [s.id, s.tipo]))

export function arbolesSembrados(estado, desde = null, hasta = null) {
  const tipos = tiposPorSistema(estado)
  let n = 0
  for (const r of estado.registros) {
    if (r.tipo === 'siembra' && tipos[r.sistemaId] === 'bosque' && enRango(r.fecha, desde, hasta)) n += r.datos?.cantidad || 0
  }
  return n
}

export function huevosTotales(estado, desde = null, hasta = null) {
  let n = 0
  for (const r of estado.registros) if (r.tipo === 'produccion' && esHuevo(r.datos?.producto) && enRango(r.fecha, desde, hasta)) n += r.datos.cantidad || 0
  return n
}

// Días seguidos con algo anotado, contando hasta hoy. Si hoy todavía no se ha
// anotado, la racha no se rompe hasta mañana: nadie anota los huevos a las 6 a. m.
export function racha(estado, hoy = hoyISO()) {
  const dias = new Set(estado.registros.map((r) => r.fecha))
  let d = dias.has(hoy) ? hoy : sumarDias(hoy, -1)
  let n = 0
  while (dias.has(d)) {
    n++
    d = sumarDias(d, -1)
  }
  return n
}

export function rachaMaxima(estado) {
  const dias = [...new Set(estado.registros.map((r) => r.fecha))].sort()
  let max = 0
  let actual = 0
  let previo = null
  for (const d of dias) {
    actual = previo && sumarDias(previo, 1) === d ? actual + 1 : 1
    max = Math.max(max, actual)
    previo = d
  }
  return max
}

function primeraFecha(estado) {
  let p = null
  const ver = (f) => { if (f && (!p || f < p)) p = f }
  for (const c of ['registros', 'ventas', 'compras', 'gastos', 'tecnicas']) for (const x of estado[c]) ver(x.fecha)
  for (const t of estado.tareas) if (t.hecha) ver(t.fecha_hecha)
  return p
}

// ---------- Misiones de la semana ----------
// Se eligen según el momento de la finca: sin gallinas, las misiones empujan el
// plan de arranque; con gallinas, empujan a anotar y a vender. Máximo cuatro,
// para que se puedan cumplir.
function medirSemana(estado, lunes) {
  const domingo = sumarDias(lunes, 6)
  const tipos = tiposPorSistema(estado)
  const conAves = estado.sistemas.filter((s) => s.tipo === 'gallinas' && avesVivas(estado, s.id, domingo) > 0)
  const diasHuevos = new Set()
  const diasAlimento = new Set()
  for (const r of estado.registros) {
    if (!enRango(r.fecha, lunes, domingo)) continue
    if (r.tipo === 'produccion' && esHuevo(r.datos?.producto)) diasHuevos.add(r.fecha)
    if (r.tipo === 'alimentacion' && tipos[r.sistemaId] === 'gallinas') diasAlimento.add(r.fecha)
  }
  return {
    lunes,
    domingo,
    conAves,
    diasHuevos: diasHuevos.size,
    diasAlimento: diasAlimento.size,
    ventas: estado.ventas.filter((v) => enRango(v.fecha, lunes, domingo)).length,
    tecnicas: estado.tecnicas.filter((t) => enRango(t.fecha, lunes, domingo)).length,
    pasosPlan: estado.tareas.filter((t) => t.origen === 'plan' && t.hecha && enRango(t.fecha_hecha, lunes, domingo)).length,
    arboles: arbolesSembrados(estado, lunes, domingo),
  }
}

const CATALOGO = [
  { id: 'huevos-7', emoji: '🥚', xp: 50, meta: 7, aplica: (s) => s.conAves.length > 0, texto: 'Anota los huevos los 7 días de la semana', valor: (s) => s.diasHuevos },
  { id: 'alimento-7', emoji: '🌽', xp: 40, meta: 7, aplica: (s) => s.conAves.length > 0, texto: 'Anota el alimento los 7 días: sin eso no hay costo por huevo', valor: (s) => s.diasAlimento },
  { id: 'plan-2', emoji: '🏗️', xp: 40, meta: 2, aplica: (s) => s.conAves.length === 0, texto: 'Avanza 2 pasos del plan de arranque', valor: (s) => s.pasosPlan },
  { id: 'vender-2', emoji: '💰', xp: 40, meta: 2, aplica: (s) => s.conAves.length > 0, texto: 'Haz 2 ventas esta semana', valor: (s) => s.ventas },
  { id: 'arboles-5', emoji: '🌳', xp: 40, meta: 5, aplica: () => true, texto: 'Siembra 5 árboles nativos', valor: (s) => s.arboles },
  { id: 'tecnica-1', emoji: '📚', xp: 30, meta: 1, aplica: () => true, texto: 'Pon en práctica una técnica de Aprende', valor: (s) => s.tecnicas },
]

export function misionesDeSemana(estado, lunes) {
  const s = medirSemana(estado, lunes)
  const lista = []
  // La misión estrella: bajar el costo del huevo frente a la semana pasada. Solo
  // aparece cuando hay con qué comparar (huevos y costos anotados la semana anterior).
  const gallinero = s.conAves[0]
  if (gallinero) {
    const antes = indicadoresGallinas(estado, gallinero.id, sumarDias(lunes, -7), sumarDias(lunes, -1)).costo_por_huevo
    if (antes > 0) {
      const meta = Math.floor(antes * 0.97)
      const ahora = indicadoresGallinas(estado, gallinero.id, lunes, s.domingo).costo_por_huevo
      lista.push({
        id: 'costo-huevo', emoji: '📉', xp: 80, meta, valor: ahora,
        texto: `Baja el costo del huevo de $${Math.round(antes).toLocaleString('es-CO')} a $${meta.toLocaleString('es-CO')}`,
        hecha: ahora != null && ahora <= meta,
        progreso: ahora == null ? 0 : Math.max(0, Math.min(1, (antes - ahora) / (antes - meta || 1))),
      })
    }
  }
  for (const m of CATALOGO) {
    if (lista.length >= 4) break
    if (!m.aplica(s)) continue
    const valor = m.valor(s)
    lista.push({ id: m.id, emoji: m.emoji, xp: m.xp, meta: m.meta, valor, texto: m.texto, hecha: valor >= m.meta, progreso: Math.min(1, valor / m.meta) })
  }
  return lista
}

// ---------- Experiencia y nivel ----------
export function calcularXP(estado, hoy = hoyISO()) {
  const detalle = []
  const fila = (concepto, cantidad, xp) => detalle.push({ concepto, cantidad, xp })
  const dias = new Set(estado.registros.map((r) => r.fecha)).size
  fila('Días con algo anotado', dias, dias * XP.dia_anotado)
  fila('Ventas anotadas', estado.ventas.length, estado.ventas.length * XP.venta)
  fila('Compras anotadas', estado.compras.length, estado.compras.length * XP.compra)
  fila('Gastos anotados', estado.gastos.length, estado.gastos.length * XP.gasto)
  const precios = estado.precios?.length || 0
  fila('Precios del mercado anotados', precios, precios * XP.precio)
  fila('Técnicas puestas en práctica', estado.tecnicas.length, estado.tecnicas.reduce((s, t) => s + (XP.tecnica[t.nivel] || XP.tecnica[1]), 0))
  const tareas = estado.tareas.filter((t) => t.hecha).length
  fila('Tareas y pasos del plan cumplidos', tareas, tareas * XP.tarea)
  const arboles = arbolesSembrados(estado)
  fila('Árboles nativos sembrados', arboles, arboles * XP.arbol)
  let nMisiones = 0
  let xpMisiones = 0
  const primera = primeraFecha(estado)
  if (primera) {
    for (let l = inicioSemana(primera); l <= hoy; l = sumarDias(l, 7)) {
      for (const m of misionesDeSemana(estado, l)) if (m.hecha) { nMisiones++; xpMisiones += m.xp }
    }
  }
  fila('Misiones cumplidas', nMisiones, xpMisiones)
  return { total: detalle.reduce((s, d) => s + d.xp, 0), detalle }
}

export function nivelDe(xp) {
  let i = 0
  while (i + 1 < NIVELES.length && xp >= NIVELES[i + 1].xp) i++
  const actual = NIVELES[i]
  const siguiente = NIVELES[i + 1] || null
  return {
    numero: i + 1,
    ...actual,
    siguiente,
    progreso: siguiente ? (xp - actual.xp) / (siguiente.xp - actual.xp) : 1,
    faltan: siguiente ? siguiente.xp - xp : 0,
  }
}

// ---------- Logros ----------
function mesesEntre(desde, hasta) {
  const meses = []
  let m = mesDe(desde)
  const fin = mesDe(hasta)
  while (m <= fin) {
    meses.push(m)
    const [a, mm] = m.split('-').map(Number)
    m = mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, '0')}`
  }
  return meses
}

export function logros(estado, hoy = hoyISO()) {
  const huevos = huevosTotales(estado)
  const arboles = arbolesSembrados(estado)
  const rmax = rachaMaxima(estado)
  let mesVerde = false
  let autosuficiente = false
  const primera = primeraFecha(estado)
  if (primera) {
    for (const m of mesesEntre(primera, hoy)) {
      const { desde, hasta } = rangoMes(m)
      const r = resumen(estado, desde, hasta)
      // Un mes «en verde» tiene que haber vendido algo: sin ventas no hay utilidad que celebrar.
      if (r.ventas > 0 && r.utilidad > 0) mesVerde = true
      for (const s of estado.sistemas) {
        if (s.tipo !== 'gallinas') continue
        const a = indicadoresGallinas(estado, s.id, desde, hasta).autosuficiencia_alimento
        if (a != null && a >= 0.25) autosuficiente = true
      }
    }
  }
  const prog = (v, meta) => Math.min(1, v / meta)
  return [
    { id: 'primer-huevo', emoji: '🥚', nombre: 'Primer huevo', desc: 'Anotar el primer huevo de la finca', logrado: huevos > 0, progreso: prog(huevos, 1) },
    { id: 'cien-huevos', emoji: '🧺', nombre: '100 huevos', desc: 'Llevar 100 huevos anotados', logrado: huevos >= 100, progreso: prog(huevos, 100) },
    { id: 'mil-huevos', emoji: '🏆', nombre: '1.000 huevos', desc: 'Llevar 1.000 huevos anotados', logrado: huevos >= 1000, progreso: prog(huevos, 1000) },
    { id: 'primera-venta', emoji: '💵', nombre: 'Primera venta', desc: 'Anotar la primera venta', logrado: estado.ventas.length > 0, progreso: prog(estado.ventas.length, 1) },
    { id: 'mes-verde', emoji: '📈', nombre: 'Mes en verde', desc: 'Un mes en que lo vendido pagó todo lo que costó producir', logrado: mesVerde, progreso: mesVerde ? 1 : 0 },
    { id: 'racha-30', emoji: '🔥', nombre: '30 días seguidos', desc: 'Anotar algo 30 días sin saltarse uno', logrado: rmax >= 30, progreso: prog(rmax, 30) },
    { id: 'bosque-50', emoji: '🌳', nombre: '50 árboles nativos', desc: 'Sembrar 50 árboles nativos en el bosque', logrado: arboles >= 50, progreso: prog(arboles, 50) },
    { id: 'autosuficiente', emoji: '🌽', nombre: 'La finca alimenta', desc: 'Un mes en que al menos la cuarta parte del alimento de las gallinas salió de la finca', logrado: autosuficiente, progreso: autosuficiente ? 1 : 0 },
    { id: 'aprendiz', emoji: '📚', nombre: 'Aprendiz', desc: 'Poner en práctica 5 técnicas', logrado: estado.tecnicas.length >= 5, progreso: prog(estado.tecnicas.length, 5) },
    { id: 'respaldo', emoji: '💾', nombre: 'Finca a salvo', desc: 'Guardar un respaldo en archivo', logrado: !!estado.ajustes?.ultimo_respaldo, progreso: estado.ajustes?.ultimo_respaldo ? 1 : 0 },
  ]
}
