// Los sistemas de la finca (cada gallinero, cada cultivo, el bosque…) y la ficha
// de cada uno: sus números, lo que toca hacer y todo lo anotado.

import { TIPOS_SISTEMA, TIPOS_REGISTRO, nuevoId } from '../../lib/modelo.js'
import { indicadoresGallinas, costosPorSistema, avesVivas } from '../../lib/libro.js'
import { sumarDias, rangoMes, fechaCorta, diasEntre } from '../../lib/fechas.js'
import { esc, pesos, numero, porcentaje, cabeza, opciones, errores, enlazar, nombreProducto, leerNumero } from '../ui.js'

export function resumenRegistro(r, estado) {
  const d = r.datos || {}
  const ins = estado.insumos.find((i) => i.id === d.insumoId)
  const de = ins ? `${numero(d.cantidad, 2)} ${esc(ins.unidad || '')} de ${esc(ins.nombre)}` : numero(d.cantidad, 2)
  switch (r.tipo) {
    case 'produccion': return `${numero(d.cantidad, 2)} · ${esc(nombreProducto(d.producto))}`
    case 'alimentacion': case 'aplicacion': return de
    case 'siembra': return `${numero(d.cantidad)} · ${esc(d.especie || '')}${d.area_m2 ? ` en ${numero(d.area_m2)} m²` : ''}`
    case 'cosecha': return `${numero(d.cantidad, 2)} ${esc(d.unidad || '')} de ${esc(nombreProducto(d.producto))}${d.destino ? ` → ${esc(d.destino)}` : ''}`
    case 'sanidad': return esc(d.accion || '') + (ins ? ` · ${de}` : '')
    case 'altas': return `Llegaron ${numero(d.cantidad)}${d.costo_total ? ` · ${pesos(d.costo_total)}` : ''}${d.origen ? ` · ${esc(d.origen)}` : ''}`
    case 'bajas': return `Salieron ${numero(d.cantidad)} (${esc(d.motivo || '')})`
    case 'labor': return `${numero(d.horas, 2)} h · ${esc(d.descripcion || '')}`
    case 'medicion': return `${esc(d.variable || '')}: ${numero(d.valor, 2)} ${esc(d.unidad || '')}`
    case 'lluvia': return `${numero(d.mm, 1)} mm de lluvia`
    case 'temperatura': return `Mín ${numero(d.min, 1)} °C · máx ${numero(d.max, 1)} °C`
    default: return esc(d.texto || '')
  }
}

export function listaRegistros(registros, estado, { borrar = true } = {}) {
  if (!registros.length) return '<div class="lista"><div class="vacio"><span class="emoji">📝</span>Todavía no hay nada anotado.</div></div>'
  return `<div class="lista">${registros
    .map((r) => {
      const t = TIPOS_REGISTRO[r.tipo] || { emoji: '•', nombre: r.tipo }
      return `<div class="item"><span class="emoji">${t.emoji}</span><div class="cuerpo"><b>${resumenRegistro(r, estado)}</b><span>${esc(t.nombre)} · ${fechaCorta(r.fecha)}</span></div>${borrar ? `<button class="icono-btn" data-borrar="${esc(r.id)}" aria-label="Borrar">🗑️</button>` : ''}</div>`
    })
    .join('')}</div>`
}

export function enlazarBorrado(raiz, ctx) {
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-borrar]')
    if (!b) return
    if (!confirm('¿Borrar este registro? Las cuentas se recalculan sin él.')) return
    ctx.cambiar((est) => { est.registros = est.registros.filter((r) => r.id !== b.dataset.borrar) }, { mensaje: 'Registro borrado' })
  })
}

function datoClave(s, estado, hoy) {
  const regs = estado.registros.filter((r) => r.sistemaId === s.id)
  if (s.tipo === 'gallinas') {
    const i = indicadoresGallinas(estado, s.id, sumarDias(hoy, -6), hoy)
    return `${numero(i.aves)} aves · postura 7 días ${porcentaje(i.postura)} · ${i.costo_por_huevo ? pesos(i.costo_por_huevo) + ' por huevo' : 'sin costo por huevo aún'}`
  }
  const ultimo = regs.reduce((m, r) => (!m || r.fecha > m.fecha ? r : m), null)
  return `${regs.length} registros${ultimo ? ` · último ${fechaCorta(ultimo.fecha)}` : ''}${s.tamano ? ` · ${numero(s.tamano)} ${TIPOS_SISTEMA[s.tipo]?.unidad || ''}` : ''}`
}

