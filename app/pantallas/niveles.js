// El nivel de un sitio de la finca: lo que falta para subirlo, cuánto cuesta, qué
// efecto tiene y de dónde sale cada número; y las metas que escribe la familia.
//
// Aquí no se guarda ningún nivel: sale de lib/niveles.js cada vez que se pinta.
// Lo único que se escribe son las marcas de la familia (`mejoras`) y sus metas.

import { nuevoId } from '../../lib/modelo.js'
import { nivelDelSitio, dondeAnotar, gastoAnotado, precioDe, metasDelSitio, validarMeta } from '../../lib/niveles.js'
import { fechaCorta } from '../../lib/fechas.js'
import { esc, pesos as pesosDe, numero, cabeza, errores, enlazar, leerNumero, celebrar } from '../ui.js'

// «15 ene» sin año engaña cuando la meta es para dentro de dos años.
const fechaDe = (iso, hoy) => fechaCorta(iso) + (iso.slice(0, 4) !== hoy.slice(0, 4) ? ` de ${iso.slice(0, 4)}` : '')

const JUNTOS = { gallinero: 'todos tus gallineros', huerta: 'todos tus cultivos', pasturas: 'todos tus potreros', lombricultivo: 'todos tus lechos' }
const SELLOS = { publicado: ['', 'precio publicado'], estimado: [' oro', 'sin cotizar'], mezcla: [' oro', 'en parte sin cotizar'] }
const etiqueta = (sello) => `<span class="etiqueta${SELLOS[sello][0]}">${SELLOS[sello][1]}</span>`

// Sin corte entre el signo y la cifra: en una columna angosta quedaba «$» en un
// renglón y «100.000» en el otro.
const pesos = (n) => pesosDe(n).replace(/ /g, String.fromCharCode(160))

// ---------- Piezas que también usan el mapa, la ficha del sistema y Logros ----------

// Los peldaños: uno por nivel; el siguiente se llena con lo que ya se cumple.
export function peldanos(n) {
  return `<div class="peldanos" role="img" aria-label="Nivel ${n.numero} de ${n.maximo}">${n.niveles
    .map((x) => {
      if (x.numero <= n.numero) return '<i class="si"></i>'
      if (x !== n.siguiente) return '<i></i>'
      return `<i class="va" style="--p:${Math.round(((x.mejoras.length - x.faltan) / x.mejoras.length) * 100)}%"></i>`
    })
    .join('')}</div>`
}

function precioCorto(m) {
  const p = precioDe(m)
  if (p.tipo === 'precio') return `${pesos(p.valor)}<small${p.sello === 'publicado' ? ' class="verde"' : ''}>${SELLOS[p.sello][1]}</small>`
  if (p.tipo === 'nada') return '<small class="suave">no se<br>compra</small>'
  if (p.tipo === 'opcional') return '<small class="suave">compra<br>opcional</small>'
  return '<small class="suave">sin precio<br>con fuente</small>'
}

const icono = (m) => (m.estado.modo === 'libro' ? '📒' : '✋')

// La escalera de la ficha del mapa (la A, la que Joan escogió el 24-nov-2026):
// todo lo que falta para el nivel que sigue, hasta tres renglones.
export function escalera(n) {
  const faltan = n.siguiente ? n.siguiente.mejoras.filter((m) => !m.estado.cumple) : []
  return `<div class="nivel-sitio">Nivel ${n.numero} de ${n.maximo} · ${esc(n.nombreNivel)}</div>
    ${peldanos(n)}
    ${n.siguiente
      ? `<div class="suave chico" style="margin:6px 0 4px;font-weight:700">Para el nivel ${n.siguiente.numero} «${esc(n.siguiente.nombre)}» ${faltan.length === 1 ? 'falta 1' : `faltan ${faltan.length}`}:</div>
        ${faltan.slice(0, 3).map((m) => `<div class="falta"><span>${icono(m)}</span><div><b>${esc(m.titulo)}</b><em>${esc(m.estado.va || m.corto)}</em></div><div class="valor">${precioCorto(m)}</div></div>`).join('')}
        ${faltan.length > 3 ? `<p class="suave chico" style="margin:2px 0 0">y ${faltan.length - 3} más</p>` : ''}`
      : '<p class="suave chico" style="margin:6px 0 0">Es el último nivel. Si algo se borra, vuelve a bajar.</p>'}
    <a class="btn oro ancho" href="#/nivel/${esc(n.sitio)}" style="margin-top:10px">⬆️ ${n.siguiente ? 'Ver cómo subir' : 'Ver el nivel'}</a>`
}

