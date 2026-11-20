// Aprende: las técnicas que salieron de la investigación (datos/tecnicas-*.json).
// Cada una dice por qué sirve, qué se necesita, los pasos y cómo saber si salió
// bien. «Lo hice» da XP según la dificultad: aprender también es jugar.

import { nuevoId } from '../../lib/modelo.js'
import { fechaCorta } from '../../lib/fechas.js'
import { XP } from '../../lib/juego.js'
import { esc, pesos, numero, cabeza, enlazar } from '../ui.js'

const ARCHIVOS = { gallinas: '🐔 Gallinas', alimento: '🌽 Alimento', cultivo: '🌱 Cultivos', suelo: '🪱 Suelo y abonos', bosque: '🌳 Bosque y agua', energia: '☀️ Energía' }
// Desde la ficha de un sistema se llega con su tipo; estos son los temas que le tocan.
const POR_SISTEMA = { gallinas: ['gallinas', 'alimento'], cultivo: ['cultivo', 'suelo'], compost: ['suelo'], lombricultura: ['suelo'], bosque: ['bosque'], agua: ['bosque'], energia: ['energia'] }

async function todas(ctx) {
  const lotes = await Promise.all(Object.keys(ARCHIVOS).map(async (a) => ((await ctx.catalogo('tecnicas-' + a))?.tecnicas || []).map((t) => ({ ...t, tema: a }))))
  return lotes.flat()
}

const estrellas = (n) => '⭐'.repeat(n || 1)