export async function pantallaSistemas(raiz, ctx) {
  const { estado, hoy } = ctx
  const activos = estado.sistemas.filter((s) => !s.archivado)
  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('Sistemas de la finca', { atras: false })}
    <p class="suave">Cada gallinero, cultivo o abono lleva sus propias cuentas: lo que gasta, lo que produce y cuánto cuesta cada cosa.</p>
    ${activos.length
      ? `<div class="lista">${activos.map((s) => `<div class="item tocable" data-ir="sistema/${esc(s.id)}"><span class="emoji">${TIPOS_SISTEMA[s.tipo]?.emoji || '📦'}</span><div class="cuerpo"><b>${esc(s.nombre)}</b><span>${datoClave(s, estado, hoy)}</span></div><span>›</span></div>`).join('')}</div>`
      : '<div class="lista"><div class="vacio"><span class="emoji">🌱</span>Aún no hay sistemas. Empieza por el gallinero.</div></div>'}
    <a class="btn ancho" href="#/nuevo-sistema">➕ Nuevo sistema</a>
  </div>`
  enlazar(raiz, ctx)
}

export async function pantallaNuevoSistema(raiz, ctx, [tipoInicial]) {
  const tipos = Object.entries(TIPOS_SISTEMA).map(([k, t]) => [k, `${t.emoji} ${t.nombre}`])
  let problemas = []
  const pintar = (v = {}) => {
    const tipo = v.tipo || tipoInicial || 'gallinas'
    raiz.innerHTML = `<div class="pantalla">${cabeza('Nuevo sistema')}
      <form>
        ${errores(problemas)}
        <label class="campo"><span>¿Qué es?</span><select name="tipo">${opciones(tipos, tipo)}</select></label>
        <label class="campo"><span>Nombre</span><input name="nombre" maxlength="60" required value="${esc(v.nombre || '')}" placeholder="${tipo === 'gallinas' ? 'Gallinero de araucanas' : tipo === 'cultivo' ? 'Huerta de la casa' : 'Nombre'}"></label>
        <label class="campo"><span>Tamaño (${esc(TIPOS_SISTEMA[tipo].unidad || 'opcional')})</span><input name="tamano" inputmode="decimal" value="${esc(v.tamano ?? '')}"><small>${tipo === 'gallinas' ? 'Cuántas aves caben. Las que tienes se anotan como «Llegada de animales».' : tipo === 'cultivo' || tipo === 'lombricultura' ? 'Opcional: con el tamaño puedes sacar a mano cuánto te da cada metro.' : tipo === 'ganado' ? 'Cuántas vacas, terneras y toros hay hoy.' : 'Opcional.'}</small></label>
        <label class="campo"><span>Notas</span><textarea name="notas" rows="2">${esc(v.notas || '')}</textarea></label>
        ${tipo === 'ganado' ? '<div class="nota">El ganado todavía no se ha investigado para esta app. Este sistema anota la leche, los gastos y las ventas y saca las cuentas, pero no trae metas, costos de referencia ni plan sanitario.</div>' : ''}
        <button class="btn ancho">Crear</button>
      </form></div>`
    enlazar(raiz, ctx)
    raiz.querySelector('[name=tipo]').addEventListener('change', (e) => pintar({ ...leer(), tipo: e.target.value }))
    raiz.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      const v2 = leer()
      problemas = v2.nombre ? [] : ['Ponle un nombre']
      if (problemas.length) return pintar(v2)
      const id = nuevoId()
      ctx.cambiar((est) => est.sistemas.push({ id, tipo: v2.tipo, nombre: v2.nombre, tamano: leerNumero(v2.tamano), notas: v2.notas, creado: ctx.hoy }), { mensaje: 'Sistema creado', ir: `sistema/${id}` })
    })
  }
  const leer = () => Object.fromEntries(new FormData(raiz.querySelector('form')))
  pintar()
}

// La ficha se repinta entera al borrar un registro: sin esto, la lista de los
// anteriores se cerraba con cada borrado y el dueño perdía por dónde iba.
let anterioresAbiertos = null

const PERIODOS = { semana: ['7 días', 6], mes30: ['30 días', 29], mes: ['Este mes', null] }

export async function pantallaFicha(raiz, ctx, [id, periodo = 'mes30']) {
  const { estado, hoy } = ctx
  const s = estado.sistemas.find((x) => x.id === id)
  if (!s) { ctx.ir('sistemas'); return }
  const tipo = TIPOS_SISTEMA[s.tipo] || TIPOS_SISTEMA.otro
  const [desde, hasta] = PERIODOS[periodo]?.[1] != null ? [sumarDias(hoy, -PERIODOS[periodo][1]), hoy] : [rangoMes(hoy).desde, hoy]
  const regs = estado.registros.filter((r) => r.sistemaId === s.id).sort((a, b) => (a.fecha === b.fecha ? (a.creado < b.creado ? 1 : -1) : a.fecha < b.fecha ? 1 : -1))
  const costos = costosPorSistema(estado, desde, hasta)[s.id]
  let cuerpo = ''

  if (s.tipo === 'gallinas') {
    const i = indicadoresGallinas(estado, s.id, desde, hasta)
    const datos = await ctx.catalogo('gallinas')
    const colores = Object.entries(i.por_color).map(([p, n]) => `<span class="fila-flex" style="display:inline-flex;margin-right:10px"><i class="huevo ${p.replace('huevo-', '')}"></i>${numero(n)}</span>`).join('')
    // Edad de la bandada: la edad con que llegó la primera tanda + el tiempo desde entonces.
    const llegada = regs.filter((r) => r.tipo === 'altas').sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0]
    const edad = llegada && llegada.datos?.edad_semanas != null ? llegada.datos.edad_semanas + Math.floor(diasEntre(llegada.fecha, hoy) / 7) : null
    const curva = datos?.curva_postura || []
    // La postura esperada se promedia sobre los MISMOS días del periodo. Comparar
    // el promedio de 30 días con la curva de hoy hacía ver floja a cualquier
    // bandada joven: en el arranque la curva sube cada semana.
    let esperada = null
    if (edad != null && curva.length) {
      const curvaEn = (sem) => curva.reduce((m, c) => (c.semana <= sem ? c : m), null)?.postura_pct ?? 0
      let suma = 0
      let dias = 0
      for (let f = llegada.fecha > desde ? llegada.fecha : desde; f <= hasta; f = sumarDias(f, 1)) {
        suma += curvaEn(llegada.datos.edad_semanas + Math.floor(diasEntre(llegada.fecha, f) / 7))
        dias++
      }
      if (dias) esperada = Math.round(suma / dias)
    }
    // Lo que vale toda la vida del lote (el aviso al ICA) va siempre arriba; antes
    // solo salía en la semana 0 y una bandada que llega de 16 semanas no lo veía.
    const siempre = (datos?.plan_sanitario || []).filter((p) => p.siempre)
    const plan = edad != null ? (datos?.plan_sanitario || []).filter((p) => !p.siempre && p.semana >= edad).slice(0, 3) : []
    // «obligatoria» solo cuando obliga a CUALQUIER lote (Ley 1255, emergencia
    // aviar). Lo que la Res. 3651 pide a granjas de 200 aves o más no se marca:
    // la norma va a la vista, para que el dueño vea de dónde sale cada cosa.
    const itemSanidad = (p, titulo) => `<div class="item"><span class="emoji">${p.siempre ? '⚠️' : '💉'}</span><div class="cuerpo"><b>${titulo}${p.obligatoria ? ' <span class="etiqueta rojo">obligatoria</span>' : ''}</b><span style="white-space:normal">${esc(p.accion)}</span>${p.norma || p.notas ? `<details class="chico"><summary class="suave">De dónde sale</summary>${p.norma ? `<p><b>Norma:</b> ${esc(p.norma)}.</p>` : ''}${p.notas ? `<p class="suave">${esc(p.notas)}</p>` : ''}</details>` : ''}</div></div>`
    cuerpo = `
      <div class="kpis">
        <div class="kpi grande"><small>Costo por huevo</small><b>${pesos(i.costo_por_huevo)}</b><i>${i.precio_medio_huevo ? `Lo vendes a ${pesos(i.precio_medio_huevo)} → ${i.margen_por_huevo >= 0 ? 'ganas' : 'pierdes'} ${pesos(Math.abs(i.margen_por_huevo))} por huevo` : 'Anota ventas para ver el margen'}</i></div>
        <div class="kpi"><small>Aves hoy</small><b>${numero(avesVivas(estado, s.id, hoy))}</b><i>${i.mortalidad ? `Mortalidad ${porcentaje(i.mortalidad, 1)}` : 'Sin muertes en el periodo'}</i></div>
        <div class="kpi"><small>Postura</small><b>${porcentaje(i.postura)}</b><i>${esperada != null ? `Esperada en esos días: ${esperada}&nbsp;%*` : `${numero(i.aves_dia)} aves-día`}</i></div>
        <div class="kpi"><small>Huevos</small><b>${numero(i.huevos)}</b><i>${colores || 'por color'}</i></div>
        <div class="kpi"><small>Alimento</small><b>${numero(i.alimento_kg, 1)} kg</b><i>${i.consumo_g_ave_dia ? `${numero(i.consumo_g_ave_dia)} g por ave al día` : ''}</i></div>
        <div class="kpi"><small>Comida de la finca</small><b>${porcentaje(i.autosuficiencia_alimento)}</b><i>del alimento salió de aquí</i></div>
        <div class="kpi"><small>Kg por docena</small><b>${numero(i.kg_alimento_por_docena, 2)}</b><i>alimento por cada 12 huevos</i></div>
      </div>
      ${esperada != null ? `<details class="suave chico"><summary>* Curva estimada, no medida: de dónde sale</summary><p>${esc(datos.curva_postura_origen || 'Sin fuente.')}</p></details>` : ''}
      ${edad == null ? '<div class="nota">Anota la llegada de las aves con su edad en semanas: así la ficha te dice qué vacuna toca y cuánto deberían estar poniendo.</div>' : ''}
      ${!datos ? '<div class="nota">⚠️ No se pudo cargar la investigación del gallinero (datos/gallinas.json): sin ella no se ven el plan de vacunas ni el aviso al ICA. Abre la app con señal para que se cargue y quede guardada.</div>' : ''}
      ${siempre.length || plan.length ? `<h3 class="seccion">Sanidad${edad != null ? `: lo que sigue (tienen ${edad} semanas)` : ''}</h3><div class="lista">${siempre.map((p) => itemSanidad(p, 'Siempre')).join('')}${plan.map((p) => itemSanidad(p, `Semana ${p.semana}`)).join('')}</div>` : ''}`
  } else {
    cuerpo = `<div class="kpis"><div class="kpi grande"><small>Costos del periodo</small><b>${pesos(costos?.total || 0)}</b><i>${regs.filter((r) => r.fecha >= desde).length} registros en el periodo</i></div></div>`
    // El ganado no tiene «Llegada» ni «Salida» de animales: cuántos hay se
    // escribe aquí. Sin esto el número quedaba fijo desde el día en que se creó
    // el sistema, y el mapa seguiría dibujando una vaca que ya se vendió.
    if (s.tipo === 'ganado') cuerpo += `<form class="fila-flex" data-hato style="gap:8px;align-items:flex-end;margin:12px 0 4px"><label class="campo crece" style="margin:0"><span>Animales hoy</span><input name="tamano" inputmode="numeric" value="${esc(s.tamano ?? '')}"></label><button class="btn">Guardar</button></form><p class="suave chico">Son los que se dibujan en el potrero del mapa. Cámbialo cuando nazca, llegue o salga un animal.</p>`
  }

  const filasCosto = [['Insumos usados', 'insumos'], ['Gastos', 'gastos'], ['Depreciación (lo que dura)', 'depreciacion'], ['Energía', 'energia'], ['Mano de obra', 'mano_obra']]
  raiz.innerHTML = `<div class="pantalla">
    ${cabeza(`${tipo.emoji} ${s.nombre}`)}
    <div class="pestanas">${Object.entries(PERIODOS).map(([k, [t]]) => `<button data-ir="sistema/${esc(s.id)}/${k}" class="${k === periodo ? 'activo' : ''}">${t}</button>`).join('')}</div>
    ${cuerpo}
    <h3 class="seccion">De qué está hecho el costo</h3>
    <div class="lista">${filasCosto.map(([t, k]) => `<div class="item"><div class="cuerpo"><b>${t}</b></div><span class="valor">${pesos(costos?.[k] || 0)}</span></div>`).join('')}
      <div class="item"><div class="cuerpo"><b>Total</b>${estado.ajustes.contar_mano_obra ? '<span>Incluye tu trabajo a ' + pesos(estado.ajustes.valor_hora_cop) + ' la hora (cámbialo en Ajustes)</span>' : '<span>Sin contar tu trabajo</span>'}</div><span class="valor">${pesos(costos?.total || 0)}</span></div></div>
    <div class="botonera"><a class="btn oro" href="#/anotar/${esc(s.id)}">➕ Anotar</a><a class="btn suave" href="#/aprende/${esc(s.tipo)}">📚 Técnicas</a></div>
    <h3 class="seccion">Lo anotado</h3>
    ${listaRegistros(regs.slice(0, 40), estado)}
    ${regs.length > 40 ? `<details data-anteriores${anterioresAbiertos === s.id ? ' open data-listo="1"' : ''}><summary class="suave chico">Se muestran los 40 más recientes de ${regs.length}. Ver los ${regs.length - 40} anteriores</summary>${anterioresAbiertos === s.id ? listaRegistros(regs.slice(40), estado) : ''}</details>` : ''}
    <button class="btn suave chico" data-archivar>Archivar este sistema</button>
  </div>`
  enlazar(raiz, ctx)
  // En el div de la pantalla y no en #app: #app vive toda la sesión y cada ficha
  // pintada le sumaba otro oyente (borrar preguntaba una vez por ficha abierta, y
  // saltaba también con los botones data-borrar de Precios y de Ajustes).
  enlazarBorrado(raiz.querySelector('.pantalla'), ctx)
  // Los retos se revisan a mano y piden semanas de notas, pero un gallinero
  // anota 5 o 6 registros al día: los 40 más recientes no alcanzan ni para una
  // semana. Los anteriores se pintan solo cuando se piden, para no armar cientos
  // de filas cada vez que se abre la ficha. Borrar funciona en ellos: el clic lo
  // escucha la pantalla entera (enlazarBorrado).
  const anteriores = raiz.querySelector('[data-anteriores]')
  anteriores?.addEventListener('toggle', () => {
    anterioresAbiertos = anteriores.open ? s.id : null
    if (!anteriores.open || anteriores.dataset.listo) return
    anteriores.dataset.listo = '1'
    anteriores.insertAdjacentHTML('beforeend', listaRegistros(regs.slice(40), estado))
  })
  raiz.querySelector('[data-hato]')?.addEventListener('submit', (e) => {
    e.preventDefault()
    const n = Math.max(0, Math.round(leerNumero(new FormData(e.target).get('tamano')) || 0))
    ctx.cambiar((est) => { est.sistemas.find((x) => x.id === s.id).tamano = n }, { mensaje: n === 1 ? 'Queda 1 animal' : `Quedan ${n} animales` })
  })
  raiz.querySelector('[data-archivar]').addEventListener('click', () => {
    if (!confirm('¿Archivar? Deja de aparecer en la lista, pero sus registros y sus cuentas se quedan.')) return
    ctx.cambiar((est) => { est.sistemas.find((x) => x.id === s.id).archivado = true }, { mensaje: 'Sistema archivado', ir: 'sistemas' })
  })
}
