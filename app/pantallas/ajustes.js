// Ajustes, respaldo e instalación. El respaldo no es un extra: en un iPhone sin
// la app instalada, Safari puede borrar los datos de un sitio que no se abre en
// 7 días. Esta pantalla lo dice sin rodeos.

import { aRespaldo, deRespaldo, borrarTodo } from '../../lib/almacen.js'
import { estadoVacio } from '../../lib/modelo.js'
import { crearFincaDePrueba } from '../../lib/demo.js'
import { fechaCorta, MESES } from '../../lib/fechas.js'
import { esc, pesos, cabeza, opciones, enlazar, leerNumero, descargar, avisar } from '../ui.js'

export async function pantallaAjustes(raiz, ctx) {
  const { estado } = ctx
  const a = estado.ajustes
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent)
  let persistida = null
  try { persistida = await navigator.storage?.persisted?.() } catch { /* sin API */ }
  const energia = await ctx.catalogo('energia')
  const tarifa = energia?.tarifas?.find((t) => t.estrato === '4' && /lo que pase|todo/i.test(t.tipo)) || energia?.tarifas?.find((t) => t.estrato === '4')
  const vacia = !estado.registros.length && !estado.ventas.length && !estado.compras.length

  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('⚙️ Ajustes')}
    ${!ctx.persistente ? '<div class="ob-error">Este navegador no deja guardar la finca: lo que anotes se pierde al cerrar. Descarga un respaldo antes de salir.</div>' : ''}
    <form data-ajustes class="tarjeta">
      <label class="campo"><span>Nombre de la finca</span><input name="nombre" maxlength="60" value="${esc(estado.finca?.nombre || '')}"></label>
      <label class="marcar"><input type="checkbox" name="contar_mano_obra" ${a.contar_mano_obra ? 'checked' : ''}> Contar mi trabajo en los costos</label>
      <label class="campo"><span>Valor de una hora de trabajo (pesos)</span><input name="valor_hora_cop" inputmode="numeric" value="${esc(a.valor_hora_cop)}"><small>Estimado inicial: un jornal rural de ~$80.000 por 8 horas. Pon lo que pagarías a un trabajador.</small></label>
      <label class="campo"><span>Tarifa de la luz ($ por kWh)</span><input name="tarifa_kwh_cop" inputmode="numeric" value="${esc(a.tarifa_kwh_cop)}"><small>${tarifa ? `Referencia: pliego tarifario de ${esc(tarifa.empresa)} de ${esc(/^\d{4}-\d{2}$/.test(tarifa.fecha || '') ? `${MESES[Number(tarifa.fecha.slice(5)) - 1]} de ${tarifa.fecha.slice(0, 4)}` : tarifa.fecha)} (costo unitario según la Res. CREG 119 de 2007), estrato ${esc(tarifa.estrato)}, ${pesos(tarifa.cop_kwh)} por kWh. ` : ''}La de tu recibo es la que vale.</small></label>
      <label class="campo"><span>Huevos por cubeta</span><input name="huevos_por_cubeta" inputmode="numeric" value="${esc(a.huevos_por_cubeta)}"></label>
      <label class="campo"><span>Estilo del mapa</span><select name="estilo_mapa">${opciones([['juguete', 'Juguete (recomendado)'], ['diorama', 'Diorama']], a.estilo_mapa === 'diorama' ? 'diorama' : 'juguete')}</select><small>El estilo Satélite está apagado: las fotos de Esri solo se pueden usar con su programa o con suscripción (sus términos del 21-abr-2025). La finca escaneada se ve siempre en Juguete.</small></label>
      <label class="campo"><span>Gráficos del mapa</span><select name="graficos_mapa">${opciones([['nuevo', 'Nuevos: pasto, flores y sombras nítidas'], ['clasico', 'De antes: más livianos']], a.graficos_mapa === 'clasico' ? 'clasico' : 'nuevo')}</select><small>Solo cambian el estilo Juguete. Si el mapa se traba en este teléfono, prueba los de antes: dibujan menos cosas. Los animales se mueven igual con los dos.</small></label>
      <button class="btn ancho">Guardar ajustes</button>
    </form>

    <h3 class="seccion">Respaldo</h3>
    <div class="tarjeta">
      <p style="margin-top:0">${a.ultimo_respaldo ? `Último respaldo: <b>${fechaCorta(a.ultimo_respaldo)}</b>.` : '<b>Nunca has guardado un respaldo.</b>'} Guárdalo en Drive o mándatelo por WhatsApp: si pierdes el teléfono, con ese archivo recuperas la finca. Las fotos del escáner y el relieve bajado no van en ese archivo: se quedan en este teléfono.</p>
      <div class="botonera"><button class="btn" data-descargar>💾 Descargar respaldo</button><label class="btn suave">📂 Recuperar de un archivo<input type="file" accept="application/json,.json" data-importar hidden></label></div>
    </div>

    <h3 class="seccion">Instalar en el teléfono</h3>
    <div class="tarjeta">
      ${instalada ? '<p style="margin:0">✅ La app está instalada.</p>' : iphone ? '<p style="margin:0">En Safari toca <b>Compartir</b> (el cuadro con la flecha) y luego <b>«Agregar a inicio»</b>. Ojo: en el iPhone la app instalada puede guardar aparte de Safari y abrir vacía; si ya anotaste aquí, descarga primero un respaldo y recupéralo en la app instalada. Ábrela dos veces con señal y pasa por cada pantalla: desde ahí abre sin internet. Instalada, WebKit (el motor de Safari) dice que no espera borrarle sus datos, pero no lo garantiza: sigue descargando respaldos.</p>' : '<p style="margin:0">En el menú del navegador toca <b>«Instalar app»</b> o <b>«Agregar a la pantalla principal»</b>.</p>'}
      <p class="suave chico" style="margin-bottom:0">Almacenamiento ${persistida ? 'protegido: el navegador no lo borra para hacer espacio' : 'sin protección todavía: instala la app y descarga respaldos'}.</p>
    </div>

    <h3 class="seccion">Finca de prueba</h3>
    <div class="tarjeta">
      ${estado.demo ? '<p style="margin-top:0">Estás viendo una <b>finca de prueba con números inventados</b>.</p><button class="btn oro ancho" data-mia>Borrarla y empezar la mía</button>' : vacia ? '<p style="margin-top:0">¿Quieres ver cómo se ve la app con datos? Carga una finca de prueba; luego la borras.</p><button class="btn suave ancho" data-prueba>Cargar finca de prueba</button>' : '<p class="suave" style="margin:0">Ya tienes datos propios: la finca de prueba no se carga encima.</p>'}
    </div>

    <h3 class="seccion">Zona de peligro</h3>
    <button class="btn peligro ancho" data-borrar>Borrar todos los datos de este teléfono</button>
    <p class="suave chico">Finca Viva ${esc(document.querySelector('meta[name=version]')?.content || '0.1')} · los datos viven solo en este teléfono.</p>
  </div>`
  enlazar(raiz, ctx)

  raiz.querySelector('[data-ajustes]').addEventListener('submit', (e) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.target))
    ctx.cambiar((est) => {
      est.finca = { ...(est.finca || { creada: ctx.hoy }), nombre: f.nombre?.trim() || est.finca?.nombre || 'Mi finca' }
      est.ajustes.contar_mano_obra = !!f.contar_mano_obra
      est.ajustes.valor_hora_cop = leerNumero(f.valor_hora_cop, { entero: true }) ?? est.ajustes.valor_hora_cop
      est.ajustes.tarifa_kwh_cop = leerNumero(f.tarifa_kwh_cop, { entero: true }) ?? est.ajustes.tarifa_kwh_cop
      est.ajustes.huevos_por_cubeta = leerNumero(f.huevos_por_cubeta, { entero: true }) || 30
      est.ajustes.estilo_mapa = f.estilo_mapa
      est.ajustes.graficos_mapa = f.graficos_mapa === 'clasico' ? 'clasico' : 'nuevo'
    }, { mensaje: 'Ajustes guardados' })
  })
  raiz.querySelector('[data-descargar]').addEventListener('click', () => {
    ctx.cambiar((est) => { est.ajustes.ultimo_respaldo = ctx.hoy }, { repintar: true, mensaje: 'Respaldo descargado' })
    descargar(`finca-viva-${ctx.hoy}.json`, aRespaldo(ctx.estado))
  })
  raiz.querySelector('[data-importar]').addEventListener('change', async (e) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    try {
      const nuevo = deRespaldo(await archivo.text())
      const n = nuevo.registros.length + nuevo.ventas.length + nuevo.compras.length
      if (!confirm(`El respaldo «${archivo.name}» trae ${n} movimientos de «${nuevo.finca?.nombre || 'sin nombre'}». Reemplaza TODO lo que hay en este teléfono. ¿Seguir?`)) return
      ctx.reemplazar(nuevo, 'Finca recuperada del respaldo')
    } catch (err) {
      avisar(err.message, 'error')
    }
  })
  raiz.querySelector('[data-mia]')?.addEventListener('click', () => {
    if (confirm('¿Borrar la finca de prueba? Empiezas en blanco.')) ctx.reemplazar(estadoVacio(), 'Listo: ahora es tu finca')
  })
  raiz.querySelector('[data-prueba]')?.addEventListener('click', () => ctx.reemplazar(crearFincaDePrueba(ctx.hoy), 'Finca de prueba cargada: los números son inventados'))
  raiz.querySelector('[data-borrar]').addEventListener('click', async () => {
    if (!confirm('¿Borrar TODO? Sistemas, registros, ventas, compras. No se puede deshacer.')) return
    if (!confirm('Última pregunta: ¿ya descargaste un respaldo? Si no, esto se pierde para siempre.')) return
    await borrarTodo()
    ctx.reemplazar(estadoVacio(), 'Datos borrados')
  })
}