// Un renglón tocable con el nivel, para listas (Logros y la ficha del sistema).
export function renglonNivel(n) {
  return `<div class="item tocable" data-ir="nivel/${esc(n.sitio)}"><span class="emoji">${n.emoji}</span><div class="cuerpo"><b>${esc(n.nombre)} · nivel ${n.numero} de ${n.maximo}</b>${peldanos(n)}<span>${n.siguiente ? `Para el ${n.siguiente.numero} ${n.siguiente.faltan === 1 ? 'falta 1 mejora' : `faltan ${n.siguiente.faltan} mejoras`}` : 'Último nivel'}</span></div><span>›</span></div>`
}

// Los niveles de toda la finca, o null si no cargó el archivo.
export async function nivelesDeLaFinca(ctx) {
  const datos = await ctx.catalogo('niveles')
  if (!datos?.sitios) return null
  return Object.entries(datos.sitios).map(([k, d]) => nivelDelSitio(d, k, ctx.estado, ctx.hoy))
}

export async function nivelDe(ctx, sitio) {
  const d = sitio ? (await ctx.catalogo('niveles'))?.sitios?.[sitio] : null
  return d ? nivelDelSitio(d, sitio, ctx.estado, ctx.hoy) : null
}

// ---------- La tarjeta de una mejora ----------
function costo(m, estado) {
  const c = m.costo || {}
  const anotado = gastoAnotado(m, estado)
  const suyo = anotado != null ? `<div><b>Lo que anotaste: ${pesos(anotado)}</b></div>` : ''
  if (c.compra === false) return 'No es una compra.'
  if (c.falta) return `${suyo}<span class="etiqueta gris">sin precio con fuente</span> ${esc(c.falta)}`
  return suyo + c.items.map((i) => `<div>${esc(i.que)}: <b>${pesos(i.valor)}</b> ${etiqueta(i.sello)}${i.opcional ? ' <span class="etiqueta cielo">opcional</span>' : ''}</div>`).join('') + (c.nota ? `<div class="suave chico">${esc(c.nota)}</div>` : '')
}

