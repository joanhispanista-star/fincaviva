// Los niveles de cada sitio (gallinero, huerta, pasturas, lombricultivo, agua,
// energía y casa): la cuenta, sin pantalla. Qué se pide está en datos/niveles.json.
//
// Cuatro decisiones que cambian el nivel y por eso están escritas:
// 1. No se guarda el nivel: se recalcula de lo anotado y de las marcas. Si se
//    borra un registro o se quita una marca, el nivel baja solo.
// 2. Van en orden. Un sitio está en el nivel 2 si cumple TODO lo del 1 y del 2;
//    lo del 3 ya hecho se ve hecho, pero no salta niveles.
// 3. Lo que ya se marcó en otra parte no se marca dos veces: valen un paso de
//    Construir, el «Lo hice» de Aprende y el gasto anotado en Cuentas.
// 4. Cuenta por clase de sitio (todos los potreros juntos, todas las huertas
//    juntas): el libro no sabe en cuál de los dos se trabajó.
//
// Las reglas del libro miran la historia entera, no los últimos días: un mes
// que se pagó, se pagó. Un ataque del gavilán no devuelve un gallinero al nivel 1.

import { TIPOS_SISTEMA, unidadNormal, clavePlan } from './modelo.js'
import { indicadoresGallinas, avesVivas } from './libro.js'
import { sumarDias, diasEntre, inicioSemana, mesDe, rangoMes, MESES } from './fechas.js'

// ---------- De qué sitio se habla ----------
// En la finca de ejemplo lo dice el id del objeto; en la escaneada, la clase del
// sitio marcado. Lo que no está aquí (compostera, bosque, frutales, invernadero,
// reservorio, otro) no tiene niveles.
const POR_OBJETO = { casa: 'casa', galpon: 'gallinero', huerta: 'huerta', potrero: 'pasturas', lombriz: 'lombricultivo', tanque: 'agua', panel: 'energia' }
const POR_CLASE = { casa: 'casa', gallinero: 'gallinero', huerta: 'huerta', potrero: 'pasturas', lombricultivo: 'lombricultivo', agua: 'agua', tanque: 'agua', panel: 'energia' }

export function sitioDelMapa({ id, clase } = {}) {
  return (clase ? POR_CLASE[clase] : POR_OBJETO[id]) || null
}

// El sitio de cada sistema, para su ficha. Ganado no tiene: del ganado no hay
// investigación, y los niveles de Pasturas son del suelo, no de las vacas.
const POR_SISTEMA = { gallinas: 'gallinero', cultivo: 'huerta', lombricultura: 'lombricultivo', agua: 'agua', energia: 'energia' }
export const sitioDelSistema = (tipo) => POR_SISTEMA[tipo] || null

// ---------- Ayudas ----------
const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
const coincide = (patron, texto) => new RegExp(sinTildes(patron), 'i').test(sinTildes(texto))

// Kilos de una cosecha. Una cosecha en «atados» o «canastas» no se sabe cuánto
// pesa: no cuenta, y la pantalla dice que se pide en kilos.
export function kilosDe(datos) {
  const u = unidadNormal(datos?.unidad || '')
  const n = datos?.cantidad
  if (!(n > 0)) return 0
  if (u === 'kg') return n
  if (u === 'g') return n / 1000
  return 0
}

function registrosDe(estado, hoy, tipoSistema, tipo) {
  const ids = new Set(estado.sistemas.filter((s) => s.tipo === tipoSistema).map((s) => s.id))
  return estado.registros.filter((r) => r.tipo === tipo && r.fecha <= hoy && (tipoSistema === 'clima' || ids.has(r.sistemaId)))
}

// Los registros que pide una regla, ya filtrados.
function filtrados(c, estado, hoy) {
  return registrosDe(estado, hoy, c.sistema, c.registro).filter((r) => {
    const d = r.datos || {}
    if (c.producto && !coincide(c.producto, d.producto)) return false
    if (c.excepto && coincide(c.excepto, d.producto)) return false
    if (c.variable && !coincide(c.variable, d.variable)) return false
    if (c.destino && d.destino !== c.destino) return false
    if (c.conEdad && !Number.isFinite(d.edad_semanas)) return false
    return true
  })
}

