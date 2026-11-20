// Construir: el plan de arranque del gallinero, con lo que cuesta cada cosa.
//
// Sale de la investigación (datos/gallinas.json). Cada línea dice si su precio
// es publicado o estimado, porque el 79 % del arranque no está cotizado y la
// pantalla no puede hacerlo pasar por precio firme. Marcar un paso da XP y
// mueve el mapa; anotar su gasto lo lleva a las cuentas.

import { nuevoId } from '../../lib/modelo.js'
import { fechaCorta } from '../../lib/fechas.js'
import { esc, pesos, numero, cabeza, enlazar } from '../ui.js'

const clave = (texto) => 'plan-' + texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40)
const esEstimado = (fuente) => /^estimad/i.test(fuente || '')
// Lo que dura se anota como inversión, con su vida útil; lo que se gasta en el mes, como gasto.
function tipoDeGasto(item) {
  const t = item.toLowerCase()
  if (/pollona/.test(t)) return null // las aves se anotan como «Llegada de animales», no como gasto
  if (/galp|cerramiento|malla/.test(t)) return { categoria: 'construccion', inversion: 1, vida: 120 }
  if (/nido|percha|comedero|bebedero|tanque|bombillo|luz|b[aá]scula/.test(t)) return { categoria: 'herramienta', inversion: 1, vida: 36 }
  if (/alimento|bulto/.test(t)) return null // el alimento entra como compra al inventario
  return { categoria: 'otro', inversion: 0, vida: 60 }
}

export async function pantallaConstruir(raiz, ctx) {
  const { estado } = ctx
  const datos = await ctx.catalogo('gallinas')
  const plan = datos?.arranque_30_gallinas
  const mercado = await ctx.catalogo('legal-mercado')
  const mayorista = mercado?.precios_huevo?.find((p) => /^Huevo rojo AA \(precio mayorista/.test(p.tipo || ''))
  if (!plan) {
    raiz.innerHTML = `<div class="pantalla">${cabeza('🏗️ Construir')}<div class="nota">Falta el plan de arranque de la investigación (datos/gallinas.json).</div></div>`
    enlazar(raiz, ctx)
    return
  }
  const tareas = new Map(estado.tareas.filter((t) => t.origen === 'plan').map((t) => [t.plan_id, t]))
  const filas = plan.items.map((it) => ({ ...it, id: clave(it.item), tarea: tareas.get(clave(it.item)) }))
  const total = filas.reduce((s, f) => s + (f.costo_cop || 0), 0)
  const hecho = filas.filter((f) => f.tarea?.hecha).reduce((s, f) => s + (f.costo_cop || 0), 0)
  const estimado = filas.filter((f) => esEstimado(f.fuente)).reduce((s, f) => s + (f.costo_cop || 0), 0)
  const pct = total ? hecho / total : 0

  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('🏗️ Construir el gallinero')}
    <div class="kpis">
      <div class="kpi grande"><small>Arranque para 30 gallinas</small><b>${pesos(total)}</b><i>Llevas ${pesos(hecho)} · faltan ${pesos(total - hecho)}</i><div class="barra oro" style="margin-top:8px"><i style="width:${Math.round(pct * 100)}%"></i></div></div>
      ${plan.precio_equilibrio_huevo_cop ? `<div class="kpi grande"><small>Precio mínimo del huevo para no perder</small><b>${pesos(plan.precio_equilibrio_huevo_cop)}</b><i>Sin contar tu trabajo.${mayorista ? ` Al por mayor el huevo rojo AA se paga a ${pesos(mayorista.cop)} (${esc(mayorista.lugar)}, ${esc(mayorista.fecha)}): a ese precio esta finca pierde. Hay que vender directo, a quien pague el huevo de color.` : ''}</i></div>` : ''}
    </div>
    <a class="btn oro ancho" href="#/precios">💲 Precios que vi: ${(estado.precios || []).length ? `${estado.precios.length} anotados` : 'mide cuánto pagan'}</a>
    <div class="nota">⚠️ ${pesos(estimado)} de los ${pesos(total)} son precios <b>estimados, sin cotizar</b>. Cotiza antes de comprar y corrige el monto al anotar el gasto.</div>
    <div class="nota">📋 Antes de vender el primer huevo, registra el predio en el ICA como predio pecuario (RSPP): lo exige la Resolución ICA 090464 de 2021 (arts. 3.13, 3.14 y 4), sin número mínimo de aves y también para gallinas de traspatio (norma verificada el 18-nov-2026).</div>
    <h3 class="seccion">Lo que hace falta</h3>
    <div class="lista">${filas.map((f) => `<div class="item">
      <input type="checkbox" data-paso="${esc(f.id)}" ${f.tarea?.hecha ? 'checked' : ''} style="width:26px;height:26px;accent-color:var(--verde);flex:none" aria-label="Hecho">
      <div class="cuerpo"><b style="white-space:normal;${f.tarea?.hecha ? 'text-decoration:line-through;color:var(--tinta-suave)' : ''}">${f.cantidad > 1 ? `${numero(f.cantidad)} × ` : ''}${esc(f.item)}</b>
        <span>${esEstimado(f.fuente) ? '<span class="etiqueta oro">estimado</span>' : '<span class="etiqueta">precio publicado</span>'}${f.tarea?.hecha ? ` · hecho el ${fechaCorta(f.tarea.fecha_hecha)}` : ''}</span>
        ${!f.tarea?.hecha && tipoDeGasto(f.item) ? `<button class="btn chico suave" data-gasto="${esc(f.id)}" style="margin-top:6px">🧾 Lo compré: anotar el gasto</button>` : ''}
      </div>
      <span class="valor">${pesos(f.costo_cop)}</span></div>`).join('')}</div>
    ${plan.supuestos ? `<details><summary class="suave chico"><b>De dónde salen estos números</b></summary><p class="suave chico">${esc(plan.supuestos)}</p></details>` : ''}
    <p class="suave chico">Las pollonas se anotan en Anotar → «Llegada de animales» y el alimento como compra: así entran al costo del huevo de la forma correcta.</p>
  </div>`
  enlazar(raiz, ctx)

  const asegurar = (est, f) => {
    let t = est.tareas.find((x) => x.origen === 'plan' && x.plan_id === f.id)
    if (!t) { t = { id: nuevoId(), origen: 'plan', plan_id: f.id, titulo: f.item, costo_cop: f.costo_cop, hecha: false }; est.tareas.push(t) }
    return t
  }
  raiz.addEventListener('change', (e) => {
    const c = e.target.closest('[data-paso]')
    if (!c) return
    const f = filas.find((x) => x.id === c.dataset.paso)
    ctx.cambiar((est) => {
      const t = asegurar(est, f)
      t.hecha = c.checked
      t.fecha_hecha = c.checked ? ctx.hoy : undefined
    }, { mensaje: c.checked ? '¡Un paso más!' : 'Paso pendiente otra vez' })
  })
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gasto]')
    if (!b) return
    const f = filas.find((x) => x.id === b.dataset.gasto)
    const g = tipoDeGasto(f.item)
    let tareaId
    ctx.cambiar((est) => { tareaId = asegurar(est, f).id }, { repintar: false })
    const gallinero = estado.sistemas.find((s) => s.tipo === 'gallinas' && !s.archivado)
    const q = new URLSearchParams({ desc: f.item.split('(')[0].trim(), monto: String(f.costo_cop || ''), categoria: g.categoria, inversion: String(g.inversion), vida: String(g.vida), tarea: tareaId, ...(gallinero ? { sistema: gallinero.id } : {}) })
    ctx.ir('gasto/' + encodeURIComponent(q.toString()))
  })
}