function fuentes(m) {
  const hayEstimado = (m.costo?.items || []).some((i) => i.sello === 'estimado')
  const lista = m.fuentes.map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo)}</a>${f.fecha_consulta ? ` · consultado el ${fechaCorta(f.fecha_consulta)} de ${f.fecha_consulta.slice(0, 4)}` : ''}</li>`).join('')
  const notas = [
    hayEstimado ? '«Sin cotizar» es un estimado de la investigación del 18-nov-2026: cotiza antes de comprar.' : '',
    m.plazo ? `${m.plazo}: es meta de la app, no un dato.` : '',
    !m.fuentes.length ? 'Sin fuente externa: sale de la investigación de la finca (18-nov-2026) o es una regla de la app.' : '',
  ].filter(Boolean)
  return `<details class="fuente"><summary>De dónde sale</summary>${lista ? `<ul>${lista}</ul>` : ''}${notas.map((t) => `<p>${esc(t)}</p>`).join('')}</details>`
}

const DONDE_SE_QUITA = { construir: 'Se quita en Construir.', aprende: 'Se quita en Aprende.', gasto: 'Se quita borrando el gasto en Cuentas.' }

function tarjeta(m, estado, hoy) {
  const e = m.estado
  const tecnica = m.tecnica || m.cumple.tecnicas?.[0]
  const ir = e.modo === 'libro' ? dondeAnotar(m, estado) : null
  const deshacer = e.por === 'familia' || e.por === 'no-aplica'
  return `<div class="mejora${e.cumple ? ' hecha' : ''}">
    <h4>${e.cumple ? '✅' : icono(m)} ${esc(m.titulo)}</h4>
    <p class="suave" style="margin:0 0 8px">${esc(m.detalle)}</p>
    <dl>
      ${e.cumple ? `<dt>Hecha</dt><dd>${esc(e.por === 'no-aplica' ? `No aplica: ${e.texto}` : e.texto)}${e.fecha ? ` · ${fechaDe(e.fecha, hoy)}` : ''}${DONDE_SE_QUITA[e.por] ? ` <span class="suave chico">${DONDE_SE_QUITA[e.por]}</span>` : ''}</dd>` : ''}
      ${e.va ? `<dt>Va</dt><dd><b>${esc(e.va)}</b></dd>` : ''}
      <dt>Cuesta</dt><dd>${costo(m, estado)}</dd>
      <dt>Efecto</dt><dd>${m.efecto ? esc(m.efecto) : 'La investigación no trae un efecto medido.'}</dd>
    </dl>
    ${fuentes(m)}
    <div class="fila-flex acciones">
      ${!e.cumple && e.modo === 'marca' ? `<button class="btn oro chico crece" data-marcar="${esc(m.id)}">✓ Ya está hecho</button>` : ''}
      ${!e.cumple && ir ? `<a class="btn oro chico crece" href="#/${esc(ir.ruta)}">${esc(ir.texto)}</a>` : ''}
      ${tecnica ? `<a class="btn suave chico" href="#/tecnica/${esc(tecnica)}">📚 Cómo se hace</a>` : ''}
      ${!e.cumple && m.noAplica ? `<button class="btn suave chico" data-no-aplica="${esc(m.id)}">${esc(m.noAplica)}</button>` : ''}
      ${deshacer ? `<button class="btn suave chico" data-desmarcar="${esc(m.id)}">Quitar la marca</button>` : ''}
    </div>
  </div>`
}

// ---------- La pantalla ----------
// Sobreviven al repintado: marcar una mejora de «más adelante» no debe cerrar el
// nivel que se estaba mirando, ni un error borrar la meta a medio escribir.
let abiertos = new Set()
let abiertosDe = null

export async function pantallaNivel(raiz, ctx, [sitio]) {
  const { estado, hoy } = ctx
  const datos = await ctx.catalogo('niveles')
  const d = datos?.sitios?.[sitio]
  if (!d) {
    raiz.innerHTML = `<div class="pantalla">${cabeza('Niveles')}<div class="nota">${datos ? 'Ese sitio no tiene niveles.' : '⚠️ No se pudieron cargar los niveles (datos/niveles.json). Abre la app con señal para que se carguen y queden guardados.'}</div></div>`
    enlazar(raiz, ctx)
    return
  }
  if (abiertosDe !== sitio) { abiertos = new Set(); abiertosDe = sitio }
  const n = nivelDelSitio(d, sitio, estado, hoy)
  const metas = metasDelSitio(estado, sitio)
  const subidos = n.niveles.slice(0, n.numero).reverse()
  const despues = n.niveles.slice(n.numero + 1)
  const plegado = (x, titulo, detalle) => `<details class="hechos" data-nivel="${x.numero}"${abiertos.has(x.numero) ? ' open' : ''}><summary><span>${titulo}</span><span>${detalle}</span></summary>${x.mejoras.map((m) => tarjeta(m, estado, hoy)).join('')}</details>`

  raiz.innerHTML = `<div class="pantalla">
    ${cabeza(`${d.emoji} ${d.nombre}`)}
    <div class="tarjeta">
      <div class="fila-flex"><span class="sello">${n.numero}</span><div class="crece"><b style="font-size:17px">Nivel ${n.numero} de ${n.maximo} · ${esc(n.nombreNivel)}</b><div class="suave chico">Sale de lo anotado y de lo que marca la familia. Si se borra, baja.${JUNTOS[sitio] ? ` Cuenta ${JUNTOS[sitio]} juntos.` : ''}</div></div></div>
      ${peldanos(n)}
    </div>
    ${d.aviso ? `<div class="nota">${esc(d.aviso)}</div>` : ''}
    ${sitio === 'gallinero' ? `<a class="btn oro ancho" href="#/precios" style="margin-bottom:12px">💲 Precios que vi: ${(estado.precios || []).length ? `${numero(estado.precios.length)} anotados` : 'mide cuánto pagan'}</a>` : ''}
    ${n.siguiente
      ? `<h3 class="seccion">Para el nivel ${n.siguiente.numero} · ${esc(n.siguiente.nombre)}</h3>
        ${[...n.siguiente.mejoras].sort((a, b) => a.estado.cumple - b.estado.cumple).map((m) => tarjeta(m, estado, hoy)).join('')}`
      : '<div class="nota cielo">Es el último nivel. Lo que sigue son las metas que escriba la familia.</div>'}
    ${despues.length ? `<h3 class="seccion">Más adelante</h3>${despues.map((x) => plegado(x, `🔒 Nivel ${x.numero} · ${esc(x.nombre)}`, `${x.mejoras.length - x.faltan} de ${x.mejoras.length}`)).join('')}` : ''}
    ${subidos.length ? `<h3 class="seccion">${subidos.length === 1 ? 'Ya subido' : 'Ya subidos'}</h3>${subidos.map((x) => plegado(x, `✅ Nivel ${x.numero} · ${esc(x.nombre)}`, `${x.mejoras.length} de ${x.mejoras.length}`)).join('')}` : ''}
    <h3 class="seccion">Metas de la familia</h3>
    ${metas.length
      ? `<div class="lista">${metas.map((m) => `<div class="item"><input type="checkbox" data-meta="${esc(m.id)}" ${m.hecha ? 'checked' : ''} style="width:26px;height:26px;accent-color:var(--verde);flex:none" aria-label="Cumplida"><div class="cuerpo"><b style="white-space:normal;${m.hecha ? 'text-decoration:line-through;color:var(--tinta-suave)' : ''}">${esc(m.texto)}</b><span>${[m.hecha ? `cumplida el ${fechaDe(m.fecha_hecha || hoy, hoy)}` : m.para ? `antes del ${fechaDe(m.para, hoy)}` : 'sin fecha', m.costo_cop != null ? pesos(m.costo_cop) : 'sin costo escrito'].join(' · ')}</span></div><button class="icono-btn" data-borrar-meta="${esc(m.id)}" aria-label="Borrar la meta">🗑️</button></div>`).join('')}</div>`
      : ''}
    <details class="escribir-meta"><summary class="btn suave ancho">➕ Escribir una meta</summary>
      <form style="margin-top:12px"><div data-problemas></div>
        <label class="campo"><span>¿Qué quieren lograr aquí?</span><input name="texto" maxlength="120" autocomplete="off" placeholder="${sitio === 'pasturas' ? 'Ej.: dividir el potrero en dos' : 'Ej.: pintar la puerta'}"></label>
        <div class="dos"><label class="campo"><span>Costo (opcional)</span><input name="costo" inputmode="numeric" autocomplete="off"></label><label class="campo"><span>Para cuándo (opcional)</span><input type="date" name="para"></label></div>
        <button class="btn ancho">Guardar la meta</button></form></details>
    <p class="suave chico" style="margin-top:10px">Las metas las pone la familia y se marcan aquí. No suben el nivel: si lo subieran, bastaría con escribir metas fáciles. Su costo es el que ustedes escriban; no entra a las cuentas.</p>
  </div>`
  enlazar(raiz, ctx)

  const pantalla = raiz.querySelector('.pantalla')
  // Los <details> no burbujean su «toggle»: se escucha en la fase de captura.
  pantalla.addEventListener('toggle', (e) => {
    const k = Number(e.target.dataset?.nivel)
    if (!k) return
    if (e.target.open) abiertos.add(k)
    else abiertos.delete(k)
  }, true)

  const marcar = (id, noAplica) => {
    const antes = n.numero
    ctx.cambiar((est) => {
      est.mejoras = est.mejoras.filter((x) => !(x.sitio === sitio && x.mejoraId === id))
      est.mejoras.push({ id: nuevoId(), sitio, mejoraId: id, fecha: hoy, ...(noAplica ? { noAplica: true } : {}) })
    }, { mensaje: noAplica ? 'Anotado: aquí no aplica' : 'Marcado como hecho' })
    const ahora = nivelDelSitio(d, sitio, ctx.estado, hoy)
    if (ahora.numero > antes) celebrar(d.emoji, `${d.nombre}: nivel ${ahora.numero}`, `«${ahora.nombreNivel}». ${ahora.siguiente ? `Sigue «${ahora.siguiente.nombre}».` : 'Es el último.'}`)
  }
  pantalla.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.marcar) marcar(b.dataset.marcar, false)
    else if (b.dataset.noAplica) marcar(b.dataset.noAplica, true)
    else if (b.dataset.desmarcar) ctx.cambiar((est) => { est.mejoras = est.mejoras.filter((x) => !(x.sitio === sitio && x.mejoraId === b.dataset.desmarcar)) }, { mensaje: 'Marca quitada' })
    else if (b.dataset.borrarMeta) {
      if (!confirm('¿Borrar esta meta?')) return
      ctx.cambiar((est) => { est.metas = est.metas.filter((x) => x.id !== b.dataset.borrarMeta) }, { mensaje: 'Meta borrada' })
    }
  })
  pantalla.addEventListener('change', (e) => {
    const id = e.target.dataset?.meta
    if (!id) return
    const si = e.target.checked
    ctx.cambiar((est) => {
      const m = est.metas.find((x) => x.id === id)
      if (!m) return
      m.hecha = si
      m.fecha_hecha = si ? hoy : undefined
    }, { mensaje: si ? '¡Meta cumplida!' : 'Meta pendiente otra vez' })
  })
  pantalla.querySelector('.escribir-meta form').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    const meta = { texto: f.texto.trim(), costo_cop: leerNumero(f.costo, { entero: true }), para: f.para || null }
    const problemas = validarMeta(meta)
    if (f.costo.trim() && meta.costo_cop == null) problemas.push('El costo no se entiende: escribe solo el número')
    // Se avisa sin repintar: lo escrito en el formulario no se pierde.
    if (problemas.length) { e.target.querySelector('[data-problemas]').innerHTML = errores(problemas); return }
    ctx.cambiar((est) => { est.metas.push({ id: nuevoId(), sitio, hecha: false, creada: new Date().toISOString(), ...meta }) }, { mensaje: 'Meta guardada' })
  })
}
