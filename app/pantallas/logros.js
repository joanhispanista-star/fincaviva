// El jugador: nivel, de dónde sale cada punto de XP, misiones y logros.
// Mostrar de dónde sale la XP es parte del trato: el juego no tiene trucos.

import { calcularXP, nivelDe, misionesDeSemana, logros, racha, NIVELES } from '../../lib/juego.js'
import { inicioSemana } from '../../lib/fechas.js'
import { esc, numero, cabeza, enlazar } from '../ui.js'

export async function pantallaLogros(raiz, ctx) {
  const { estado, hoy } = ctx
  const xp = calcularXP(estado, hoy)
  const n = nivelDe(xp.total)
  const misiones = misionesDeSemana(estado, inicioSemana(hoy))
  const lista = logros(estado, hoy)
  const dias = racha(estado, hoy)
  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('🏆 Tu finca en el juego')}
    <div class="tarjeta" style="text-align:center">
      <div style="font-size:54px">${n.emoji}</div>
      <h2>Nivel ${n.numero} · ${esc(n.nombre)}</h2>
      <p class="suave">${numero(xp.total)} XP${n.siguiente ? ` · faltan ${numero(n.faltan)} para ${esc(n.siguiente.nombre)}` : ' · nivel máximo'}</p>
      <div class="barra"><i style="width:${Math.round(n.progreso * 100)}%"></i></div>
      ${dias ? `<p style="margin:10px 0 0;font-weight:800">🔥 ${dias} ${dias === 1 ? 'día' : 'días'} seguidos anotando</p>` : ''}
    </div>
    <h3 class="seccion">Misiones de esta semana</h3>
    <div class="lista">${misiones.map((m) => `<div class="item"><span class="emoji">${m.hecha ? '✅' : m.emoji}</span><div class="cuerpo"><b>${esc(m.texto)}</b>${m.id === 'costo-huevo' ? `<span>Esta semana va en ${m.valor != null ? '$ ' + numero(m.valor) : '— (faltan datos)'}</span>` : `<div class="barra oro" style="margin-top:6px"><i style="width:${Math.round(m.progreso * 100)}%"></i></div><span>${numero(m.valor)} de ${numero(m.meta)}</span>`}</div><span class="valor" style="color:var(--oro-osc)">+${m.xp}</span></div>`).join('')}</div>
    <h3 class="seccion">Logros</h3>
    <div class="kpis">${lista.map((l) => `<div class="kpi" style="${l.logrado ? '' : 'opacity:.55'}"><b style="font-size:28px">${l.logrado ? l.emoji : '🔒'}</b><small style="text-transform:none;font-size:13px;color:var(--tinta)">${esc(l.nombre)}</small><i>${esc(l.desc)}</i>${!l.logrado && l.progreso > 0 ? `<div class="barra" style="margin-top:6px"><i style="width:${Math.round(l.progreso * 100)}%"></i></div>` : ''}</div>`).join('')}</div>
    <h3 class="seccion">De dónde sale tu XP</h3>
    <div class="lista">${xp.detalle.map((d) => `<div class="item"><div class="cuerpo"><b>${esc(d.concepto)}</b><span>${numero(d.cantidad)}</span></div><span class="valor">${numero(d.xp)} XP</span></div>`).join('')}</div>
    <p class="suave chico">Todo sale de lo anotado: si borras un registro, se va su XP. El marcador de verdad es la utilidad del mes, en pesos.</p>
    <h3 class="seccion">Los niveles</h3>
    <div class="lista">${NIVELES.map((x, i) => `<div class="item"><span class="emoji">${x.emoji}</span><div class="cuerpo"><b>${i + 1}. ${esc(x.nombre)}</b></div><span class="valor">${numero(x.xp)} XP</span></div>`).join('')}</div>
  </div>`
  enlazar(raiz, ctx)
}