const distintos = (lista) => [...new Set(lista)].sort()
const num = (n, dec = 0) => n.toLocaleString('es-CO', { maximumFractionDigits: dec })
const veces = (n, uno, varios) => `${num(n)} ${n === 1 ? uno : varios}`
const mesAnio = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`

// Meses completos de la historia del gallinero, del más nuevo al más viejo. El
// mes en curso no está completo: su costo todavía cambia.
function mesesCompletos(regs, hoy) {
  return distintos(regs.map((r) => mesDe(r.fecha))).filter((m) => rangoMes(`${m}-01`).hasta < hoy).reverse()
}

// El mejor tramo de `dias` seguidos de una suma por fecha (ventana rodante).
function mejorVentana(filas, dias) {
  let mejor = 0
  for (const a of filas) {
    const hasta = sumarDias(a.fecha, dias - 1)
    mejor = Math.max(mejor, filas.reduce((s, b) => s + (b.fecha >= a.fecha && b.fecha <= hasta ? b.n : 0), 0))
  }
  return mejor
}

// ---------- Las reglas del libro ----------
// Cada una devuelve { cumple, va, cuando? }: `va` es lo que se lee en pantalla
// («12 de 30 días»), `cuando` es con qué se cumplió.
export const REGLAS = {
  // n registros de un tipo
  registros(c, estado, hoy) {
    const l = filtrados(c, estado, hoy)
    const va = c.conEdad && !l.length && registrosDe(estado, hoy, c.sistema, c.registro).length ? 'La llegada está anotada, pero sin la edad en semanas' : l.length >= c.n ? 'Ya está anotado' : l.length ? `${num(l.length)} de ${num(c.n)}` : 'Todavía no hay nada anotado'
    return { cumple: l.length >= c.n, va, cuando: l.length >= c.n ? l.map((r) => r.fecha).sort()[c.n - 1] : null }
  },
  // n días distintos con ese registro
  dias(c, estado, hoy) {
    const d = distintos(filtrados(c, estado, hoy).map((r) => r.fecha))
    return { cumple: d.length >= c.n, va: `${num(Math.min(d.length, c.n))} de ${num(c.n)} días`, cuando: d[c.n - 1] || null }
  },
  // n meses distintos con ese registro
  meses(c, estado, hoy) {
    const m = distintos(filtrados(c, estado, hoy).map((r) => mesDe(r.fecha)))
    return { cumple: m.length >= c.n, va: `${num(Math.min(m.length, c.n))} de ${num(c.n)} meses`, cuando: null }
  },
  // Meses con al menos una cosecha en kilos. Con `ventana`, los mejores dentro
  // de esa cantidad de meses seguidos.
  'meses-cosecha'(c, estado, hoy) {
    const m = distintos(filtrados(c, estado, hoy).filter((r) => kilosDe(r.datos) > 0).map((r) => mesDe(r.fecha)))
    const orden = (x) => Number(x.slice(0, 4)) * 12 + Number(x.slice(5, 7))
    const mejor = c.ventana ? m.reduce((max, a) => Math.max(max, m.filter((b) => orden(b) >= orden(a) && orden(b) < orden(a) + c.ventana).length), 0) : m.length
    return { cumple: mejor >= c.n, va: `${num(Math.min(mejor, c.n))} de ${num(c.n)} meses`, cuando: null }
  },
  // kilos sumados en toda la historia
  kilos(c, estado, hoy) {
    const kg = filtrados(c, estado, hoy).reduce((s, r) => s + kilosDe(r.datos), 0)
    return { cumple: kg >= c.kg - 1e-9, va: `${num(kg, 2)} de ${num(c.kg)} kg`, cuando: null }
  },
  // los mejores `dias` días seguidos
  'suma-anual'(c, estado, hoy) {
    const filas = filtrados(c, estado, hoy).map((r) => ({ fecha: r.fecha, n: kilosDe(r.datos) })).filter((x) => x.n > 0)
    const kg = mejorVentana(filas, c.dias)
    return { cumple: kg >= c.kg - 1e-9, va: `${num(kg, 1)} de ${num(c.kg)} kg en un año`, cuando: null }
  },
  // La racha más larga de días anotados del gallinero sin una baja por
  // depredador. Se cuentan días con algo anotado y no días de calendario: un mes
  // sin anotar nada no prueba que no entró el gavilán.
  'sin-depredador'(c, estado, hoy) {
    const ids = new Set(estado.sistemas.filter((s) => s.tipo === c.sistema).map((s) => s.id))
    const suyos = estado.registros.filter((r) => ids.has(r.sistemaId) && r.fecha <= hoy)
    const llegada = suyos.filter((r) => r.tipo === 'altas').map((r) => r.fecha).sort()[0]
    if (!llegada) return { cumple: false, va: 'Empieza a contar cuando anotes la llegada de las gallinas' }
    const ataques = new Set(suyos.filter((r) => r.tipo === 'bajas' && r.datos?.motivo === 'depredador').map((r) => r.fecha))
    let racha = 0
    let mejor = 0
    for (const f of distintos(suyos.filter((r) => r.fecha >= llegada && r.tipo !== 'nota').map((r) => r.fecha))) {
      racha = ataques.has(f) ? 0 : racha + 1
      mejor = Math.max(mejor, racha)
    }
    return { cumple: mejor >= c.dias, va: `${num(Math.min(mejor, c.dias))} de ${num(c.dias)} días anotados sin ataque` }
  },
  // n semanas seguidas (lunes a domingo) con esa medición
  'semanas-seguidas'(c, estado, hoy) {
    const s = distintos(filtrados(c, estado, hoy).map((r) => inicioSemana(r.fecha)))
    let seguidas = 0
    let mejor = 0
    s.forEach((x, i) => {
      seguidas = i && diasEntre(s[i - 1], x) === 7 ? seguidas + 1 : 1
      mejor = Math.max(mejor, seguidas)
    })
    return { cumple: mejor >= c.n, va: `${num(Math.min(mejor, c.n))} de ${num(c.n)} semanas seguidas` }
  },
  // Un mes completo en que el huevo se vendió por encima de lo que costó. Tus
  // horas cuentan siempre, aunque en Ajustes estén apagadas: «se paga» sin
  // pagarte no es pagarse. Y tienen que estar anotadas: sin horas, el costo sale
  // bajo y el nivel se regalaría. Con varios gallineros basta que uno lo logre.
  'mes-rentable'(c, estado, hoy) {
    const conTrabajo = { ...estado, ajustes: { ...estado.ajustes, contar_mano_obra: true } }
    let mejor = null
    for (const s of estado.sistemas.filter((x) => x.tipo === c.sistema)) {
      const suyos = estado.registros.filter((r) => r.sistemaId === s.id && r.fecha <= hoy)
      for (const mes of mesesCompletos(suyos, hoy)) {
        const { desde, hasta } = rangoMes(`${mes}-01`)
        const delMes = suyos.filter((r) => r.fecha >= desde && r.fecha <= hasta)
        const diasDe = (f) => distintos(delMes.filter(f).map((r) => r.fecha)).length
        const huevos = diasDe((r) => r.tipo === 'produccion' && String(r.datos?.producto).startsWith('huevo'))
        const alimento = diasDe((r) => r.tipo === 'alimentacion')
        const horas = delMes.filter((r) => r.tipo === 'labor').reduce((t, r) => t + (r.datos?.horas || 0), 0)
        if (huevos < c.dias || alimento < c.dias) continue
        const i = indicadoresGallinas(conTrabajo, s.id, desde, hasta)
        const f = { mes, costo: i.costo_por_huevo, precio: i.precio_medio_huevo, horas }
        const gana = horas > 0 && f.precio != null && f.costo != null && f.precio > f.costo
        if (gana) return { cumple: true, va: `${mesAnio(mes)}: costó $ ${num(Math.round(f.costo))} y se vendió a $ ${num(Math.round(f.precio))}`, cuando: null }
        mejor ||= f
      }
    }
    if (!mejor) return { cumple: false, va: `Falta un mes completo con ${num(c.dias)} días de huevos y ${num(c.dias)} de alimento` }
    if (!mejor.horas) return { cumple: false, va: `${mesAnio(mejor.mes)}: faltan tus horas de trabajo anotadas` }
    if (mejor.precio == null) return { cumple: false, va: `${mesAnio(mejor.mes)}: no hay ventas de huevo anotadas` }
    return { cumple: false, va: `${mesAnio(mejor.mes)}: costó $ ${num(Math.round(mejor.costo))} y se vendió a $ ${num(Math.round(mejor.precio))}` }
  },
  // Un mes completo en que al menos pct % del alimento salió de la finca
  'mes-autosuficiente'(c, estado, hoy) {
    let mejor = null
    for (const s of estado.sistemas.filter((x) => x.tipo === c.sistema)) {
      const suyos = estado.registros.filter((r) => r.sistemaId === s.id && r.fecha <= hoy)
      for (const mes of mesesCompletos(suyos, hoy)) {
        const { desde, hasta } = rangoMes(`${mes}-01`)
        const dias = distintos(suyos.filter((r) => r.tipo === 'alimentacion' && r.fecha >= desde && r.fecha <= hasta).map((r) => r.fecha)).length
        if (dias < c.dias) continue
        const pct = (indicadoresGallinas(estado, s.id, desde, hasta).autosuficiencia_alimento || 0) * 100
        if (!mejor || pct > mejor.pct) mejor = { mes, pct }
      }
    }
    if (!mejor) return { cumple: false, va: `Falta un mes completo con ${num(c.dias)} días de alimento` }
    return { cumple: mejor.pct >= c.pct - 1e-9, va: `${mesAnio(mejor.mes)}: ${num(Math.floor(mejor.pct))} % salió de la finca` }
  },
  // En algún tramo de `dias` días, la lombriz cosechada «para las gallinas»
  // alcanzó para `gramos` por gallina y por día. Las gallinas son las vivas al
  // final del tramo.
  'lombriz-alcanza'(c, estado, hoy) {
    const filas = filtrados({ ...c, destino: 'gallinas' }, estado, hoy).map((r) => ({ fecha: r.fecha, n: kilosDe(r.datos) })).filter((x) => x.n > 0)
    const gallineros = estado.sistemas.filter((s) => s.tipo === 'gallinas')
    const aves = (f) => gallineros.reduce((t, g) => t + avesVivas(estado, g.id, f), 0)
    let mejor = null
    for (const a of filas) {
      const fin = sumarDias(a.fecha, c.dias - 1)
      const tope = fin > hoy ? hoy : fin
      const kg = filas.reduce((t, b) => t + (b.fecha >= a.fecha && b.fecha <= tope ? b.n : 0), 0)
      const n = aves(tope)
      if (!n) continue
      const pide = (c.gramos * n * c.dias) / 1000
      if (!mejor || kg / pide > mejor.kg / mejor.pide) mejor = { kg, pide, n }
    }
    if (!mejor) {
      const n = aves(hoy)
      return { cumple: false, va: n ? `0 de ${num((c.gramos * n * c.dias) / 1000, 1)} kg para ${veces(n, 'gallina', 'gallinas')}` : 'Se cuenta cuando haya gallinas anotadas' }
    }
    return { cumple: mejor.kg >= mejor.pide - 1e-9, va: `${num(mejor.kg, 1)} de ${num(mejor.pide, 1)} kg en ${num(c.dias)} días, para ${veces(mejor.n, 'gallina', 'gallinas')}` }
  },
}

// ---------- Las marcas ----------
// Las cinco formas de dar por hecha una mejora de la familia, en el orden en que
// se muestran. Lo que se marcó en otra pantalla se dice con su nombre, para que
// se sepa dónde deshacerlo.
function marcaDe(m, sitio, estado) {
  const c = m.cumple
  const propia = (estado.mejoras || []).find((x) => x.sitio === sitio && x.mejoraId === m.id)
  if (propia?.noAplica) return { por: 'no-aplica', fecha: propia.fecha, texto: m.noAplica }
  if (propia) return { por: 'familia', fecha: propia.fecha, texto: 'Lo marcó la familia' }
  if (c.tipo !== 'marca') return null
  if (c.planes?.length) {
    const pasos = c.planes.map((p) => estado.tareas.find((t) => t.origen === 'plan' && t.hecha && t.plan_id?.startsWith(clavePlan(p))))
    if (pasos.every(Boolean)) return { por: 'construir', fecha: pasos.map((p) => p.fecha_hecha || '').sort().pop() || null, texto: 'Marcado en Construir' }
  }
  for (const id of c.tecnicas || []) {
    const t = estado.tecnicas.find((x) => x.tecnicaId === id)
    if (t) return { por: 'aprende', fecha: t.fecha, texto: '«Lo hice» en Aprende', tecnica: id }
  }
  if (c.gasto) {
    const g = gastosDe(c.gasto, estado)[0]
    if (g) return { por: 'gasto', fecha: g.fecha, texto: 'Está en tus gastos' }
  }
  return null
}

function gastosDe(g, estado) {
  return estado.gastos.filter((x) => coincide(g.palabras, x.descripcion || x.concepto || '') && (!g.inversion || x.es_inversion)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
}

// Lo que la finca de verdad gastó en esa mejora, si lo anotó: al lado del precio
// de referencia vale más que el precio de referencia.
export function gastoAnotado(m, estado) {
  if (!m.cumple?.gasto) return null
  const l = gastosDe(m.cumple.gasto, estado)
  return l.length ? l.reduce((s, g) => s + (g.monto || 0), 0) : null
}

// Cómo va una mejora: { cumple, modo: 'libro'|'marca', va, por, fecha, texto }
export function estadoDeMejora(m, sitio, estado, hoy) {
  const marca = marcaDe(m, sitio, estado)
  if (m.cumple.tipo === 'libro') {
    if (marca?.por === 'no-aplica') return { cumple: true, modo: 'libro', va: null, ...marca }
    const regla = REGLAS[m.cumple.regla]
    const r = regla ? regla(m.cumple, estado, hoy) : { cumple: false, va: '' }
    return { cumple: r.cumple, modo: 'libro', va: r.va, por: r.cumple ? 'libro' : null, fecha: r.cuando || null, texto: r.cumple ? 'Lo dice tu libro' : null }
  }
  return marca ? { cumple: true, modo: 'marca', va: null, ...marca } : { cumple: false, modo: 'marca', va: null, por: null }
}

// El nivel de un sitio. `definicion` es sitios[sitio] de niveles.json.
export function nivelDelSitio(definicion, sitio, estado, hoy) {
  const niveles = definicion.niveles.map((n, i) => {
    const mejoras = n.mejoras.map((m) => ({ ...m, estado: estadoDeMejora(m, sitio, estado, hoy) }))
    const faltan = mejoras.filter((m) => !m.estado.cumple).length
    return { numero: i + 1, nombre: n.nombre, mejoras, faltan, completo: faltan === 0 }
  })
  const primero = niveles.findIndex((n) => !n.completo)
  const numero = primero === -1 ? niveles.length : primero
  return {
    sitio,
    nombre: definicion.nombre,
    emoji: definicion.emoji,
    numero,
    maximo: niveles.length,
    nombreNivel: numero ? niveles[numero - 1].nombre : 'Todavía sin nivel',
    niveles,
    siguiente: numero < niveles.length ? niveles[numero] : null,
  }
}

// ---------- A dónde ir a anotar lo que pide una regla ----------
// Devuelve { ruta, texto } o null si no hay nada que anotar (una marca). Nunca
// manda a una pantalla que no tenga ese registro: lo revisa contra TIPOS_SISTEMA.
export function dondeAnotar(m, estado) {
  const c = m.cumple
  if (c.tipo !== 'libro') return null
  if (c.sistema === 'clima') return { ruta: `anotar/clima/${c.registro}`, texto: 'Anotar la lluvia' }
  const s = estado.sistemas.find((x) => x.tipo === c.sistema && !x.archivado)
  if (!s) return { ruta: `nuevo-sistema/${c.sistema}`, texto: `Crear ${TIPOS_SISTEMA[c.sistema].nombre}` }
  if (c.regla === 'mes-rentable') return { ruta: 'cuentas', texto: 'Ver las cuentas' }
  // Aquí no se pide anotar una baja: se pide anotar los días.
  if (c.regla === 'sin-depredador') return { ruta: `anotar/${s.id}`, texto: 'Anotar el día' }
  return { ruta: `anotar/${s.id}/${c.registro}`, texto: 'Anotar' }
}

// ---------- Las metas de la familia ----------
export function metasDelSitio(estado, sitio) {
  const l = (estado.metas || []).filter((m) => m.sitio === sitio)
  // Las pendientes primero, y entre ellas la de fecha más cercana.
  return l.sort((a, b) => (!!a.hecha - !!b.hecha) || ((a.para || '9') < (b.para || '9') ? -1 : (a.para || '9') > (b.para || '9') ? 1 : (a.creada || '') < (b.creada || '') ? -1 : 1))
}

export function validarMeta({ texto, costo_cop, para } = {}) {
  const p = []
  if (!texto?.trim()) p.push('Escribe la meta')
  if (costo_cop != null && (!Number.isFinite(costo_cop) || costo_cop < 0)) p.push('El costo no puede ser negativo')
  if (para && !/^\d{4}-\d{2}-\d{2}$/.test(para)) p.push('La fecha no se entiende')
  return p
}

// ---------- Los precios de una mejora ----------
// Nunca se suma lo que tiene precio con lo que no: «desde $X» escondería el
// hueco. Lo opcional no entra en lo que se pide.
export function precioDe(m) {
  const c = m.costo || {}
  if (c.compra === false) return { tipo: 'nada' }
  const items = (c.items || []).filter((i) => !i.opcional)
  if (items.length) {
    const sellos = new Set(items.map((i) => i.sello))
    return { tipo: 'precio', valor: items.reduce((s, i) => s + i.valor, 0), sello: sellos.size === 1 ? items[0].sello : 'mezcla' }
  }
  if ((c.items || []).length) return { tipo: 'opcional' }
  return { tipo: 'falta' }
}
