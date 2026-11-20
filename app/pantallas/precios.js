// Precios que vi: la libreta del estudio de mercado. Es el primer paso del
// plan (PLAN.md): antes de comprar gallinas, saber si alguien paga el huevo de
// color a lo que cuesta producirlo. La pantalla compara lo anotado con dos
// números de la investigación: el costo de producir (precio de equilibrio) y
// lo que paga el mayorista (SIPSA). No inventa el precio al detal: no existe
// publicado, por eso se mide.

import { PRESENTACIONES, TIPOS_HUEVO, porHuevo, validarPrecio, resumenPrecios } from '../../lib/precios.js'
import { nuevoId } from '../../lib/modelo.js'
import { fechaCorta } from '../../lib/fechas.js'
import { esc, pesos, cabeza, opciones, errores, enlazar, leerNumero } from '../ui.js'

export async function pantallaPrecios(raiz, ctx) {
  const { estado, hoy } = ctx
  const gallinas = await ctx.catalogo('gallinas')
  const mercado = await ctx.catalogo('legal-mercado')
  const equilibrio = gallinas?.arranque_30_gallinas?.precio_equilibrio_huevo_cop || null
  const mayorista = mercado?.precios_huevo?.find((p) => /^Huevo rojo AA \(precio mayorista/.test(p.tipo || ''))
  let problemas = []

  const pintar = (v) => {
    const lista = [...(estado.precios || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    const color = resumenPrecios(lista, { tipo: 'Azul o verde' })
    const criollo = resumenPrecios(lista, { tipo: 'Criollo o campesino' })
    const veredicto = (r) =>
      r.n === 0 ? 'Todavía sin precios.'
        : !equilibrio ? ''
          : r.mediana >= equilibrio ? `Cubre el costo de producir (${pesos(equilibrio)} sin tu trabajo).`
            : `Por debajo del costo de producir (${pesos(equilibrio)}): a ese precio, 30 gallinas pierden plata.`
    raiz.innerHTML = `<div class="pantalla">
      ${cabeza('💲 Precios que vi', { atras: true })}
      <p class="suave" style="margin-top:-6px">Nadie publica el precio del huevo azul y verde al detal. Anota cada precio que veas en tiendas, plazas y ferias: con 10 precios ya sabes si el negocio da.</p>
      <div class="kpis">
        <div class="kpi"><small>Azul o verde</small><b>${color.n ? pesos(color.mediana) : '—'}</b><i>${color.n ? `por huevo · mediana de ${color.n}` : ''} ${veredicto(color)}</i></div>
        <div class="kpi"><small>Criollo o campesino</small><b>${criollo.n ? pesos(criollo.mediana) : '—'}</b><i>${criollo.n ? `por huevo · mediana de ${criollo.n}` : ''} ${veredicto(criollo)}</i></div>
      </div>
      <p class="suave chico">Para comparar: producirlo cuesta ${equilibrio ? pesos(equilibrio) : '—'} por huevo (estimado, sin tu trabajo)${mayorista ? ` y el mayorista paga ${pesos(mayorista.cop)} por el rojo AA (${esc(mayorista.lugar)}, ${esc(mayorista.fecha)})` : ''}.</p>
      <h3 class="seccion">Anotar un precio</h3>
      <form class="tarjeta">
        ${errores(problemas)}
        <div class="dos">
          <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha || hoy)}" max="${hoy}"></label>
          <label class="campo"><span>Qué huevo</span><select name="tipo">${opciones(TIPOS_HUEVO.map((t) => [t, t]), v.tipo || TIPOS_HUEVO[0])}</select></label>
        </div>
        <label class="campo"><span>Dónde</span><input name="lugar" autocomplete="off" value="${esc(v.lugar || '')}" placeholder="Tienda, plaza o feria, y el pueblo"></label>
        <div class="dos">
          <label class="campo"><span>Cómo se vendía</span><select name="presentacion">${opciones(Object.entries(PRESENTACIONES).map(([k, p]) => [k, p.nombre]), v.presentacion || 'cubeta')}</select></label>
          <label class="campo"><span>Precio (pesos)</span><input name="precio" inputmode="numeric" autocomplete="off" value="${esc(v.precio || '')}"></label>
        </div>
        <label class="campo" data-cantidad ${v.presentacion === 'otra' ? '' : 'hidden'}><span>¿Cuántos huevos traía?</span><input name="cantidad" inputmode="numeric" value="${esc(v.cantidad || '')}"></label>
        <label class="campo"><span>Nota (opcional)</span><input name="nota" autocomplete="off" value="${esc(v.nota || '')}" placeholder="Marca, tamaño, si estaba en oferta…"></label>
        <button class="btn ancho">Guardar precio</button>
      </form>
      ${lista.length ? `<h3 class="seccion">Lo que has visto (${lista.length})</h3><div class="lista">${lista.map((p) => `<div class="item">
        <span class="emoji">🥚</span>
        <div class="cuerpo"><b>${pesos(porHuevo(p))} por huevo · ${esc(p.tipo)}</b><span>${esc(p.lugar)} · ${fechaCorta(p.fecha)} · ${esc(PRESENTACIONES[p.presentacion]?.nombre || '')} a ${pesos(p.precio)}${p.nota ? ` · ${esc(p.nota)}` : ''}</span></div>
        <button class="btn chico suave" data-borrar="${esc(p.id)}" aria-label="Borrar">✕</button></div>`).join('')}</div>` : ''}
    </div>`
    enlazar(raiz, ctx)
    const form = raiz.querySelector('form')
    const pres = form.querySelector('[name=presentacion]')
    pres.addEventListener('change', () => { raiz.querySelector('[data-cantidad]').hidden = pres.value !== 'otra' })
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(form))
      const nuevo = {
        id: nuevoId(),
        fecha: f.fecha,
        lugar: f.lugar?.trim(),
        tipo: f.tipo,
        presentacion: f.presentacion,
        cantidad: f.presentacion === 'otra' ? leerNumero(f.cantidad, { entero: true }) : undefined,
        precio: leerNumero(f.precio, { entero: true }),
        nota: f.nota?.trim() || undefined,
      }
      problemas = validarPrecio(nuevo)
      if (problemas.length) return pintar(f)
      ctx.cambiar((est) => { est.precios = [...(est.precios || []), nuevo] }, { mensaje: `Precio guardado: ${pesos(porHuevo(nuevo))} por huevo` })
    })
    raiz.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => {
      if (!confirm('¿Borrar este precio?')) return
      ctx.cambiar((est) => { est.precios = est.precios.filter((p) => p.id !== b.dataset.borrar) }, { mensaje: 'Precio borrado' })
    }))
  }
  pintar({})
}