export async function pantallaAprende(raiz, ctx, [filtro]) {
  const lista = await todas(ctx)
  const hechas = new Map(ctx.estado.tecnicas.map((t) => [t.tecnicaId, t]))
  const temas = POR_SISTEMA[filtro] || (ARCHIVOS[filtro] ? [filtro] : null)
  const visibles = lista.filter((t) => !temas || temas.includes(t.tema)).sort((a, b) => (a.nivel || 1) - (b.nivel || 1))
  const faltan = Object.keys(ARCHIVOS).filter((a) => !lista.some((t) => t.tema === a))
  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('📚 Aprende')}
    <p class="suave">Técnicas para tierra fría, cada una con sus fuentes. No todas están probadas en campo: algunas son propuestas para probar y medir en tu finca, y su ficha lo dice. Cuando pongas una en práctica, márcala: ganas XP.</p>
    <div class="pestanas"><button data-ir="aprende" class="${!filtro ? 'activo' : ''}">Todas</button>${Object.entries(ARCHIVOS).map(([k, t]) => `<button data-ir="aprende/${k}" class="${filtro === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
    ${visibles.length ? `<div class="lista">${visibles.map((t) => `<div class="item tocable" data-ir="tecnica/${esc(t.id)}"><span class="emoji">${hechas.has(t.id) ? '✅' : ARCHIVOS[t.tema].split(' ')[0]}</span><div class="cuerpo"><b>${esc(t.titulo)}</b><span>${estrellas(t.nivel)} · ${t.listo_en_dias ? `${numero(t.listo_en_dias)} días` : ''} · +${XP.tecnica[t.nivel] || XP.tecnica[1]} XP</span></div><span>›</span></div>`).join('')}</div>` : '<div class="lista"><div class="vacio"><span class="emoji">📚</span>Todavía no hay técnicas de este tema.</div></div>'}
    ${faltan.length ? `<p class="suave chico">Aún sin técnicas de: ${faltan.map((a) => ARCHIVOS[a]).join(', ')}. Llegan con la investigación.</p>` : ''}
  </div>`
  enlazar(raiz, ctx)
}

const CONOCIDOS = new Set(['id', 'titulo', 'categoria', 'nivel', 'resumen', 'por_que', 'materiales', 'pasos', 'listo_en_dias', 'como_saber_si_salio_bien', 'errores_comunes', 'dosis_o_uso', 'mision', 'fuentes', 'tema'])
const bonito = (k) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')

export async function pantallaTecnica(raiz, ctx, [id]) {
  const t = (await todas(ctx)).find((x) => x.id === id)
  if (!t) { ctx.ir('aprende'); return }
  const hecha = ctx.estado.tecnicas.find((x) => x.tecnicaId === t.id)
  const xp = XP.tecnica[t.nivel] || XP.tecnica[1]
  const materiales = t.materiales || []
  const costo = materiales.reduce((s, m) => s + (m.costo_cop || 0), 0)
  // Campos que una técnica traiga y esta pantalla no conozca se muestran igual:
  // mejor un título feo que un dato escondido.
  const extra = Object.entries(t).filter(([k, v]) => !CONOCIDOS.has(k) && typeof v === 'string' && v.trim())
  raiz.innerHTML = `<div class="pantalla">
    ${cabeza(t.titulo)}
    <p><span class="etiqueta">${ARCHIVOS[t.tema] || esc(t.categoria)}</span> <span class="etiqueta oro">${estrellas(t.nivel)} +${xp} XP</span> ${t.listo_en_dias ? `<span class="etiqueta cielo">Listo en ${numero(t.listo_en_dias)} días</span>` : ''}</p>
    <div class="tarjeta"><p style="margin:0;font-size:16px">${esc(t.resumen)}</p></div>
    ${t.por_que ? `<h3 class="seccion">Por qué sirve</h3><p>${esc(t.por_que)}</p>` : ''}
    ${materiales.length ? `<h3 class="seccion">Qué se necesita</h3><div class="lista">${materiales.map((m) => `<div class="item"><div class="cuerpo"><b>${esc(m.item)}</b><span>${m.cantidad != null ? `${numero(m.cantidad, 2)} ${esc(m.unidad || '')}` : ''}</span></div><span class="valor">${m.costo_cop ? pesos(m.costo_cop) : '<span class="suave chico">sin precio</span>'}</span></div>`).join('')}${costo ? `<div class="item"><div class="cuerpo"><b>Total con precio</b></div><span class="valor">${pesos(costo)}</span></div>` : ''}</div>${costo ? '<p class="suave chico">Precios de referencia de la investigación del 18-nov-2026, publicados o estimados: cotiza antes de comprar.</p>' : ''}` : ''}
    ${t.pasos?.length ? `<h3 class="seccion">Paso a paso</h3><ol style="padding-left:22px;line-height:1.5">${t.pasos.map((p) => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}</ol>` : ''}
    ${t.dosis_o_uso ? `<h3 class="seccion">Dosis y uso</h3><p>${esc(t.dosis_o_uso)}</p>` : ''}
    ${t.como_saber_si_salio_bien ? `<h3 class="seccion">Cómo saber si salió bien</h3><p>${esc(t.como_saber_si_salio_bien)}</p>` : ''}
    ${t.errores_comunes?.length ? `<h3 class="seccion">Errores comunes</h3><ul style="padding-left:20px;line-height:1.5">${t.errores_comunes.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    ${extra.map(([k, v]) => `<h3 class="seccion">${esc(bonito(k))}</h3><p>${esc(v)}</p>`).join('')}
    ${t.mision ? `<div class="nota">🎯 <b>Reto${t.mision.titulo ? `: ${esc(t.mision.titulo)}` : ''}.</b> ${esc(typeof t.mision === 'string' ? t.mision : t.mision.como_se_cumple || t.mision.texto || '')}<br><span class="suave chico">La app todavía no revisa este reto sola: se marca a mano con «Lo hice» (+${xp} XP).</span></div>` : ''}
    <div class="botonera">${hecha ? `<button class="btn suave" data-deshacer>✅ La hiciste el ${fechaCorta(hecha.fecha)} · deshacer</button>` : `<button class="btn oro" data-hecha>✓ Lo hice (+${xp} XP)</button>`}</div>
    ${t.fuentes?.length ? `<details><summary class="suave chico"><b>Fuentes (${t.fuentes.length})</b></summary><ul class="chico" style="padding-left:18px">${t.fuentes.map((f) => `<li>${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.titulo || f.url)}</a>` : esc(f.titulo || '')}${f.fecha_consulta ? ` <span class="suave">(consultada ${esc(f.fecha_consulta)})</span>` : ''}</li>`).join('')}</ul></details>` : ''}
  </div>`
  enlazar(raiz, ctx)
  raiz.querySelector('[data-hecha]')?.addEventListener('click', () => ctx.cambiar((est) => est.tecnicas.push({ id: nuevoId(), tecnicaId: t.id, nivel: t.nivel || 1, fecha: ctx.hoy }), { mensaje: '¡Técnica puesta en práctica!' }))
  raiz.querySelector('[data-deshacer]')?.addEventListener('click', () => {
    if (confirm('¿Quitar la marca? Se pierde su XP.')) ctx.cambiar((est) => { est.tecnicas = est.tecnicas.filter((x) => x.tecnicaId !== t.id) }, { mensaje: 'Marca quitada' })
  })
}
