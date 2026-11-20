// Calendario: la luna exacta (calculada en el teléfono), las temporadas de
// lluvia de la zona, El Niño y las tareas. La tradición lunar se muestra como
// tradición —con su origen— y al lado lo que dice la ciencia, más el
// experimento para comprobarla con los propios registros. Ni se cree a ciegas
// ni se desprecia: se mide.

import { fasesEntre, estadoLuna } from '../../lib/luna.js'
import { rangoMes, hoyISO, diaSemana, sumarDias, fechaCorta, MESES } from '../../lib/fechas.js'
import { nuevoId } from '../../lib/modelo.js'
import { esc, numero, cabeza, enlazar, errores } from '../ui.js'

const EMOJI_FASE = { nueva: '🌑', creciente: '🌓', llena: '🌕', menguante: '🌗' }
const NOMBRE_FASE = { nueva: 'Luna nueva', creciente: 'Cuarto creciente', llena: 'Luna llena', menguante: 'Cuarto menguante' }

const mesMas = (m, d) => {
  const [a, mm] = m.split('-').map(Number)
  const t = a * 12 + (mm - 1) + d
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export async function pantallaCalendario(raiz, ctx, [mesParam]) {
  const { estado, hoy } = ctx
  const mes = /^\d{4}-\d{2}$/.test(mesParam || '') ? mesParam : hoy.slice(0, 7)
  const { desde, hasta } = rangoMes(mes)
  const nMes = Number(mes.slice(5, 7))
  const clima = await ctx.catalogo('clima-zona')
  const normal = clima?.mensual?.find((m) => m.mes === nMes)
  const temporada = clima?.temporadas?.find((t) => t.meses?.includes(nMes))
  const helada = clima?.heladas?.meses_riesgo?.includes(nMes)

  // Fases exactas del mes, en hora de Colombia.
  const fases = {}
  for (const f of fasesEntre(new Date(desde + 'T00:00:00-05:00'), new Date(hasta + 'T23:59:59-05:00'))) fases[hoyISO(f.fecha)] = f
  const lluviaDia = {}
  for (const r of estado.registros) if (r.tipo === 'lluvia' && r.fecha >= desde && r.fecha <= hasta) lluviaDia[r.fecha] = (lluviaDia[r.fecha] || 0) + (r.datos?.mm || 0)
  const lluviaMes = Object.values(lluviaDia).reduce((s, x) => s + x, 0)
  const tareas = estado.tareas.filter((t) => t.fecha && t.fecha >= desde && t.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
  const tareasDia = {}
  for (const t of tareas) (tareasDia[t.fecha] ||= []).push(t)

  // Cuadrícula de lunes a domingo.
  const primerDia = desde
  const huecoInicio = (diaSemana(primerDia) + 6) % 7
  const celdas = []
  for (let i = -huecoInicio; ; i++) {
    const f = sumarDias(primerDia, i)
    if (f > hasta && celdas.length % 7 === 0) break
    celdas.push(f)
  }
  const luna = estadoLuna(new Date())
  const reglas = (clima?.luna?.reglas || []).filter((r) => r.fase === luna.periodo || (luna.nombre === 'Luna nueva' && r.fase === 'nueva') || (luna.nombre === 'Luna llena' && r.fase === 'llena'))

  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('Calendario', { atras: false })}
    <div class="fila-flex" style="margin-bottom:10px">
      <button class="btn suave chico" data-ir="calendario/${mesMas(mes, -1)}">‹</button>
      <b class="crece" style="text-align:center;font-size:17px">${MESES[nMes - 1]} de ${mes.slice(0, 4)}</b>
      <button class="btn suave chico" data-ir="calendario/${mesMas(mes, 1)}">›</button>
    </div>
    <div class="mes">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<div class="dsem">${d}</div>`).join('')}
      ${celdas.map((f) => `<div class="dia${f < desde || f > hasta ? ' fuera' : ''}${f === hoy ? ' hoy' : ''}${lluviaDia[f] ? ' lluvia' : ''}">
        <b>${Number(f.slice(8))}</b>${fases[f] ? `<span class="luna" title="${NOMBRE_FASE[fases[f].tipo]}">${EMOJI_FASE[fases[f].tipo]}</span>` : ''}
        <span class="marcas">${lluviaDia[f] ? `💧${numero(lluviaDia[f])}` : ''}${(tareasDia[f] || []).map((t) => (t.hecha ? '✅' : '📌')).join('')}</span></div>`).join('')}
    </div>
    <p class="suave chico">${Object.values(fases).map((f) => `${EMOJI_FASE[f.tipo]} ${NOMBRE_FASE[f.tipo]} el ${fechaCorta(hoyISO(f.fecha))} a las ${f.fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' })}`).join(' · ')}</p>

    <h3 class="seccion">Tiempo de la zona</h3>
    ${clima ? `<div class="tarjeta">
      <h2>${temporada ? `${temporada.tipo === 'seca' ? '☀️' : temporada.tipo === 'lluvias' ? '🌧️' : '🌦️'} ${esc(temporada.nombre)}` : 'Temporada'}</h2>
      ${normal ? `<p class="suave">Lo normal en ${MESES[nMes - 1]}: ${numero(normal.lluvia_mm)} mm en ${numero(normal.dias_lluvia)} días de lluvia; entre ${numero(normal.temp_min_c, 1)} y ${numero(normal.temp_max_c, 1)} °C.${lluviaDia && lluviaMes ? ` Anotados este mes: <b>${numero(lluviaMes)} mm</b>.` : ''}</p>` : ''}
      ${helada ? `<div class="nota">❄️ Mes con riesgo de helada. Alerta si la tarde está despejada, sin viento y la temperatura baja de ${clima.heladas.umbral_alerta_c} °C.</div>` : ''}
      ${temporada?.que_hacer?.length ? `<b class="chico">Qué hacer</b><ul class="suave" style="margin:4px 0 0;padding-left:18px">${temporada.que_hacer.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
    </div>
    ${clima.enso?.estado ? `<div class="nota cielo"><b>🌊 El Niño (boletín del ${esc(clima.enso.fecha_boletin || '')})</b><br>${esc(clima.enso.estado)}</div>` : ''}
    <p class="suave chico">Lluvia y días de lluvia: normal 1991-2020 del IDEAM en la estación Acapulco (Bojacá). Temperaturas: mínima media de 20 años y máxima de 10 años de la misma estación, que no completó los 30. Fuente: IDEAM, Normales Climatológicas Estándar 1991-2020, adaptadas por Finca Viva. Los datos abiertos del IDEAM en datos.gov.co tienen licencia <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener">CC BY-SA 4.0</a>. Lo de tu ladera puede variar: anota tu lluvia y en un año tendrás tus propios datos.</p>
    <a class="btn suave ancho" href="#/anotar/clima/lluvia">💧 Anotar la lluvia de hoy</a>` : '<div class="nota">Falta el archivo de clima de la investigación (datos/clima-zona.json).</div>'}

    <h3 class="seccion">La luna hoy: ${luna.emoji} ${esc(luna.nombre)} (${esc(luna.periodo)})</h3>
    <div class="tarjeta">
      ${reglas.length ? reglas.map((r) => `<p style="margin:0 0 8px"><span class="etiqueta oro">Tradición</span> <b>${esc(r.labor)}:</b> ${esc(r.regla)}</p>`).join('') : '<p class="suave">Sin reglas cargadas para esta fase.</p>'}
      ${clima?.luna?.evidencia ? `<details><summary class="chico"><b>Lo que dice la ciencia</b></summary><p class="suave chico">${esc(clima.luna.evidencia)}</p></details>` : ''}
      ${clima?.luna?.experimento_propuesto ? `<details><summary class="chico"><b>🧪 Compruébalo en tu finca</b></summary><p class="suave chico">${esc(clima.luna.experimento_propuesto)}</p></details>` : ''}
    </div>

    <h3 class="seccion">Tareas del mes</h3>
    ${tareas.length ? `<div class="lista">${tareas.map((t) => `<label class="item"><input type="checkbox" data-tarea="${esc(t.id)}" ${t.hecha ? 'checked' : ''} style="width:24px;height:24px;accent-color:var(--verde)"><div class="cuerpo"><b style="${t.hecha ? 'text-decoration:line-through;color:var(--tinta-suave)' : ''}">${esc(t.titulo)}</b><span>${fechaCorta(t.fecha)}${t.fecha < hoy && !t.hecha ? ' · <span class="etiqueta rojo">atrasada</span>' : ''}</span></div><button type="button" class="icono-btn" data-quitar="${esc(t.id)}" aria-label="Borrar">🗑️</button></label>`).join('')}</div>` : '<p class="suave">No hay tareas este mes.</p>'}
    <form class="tarjeta plana" data-nueva>
      <div data-errores></div>
      <label class="campo"><span>Nueva tarea</span><input name="titulo" maxlength="90" placeholder="Voltear el bocashi, vacuna, sembrar haba…" autocomplete="off"></label>
      <div class="dos"><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(mes === hoy.slice(0, 7) ? hoy : desde)}"></label><div style="display:flex;align-items:flex-end;padding-bottom:14px"><button class="btn ancho">Agregar</button></div></div>
    </form>
  </div>`
  enlazar(raiz, ctx)
  raiz.addEventListener('change', (e) => {
    const c = e.target.closest('[data-tarea]')
    if (!c) return
    ctx.cambiar((est) => {
      const t = est.tareas.find((x) => x.id === c.dataset.tarea)
      t.hecha = c.checked
      t.fecha_hecha = c.checked ? ctx.hoy : undefined
    }, { mensaje: c.checked ? 'Tarea cumplida' : 'Tarea pendiente otra vez' })
  })
  raiz.addEventListener('click', (e) => {
    const q = e.target.closest('[data-quitar]')
    if (!q) return
    e.preventDefault()
    if (confirm('¿Borrar esta tarea?')) ctx.cambiar((est) => { est.tareas = est.tareas.filter((t) => t.id !== q.dataset.quitar) }, { mensaje: 'Tarea borrada' })
  })
  raiz.querySelector('[data-nueva]').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    if (!f.titulo?.trim() || !f.fecha) { raiz.querySelector('[data-errores]').innerHTML = errores(['Escribe la tarea y la fecha']); return }
    ctx.cambiar((est) => est.tareas.push({ id: nuevoId(), origen: 'calendario', titulo: f.titulo.trim(), fecha: f.fecha, hecha: false }), { mensaje: 'Tarea agregada' })
  })
}
