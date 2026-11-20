// Escanear la finca: caminarla con el celular para que el mapa deje de ser el
// de ejemplo. Cuatro pasos, cada uno sirve solo: ubicar la finca (y bajar su
// relieve), caminar el lindero, marcar lo que hay o se planea, y tomar
// panorámicas.
//
// Lo que NO es: un levantamiento topográfico. El GPS de un celular acierta a
// unos 3 a 10 m; sirve para planear dónde va cada cosa y cuánta tierra hay, no
// para escrituras ni linderos en disputa. La pantalla lo dice y muestra la
// precisión de cada lectura en vez de esconderla.
//
// Los sensores solo existen con https y con permiso del dueño: nada se pide al
// abrir la pantalla, todo empieza con un toque (Safari además lo exige así para
// la brújula). La cuenta está en lib/topografia.js; aquí va lo que mide.

import { CLASES_SITIO, aceptarPunto, mejorLectura, resumenLindero, distanciaM, rumboBrujula, nombreRumbo, sectorDe, medidas } from '../../lib/topografia.js'
import { nuevoId } from '../../lib/modelo.js'
import { fechaCorta } from '../../lib/fechas.js'
import { bajarRelieve, borrarRelieve, relieveDeLaFinca } from '../../mapa/relieve-vivo.js'
import { reducir, reducirArchivo, guardarFoto, borrarFoto, borrarTodasLasFotos, fotosDeSitio } from '../fotos.js'
import { abrirPanorama } from '../panorama.js'
import { esc, numero, cabeza, opciones, avisar, enlazar } from '../ui.js'

const SECTORES = 12 // una foto cada 30°
const redondo = (g) => +g.toFixed(7) // 7 decimales de grado son 1 cm: de sobra

function textoArea(a) {
  const m = medidas(a)
  return `${numero(m.m2)} m² · ${numero(m.hectareas, 2)} ha · ${numero(m.fanegadas, 2)} fanegadas`
}

export async function pantallaEscanear(raiz, ctx) {
  let vivo = true
  let vigia = null // id de watchPosition
  let lecturas = [] // las de los últimos 8 s, para promediar al marcar
  let errorGps = ''
  let brujula = 'apagada' // apagada | esperando | ok | negada | sin
  let rumbo = null // suavizado, para mostrar y para orientar un sitio
  let rumboCrudo = null // sin suavizar, para la panorámica: el suavizado va medio segundo atrás del giro
  let sen = 0, cos = 0
  let precisionBrujula = null
  let grabando = false
  let borrador = (ctx.estado.finca?.terreno?.borrador || []).map(([lat, lon, precision]) => ({ lat, lon, precision }))
  let relieve = '' // '' | bajando | error
  let errorRelieve = ''
  let candado = null
  let camara = null // la panorámica en curso, para poder cerrarla al salir
  let hayRelieve = ctx.estado.finca?.terreno?.origen ? !(await relieveDeLaFinca(ctx.estado.finca.terreno.origen)).plano : false

  const terreno = () => ctx.estado.finca?.terreno || null
  const sitios = () => ctx.estado.mapa || []
  const guardar = (fn, mensaje) => ctx.cambiar(fn, { repintar: false, mensaje })
  const ultima = () => lecturas[lecturas.length - 1] || null

  raiz.innerHTML = `<div class="pantalla escanear">
    ${cabeza('📡 Escanear la finca')}
    <p class="suave">Camina tu finca con el celular y el mapa deja de ser el de ejemplo. Sirve para planear dónde va cada cosa y cuánta tierra hay; <b>no reemplaza a un topógrafo</b> para escrituras o linderos.</p>
    <div data-sensores></div>
    <h3 class="seccion">1 · Ubicar la finca</h3><div data-origen></div>
    <h3 class="seccion">2 · Caminar el lindero</h3><div data-lindero></div>
    <h3 class="seccion">3 · Marcar lo que hay y lo que planeas</h3><div data-marcar></div><div data-sitios></div>
    <h3 class="seccion">4 · Panorámicas</h3><div data-panos></div>
    <a class="btn oro ancho" href="#/finca">🏡 Ver mi finca en el mapa</a>
    <details class="tarjeta" style="margin-top:14px"><summary><b>Lo que este escáner puede y no puede</b></summary>
      <ul class="suave chico" style="padding-left:18px;line-height:1.5;margin-bottom:0">
        <li>El GPS de un celular acierta a unos 3 a 10 metros con cielo abierto, y peor bajo árboles o junto a un barranco. El área sale con ese margen.</li>
        <li>El relieve no lo mide el celular: se baja una vez de datos abiertos (SRTM, una medida cada 30 metros). Muestra la forma de la ladera, no cada zanja.</li>
        <li>La brújula marca el norte magnético y se descuadra cerca de metal, carros o cables.</li>
        <li>Una panorámica son hasta 12 fotos alrededor, una cada 30 grados. No es una sola foto cosida.</li>
        <li>Las fotos se quedan en este teléfono y no viajan en el respaldo.</li>
        <li>Para bajar el relieve, la app pide los mosaicos de la zona a un servidor público (AWS). Ese servidor ve qué cuadro de unos 2,4 km se pidió, no el punto exacto ni tus datos.</li>
        <li>Safari deja de medir si se bloquea la pantalla o se cambia de app: mantén esta pantalla abierta mientras caminas.</li>
      </ul></details>
    <button class="btn peligro ancho" data-acc="borrar-escaneo" style="margin-top:12px">Borrar el escaneo y volver al mapa de ejemplo</button>
  </div>`
  enlazar(raiz, ctx)
  const $ = (s) => raiz.querySelector(s)

  // ---------- Sensores ----------
  function alLeer(pos) {
    const c = pos.coords
    const l = { lat: c.latitude, lon: c.longitude, alt: Number.isFinite(c.altitude) ? c.altitude : null, precision: c.accuracy, t: Date.now() }
    errorGps = ''
    lecturas.push(l)
    lecturas = lecturas.filter((x) => x.t >= l.t - 8000)
    if (grabando && aceptarPunto(borrador[borrador.length - 1], l).ok) {
      borrador.push({ lat: l.lat, lon: l.lon, precision: l.precision })
      // Cada 5 puntos se guarda el avance: si Safari recarga la página a mitad
      // del recorrido, no hay que volver a empezar.
      if (borrador.length % 5 === 0) guardarBorrador()
    }
    if (!vivo) return
    pintarSensores()
    if (grabando) pintarLindero()
  }
  function alFallar(err) {
    errorGps = err.code === 1 ? 'Sin permiso de ubicación: actívalo para Safari en los Ajustes del teléfono.' : err.code === 2 ? 'El teléfono no encuentra señal de GPS: sal a cielo abierto.' : 'El GPS tardó demasiado: espera un momento a cielo abierto.'
    if (vivo) pintarSensores()
  }
  function encenderGps() {
    if (!navigator.geolocation) { errorGps = 'Este aparato no tiene GPS.'; return }
    if (vigia != null) return
    vigia = navigator.geolocation.watchPosition(alLeer, alFallar, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 })
  }
  let ultimoPintado = 0
  function alGirar(ev) {
    const g = rumboBrujula(ev)
    if (g == null) return
    rumboCrudo = g
    // Promedio circular: 359° y 1° promedian 0°, no 180°.
    const a = (g * Math.PI) / 180
    if (brujula !== 'ok') { sen = Math.sin(a); cos = Math.cos(a) } else { sen = sen * 0.75 + Math.sin(a) * 0.25; cos = cos * 0.75 + Math.cos(a) * 0.25 }
    rumbo = ((Math.atan2(sen, cos) * 180) / Math.PI + 360) % 360
    precisionBrujula = typeof ev.webkitCompassAccuracy === 'number' && ev.webkitCompassAccuracy >= 0 ? ev.webkitCompassAccuracy : null
    brujula = 'ok'
    const ahora = Date.now()
    if (vivo && ahora - ultimoPintado > 300) { ultimoPintado = ahora; pintarSensores() }
  }
  async function encenderBrujula() {
    if (brujula === 'ok' || brujula === 'esperando') return
    try {
      // iPhone pide permiso aparte para la brújula, y solo dentro de un toque.
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        if ((await DeviceOrientationEvent.requestPermission()) !== 'granted') { brujula = 'negada'; return }
      }
      if (typeof DeviceOrientationEvent === 'undefined') { brujula = 'sin'; return }
      addEventListener('deviceorientationabsolute', alGirar)
      addEventListener('deviceorientation', alGirar)
      brujula = 'esperando'
      // Un computador tiene el evento pero no la brújula: si en 3 s no llega nada, se dice.
      setTimeout(() => { if (brujula === 'esperando') { brujula = 'sin'; if (vivo) pintarSensores() } }, 3000)
    } catch {
      brujula = 'sin'
    }
  }
  // Al marcar se mide de nuevo, 3 s con el teléfono quieto: lo leído antes del
  // toque es el camino de llegada, no el sitio (el promedio quedaba unos metros
  // atrás). Si en ese rato no llega ninguna lectura, vale la última.
  let midiendo = false
  async function medirAqui(boton, ms = 3000) {
    if (midiendo) return null
    if (vigia == null || !ultima()) { avisar(vigia == null ? 'Primero enciende el GPS' : 'Todavía no hay lectura del GPS', 'error'); return null }
    midiendo = true
    const texto = boton?.textContent
    if (boton) { boton.disabled = true; boton.textContent = '⏳ Midiendo… quédate quieto' }
    const desde = Date.now()
    await new Promise((ok) => setTimeout(ok, ms))
    midiendo = false
    if (boton?.isConnected) { boton.disabled = false; boton.textContent = texto }
    if (!vivo) return null
    const frescas = lecturas.filter((l) => l.t >= desde)
    return mejorLectura(frescas.length ? frescas : lecturas.slice(-1))
  }
  async function pedirCandado() {
    try { candado = candado || (await navigator.wakeLock?.request('screen')) || null } catch { candado = null }
  }
  function soltarCandado() {
    try { candado?.release() } catch { /* ya estaba suelto */ }
    candado = null
  }

  function pintarSensores() {
    const u = ultima()
    const calidad = !u ? '' : u.precision <= 8 ? 'buena' : u.precision <= 20 ? 'regular' : 'mala'
    const gps = vigia == null && !errorGps
      ? '<span class="etiqueta">GPS apagado</span>'
      : errorGps
        ? `<span class="etiqueta rojo">GPS: ${esc(errorGps)}</span>`
        : u
          ? `<span class="etiqueta ${calidad === 'buena' ? 'verde' : calidad === 'regular' ? 'oro' : 'rojo'}">GPS ±${numero(u.precision)} m · ${calidad}</span>${u.alt != null ? ` <span class="etiqueta cielo">${numero(u.alt)} m de altura (GPS)</span>` : ''}`
          : '<span class="etiqueta oro">GPS: buscando señal…</span>'
    const br = { apagada: '<span class="etiqueta">Brújula apagada</span>', esperando: '<span class="etiqueta oro">Brújula: esperando…</span>', negada: '<span class="etiqueta rojo">Brújula sin permiso</span>', sin: '<span class="etiqueta">Este aparato no tiene brújula</span>' }[brujula]
      || `<span class="etiqueta verde">🧭 ${nombreRumbo(rumbo)} · ${Math.round(rumbo)}°</span>${precisionBrujula != null && precisionBrujula > 25 ? ' <span class="etiqueta rojo">brújula descuadrada: aléjate de metal</span>' : ''}`
    // Con el GPS ya encendido, la brújula se puede volver a pedir aparte: si el
    // permiso se negó la primera vez, no había cómo reintentar.
    const faltaBrujula = vigia != null && (brujula === 'apagada' || brujula === 'negada')
    $('[data-sensores]').innerHTML = `<div class="tarjeta">
      <p style="margin:0 0 8px">${gps} ${br}</p>
      ${vigia == null ? '<button class="btn ancho" data-acc="sensores">📍 Encender GPS y brújula</button><p class="suave chico" style="margin:8px 0 0">El teléfono te va a pedir permiso de ubicación y de movimiento.</p>' : calidad === 'mala' ? '<p class="suave chico" style="margin:0">Señal mala: espera a cielo abierto antes de marcar.</p>' : ''}
      ${faltaBrujula ? `<button class="btn suave ancho" data-acc="brujula" style="margin-top:8px">🧭 Encender la brújula</button>${brujula === 'negada' ? '<p class="suave chico" style="margin:8px 0 0">El teléfono negó el permiso de movimiento. Si no vuelve a preguntar, puede que haya que cerrar Safari del todo y abrirlo otra vez. Sin brújula se puede escanear igual: los sitios quedan sin orientación.</p>' : ''}` : ''}
      ${location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '<div class="ob-error" style="margin-top:8px">Esta dirección no es https: el teléfono no entrega GPS, brújula ni cámara.</div>' : ''}
    </div>`
  }

  // ---------- 1 · Origen y relieve ----------
  function pintarOrigen() {
    const t = terreno()
    const o = t?.origen
    // El relieve vive aparte del estado: tras recuperar un respaldo en otro
    // teléfono, el estado dice «bajado» pero el relieve no está aquí.
    const rel = hayRelieve ? t?.relieve : null
    $('[data-origen]').innerHTML = `<div class="tarjeta">
      ${o
        ? `<p style="margin:0 0 8px">✅ Punto de la finca guardado el ${fechaCorta(o.fecha)} (±${numero(o.precision)} m).</p>
           ${relieve === 'bajando' ? '<p class="suave" style="margin:0">⏳ Bajando el relieve de la zona…</p>'
            : rel ? `<p class="suave" style="margin:0">⛰️ Relieve bajado el ${fechaCorta(rel.fecha)}: aquí la ladera está a ${numero(rel.altura_m)} m sobre el nivel del mar (dato SRTM de 30 m).${rel.guardado === false ? ' <b>Este teléfono no dejó guardarlo: se pierde al cerrar.</b>' : ''}</p>`
            : `<p class="suave" style="margin:0 0 8px">${relieve === 'error' ? `No se pudo bajar el relieve (${esc(errorRelieve)}). ` : ''}Sin relieve, el mapa dibuja la finca sobre una mesa plana. Con señal de internet:</p><button class="btn suave ancho" data-acc="relieve">⛰️ Bajar el relieve</button>`}
           <button class="btn suave chico" data-acc="origen" style="margin-top:10px">Volver a marcar el punto</button>`
        : `<p style="margin:0 0 10px">Párate en un sitio central de la finca, a cielo abierto, y toca el botón. Ese punto queda como centro del mapa y se baja el relieve de la zona (1 a 2 MB, una sola vez).</p>
           <button class="btn oro ancho" data-acc="origen">📍 Estoy en la finca</button>`}
    </div>`
  }
  async function fijarOrigen(boton) {
    const m = await medirAqui(boton)
    if (!m) return
    if (m.precision > 30 && !confirm(`La señal está en ±${Math.round(m.precision)} m. ¿Guardar el punto de todos modos?`)) return
    if (terreno()?.origen && !confirm('¿Cambiar el punto de la finca? El lindero y los sitios marcados se conservan; el relieve se vuelve a bajar.')) return
    await borrarRelieve()
    hayRelieve = false
    guardar((est) => {
      est.finca ||= { nombre: 'Mi finca', creada: ctx.hoy }
      est.finca.terreno = { ...(est.finca.terreno || {}), origen: { lat: redondo(m.lat), lon: redondo(m.lon), alt: m.alt == null ? null : Math.round(m.alt), precision: Math.round(m.precision), fecha: ctx.hoy }, relieve: null }
    }, 'Punto de la finca guardado')
    pintarTodo()
    bajar()
  }
  async function bajar() {
    const o = terreno()?.origen
    if (!o || relieve === 'bajando') return
    if (navigator.onLine === false) { relieve = 'error'; errorRelieve = 'no hay internet'; pintarOrigen(); return }
    relieve = 'bajando'
    pintarOrigen()
    try {
      const r = await bajarRelieve(o.lat, o.lon)
      guardar((est) => { est.finca.terreno.relieve = { fecha: ctx.hoy, altura_m: r.cerca.altura_centro_m, mosaicos: r.cerca.mosaicos + r.paisaje.mosaicos, guardado: r.guardado } }, 'Relieve de la finca bajado')
      relieve = ''
      hayRelieve = true
    } catch (e) {
      relieve = 'error'
      errorRelieve = e.message
    }
    if (vivo) pintarOrigen()
  }

  // ---------- 2 · Lindero ----------
  function guardarBorrador() {
    guardar((est) => { if (est.finca?.terreno) est.finca.terreno.borrador = borrador.map((p) => [redondo(p.lat), redondo(p.lon), Math.round(p.precision)]) })
  }
  function pintarLindero() {
    const t = terreno()
    const caja = $('[data-lindero]')
    if (!t?.origen) { caja.innerHTML = '<div class="tarjeta"><p class="suave" style="margin:0">Primero ubica la finca (paso 1).</p></div>'; return }
    if (grabando || borrador.length) {
      const res = borrador.length >= 2 ? resumenLindero(t.origen, borrador) : null
      const falta = borrador.length >= 2 ? distanciaM(borrador[0], borrador[borrador.length - 1]) : null
      caja.innerHTML = `<div class="tarjeta">
        <p style="margin:0 0 6px"><b>${grabando ? '🔴 Caminando el lindero' : '⏸️ Recorrido en pausa'}</b></p>
        <p class="suave" style="margin:0 0 10px">${borrador.length} puntos${res ? ` · ${numero(res.perimetro_m)} m caminados` : ''}${res && res.puntos >= 3 ? ` · van ${textoArea(res.area_m2)}` : ''}${falta != null ? `<br>Estás a ${numero(falta)} m de donde empezaste${borrador.length >= 8 && falta < 15 ? ': <b>ya puedes cerrar</b>' : ''}.` : ''}</p>
        <div class="botonera">
          <button class="btn oro" data-acc="lindero-cerrar">✅ Cerrar el lindero</button>
          <button class="btn suave" data-acc="${grabando ? 'lindero-pausar' : 'lindero-iniciar'}">${grabando ? '⏸️ Pausar' : '▶️ Seguir'}</button>
          <button class="btn suave" data-acc="lindero-descartar">Descartar</button>
        </div>
        <p class="suave chico" style="margin:0">Camina por el borde con el celular en la mano y esta pantalla abierta. Quieto no se suman puntos.</p>
      </div>`
      return
    }
    const l = t.lindero
    caja.innerHTML = `<div class="tarjeta">
      ${l ? `<p style="margin:0 0 4px">✅ Lindero caminado el ${fechaCorta(l.fecha)}: <b>${textoArea(l.area_m2)}</b></p><p class="suave chico" style="margin:0 0 10px">Perímetro de ${numero(l.perimetro_m)} m · ${l.puntos.length} puntos · GPS a ±${numero(l.precision_m)} m. El área puede variar unos puntos porcentuales: es para planear.</p>` : '<p style="margin:0 0 10px">Párate en el borde de la finca, toca el botón y da la vuelta completa por el lindero. Al volver a donde empezaste, ciérralo y la app saca el área. Si empiezas lejos del borde, ese tramo también se cuenta.</p>'}
      <button class="btn ${l ? 'suave' : 'oro'} ancho" data-acc="lindero-iniciar">🚶 ${l ? 'Volver a caminar el lindero' : 'Empezar a caminar el lindero'}</button>
    </div>`
  }
  function iniciarLindero() {
    if (vigia == null) return avisar('Primero enciende el GPS', 'error')
    if (!borrador.length && terreno()?.lindero && !confirm('¿Volver a caminar el lindero? El anterior se reemplaza cuando cierres el nuevo.')) return
    grabando = true
    pedirCandado()
    pintarLindero()
  }
  function cerrarLindero() {
    const t = terreno()
    const res = resumenLindero(t.origen, borrador)
    if (res.puntos < 3 || res.area_m2 < 25) return avisar('Faltan puntos: camina el borde completo antes de cerrar', 'error')
    const falta = distanciaM(borrador[0], borrador[borrador.length - 1])
    if (falta > 25 && !confirm(`Estás a ${Math.round(falta)} m de donde empezaste. Si cierras ahora, el lindero corta en línea recta hasta el inicio. ¿Cerrar?`)) return
    const puntos = borrador.map((p) => [redondo(p.lat), redondo(p.lon)])
    guardar((est) => {
      est.finca.terreno.lindero = { puntos, area_m2: Math.round(res.area_m2), perimetro_m: Math.round(res.perimetro_m), precision_m: Math.round(res.precision_m), fecha: ctx.hoy }
      delete est.finca.terreno.borrador
    }, `Lindero cerrado: ${numero(res.hectareas, 2)} ha`)
    grabando = false
    borrador = []
    soltarCandado()
    pintarLindero()
  }
  function descartarLindero() {
    if (!confirm('¿Descartar este recorrido?')) return
    grabando = false
    borrador = []
    soltarCandado()
    guardar((est) => { if (est.finca?.terreno) delete est.finca.terreno.borrador })
    pintarLindero()
  }

  // ---------- 3 · Sitios ----------
  function pintarMarcar() {
    const caja = $('[data-marcar]')
    if (!terreno()?.origen) { caja.innerHTML = '<div class="tarjeta"><p class="suave" style="margin:0">Primero ubica la finca (paso 1).</p></div>'; return }
    const clases = Object.entries(CLASES_SITIO).filter(([k]) => k !== 'panoramica').map(([k, c]) => [k, `${c.emoji} ${c.nombre}`])
    caja.innerHTML = `<form class="tarjeta" data-form-marcar>
      <div class="dos">
        <label class="campo"><span>¿Qué es?</span><select name="clase">${opciones(clases, 'casa')}</select></label>
        <label class="campo"><span>Nombre (opcional)</span><input name="nombre" maxlength="40" autocomplete="off" placeholder="Ej.: Potrero de abajo"></label>
      </div>
      <label class="marcar"><input type="checkbox" name="plan"> Todavía no existe: lo planeo aquí</label>
      <button class="btn oro ancho">📍 Marcar aquí</button>
      <p class="suave chico" style="margin:8px 0 0">Párate donde está (o donde irá), apunta el celular hacia donde mira su frente y quédate quieto 3 segundos después de tocar: así queda bien puesto y orientado en el mapa. El gallinero se dibuja con su parque de pastoreo al frente.</p>
    </form>`
  }
  async function marcar(form) {
    const f = new FormData(form) // se lee antes de medir: lo que estaba escrito al tocar
    const m = await medirAqui(form.querySelector('button'))
    if (!m) return
    if (m.precision > 25 && !confirm(`La señal está en ±${Math.round(m.precision)} m. ¿Marcar de todos modos?`)) return
    const clase = f.get('clase')
    const c = CLASES_SITIO[clase]
    const sitio = { id: nuevoId(), clase, nombre: String(f.get('nombre') || '').trim() || c.nombre, lat: redondo(m.lat), lon: redondo(m.lon), alt: m.alt == null ? null : Math.round(m.alt), rumbo: rumbo == null ? null : Math.round(rumbo), precision: Math.round(m.precision), plan: f.get('plan') === 'on', fecha: ctx.hoy }
    guardar((est) => est.mapa.push(sitio), `${c.emoji} ${sitio.nombre} marcado`)
    form.reset()
    pintarSitios()
  }
  function pintarSitios() {
    const o = terreno()?.origen
    const lista = sitios().filter((s) => s.clase !== 'panoramica')
    $('[data-sitios]').innerHTML = lista.length
      ? `<div class="lista">${lista.map((s) => {
          const c = CLASES_SITIO[s.clase] || CLASES_SITIO.otro
          return `<div class="item"><span class="emoji">${c.emoji}</span><div class="cuerpo"><b>${esc(s.nombre)}${s.plan ? ' <span class="etiqueta cielo">plan</span>' : ''}</b><span>±${numero(s.precision)} m${s.rumbo != null ? ` · mira al ${nombreRumbo(s.rumbo)}` : ' · sin rumbo'}${o ? ` · a ${numero(distanciaM(o, s))} m del centro` : ''}${s.foto ? ' · 📷 con foto' : ''}</span></div>
            <label class="icono-btn" aria-label="Tomar foto">📷<input type="file" accept="image/*" capture="environment" hidden data-foto-de="${esc(s.id)}"></label>
            <button class="icono-btn" data-acc="quitar-sitio" data-id="${esc(s.id)}" aria-label="Quitar">🗑️</button></div>`
        }).join('')}</div>`
      : ''
  }
  async function fotoDeSitio(input) {
    const archivo = input.files?.[0]
    const id = input.dataset.fotoDe
    if (!archivo) return
    try {
      const blob = await reducirArchivo(archivo)
      const fotoId = nuevoId()
      const quedo = await guardarFoto(fotoId, blob)
      const vieja = sitios().find((s) => s.id === id)?.foto
      guardar((est) => { const s = est.mapa.find((x) => x.id === id); if (s) s.foto = fotoId }, quedo ? 'Foto guardada en este teléfono' : 'Este teléfono no dejó guardar la foto: se pierde al cerrar')
      if (vieja) borrarFoto(vieja)
      if (vivo) pintarSitios()
    } catch (e) {
      avisar('No se pudo guardar la foto: ' + e.message, 'error')
    }
  }
  function quitarSitio(id) {
    const s = sitios().find((x) => x.id === id)
    if (!s || !confirm(`¿Quitar «${s.nombre}» del mapa?${fotosDeSitio(s).length ? ' Sus fotos también se borran.' : ''}`)) return
    fotosDeSitio(s).forEach(borrarFoto)
    guardar((est) => { est.mapa = est.mapa.filter((x) => x.id !== id) }, 'Quitado del mapa')
    pintarSitios()
    pintarPanos()
  }

  // ---------- 4 · Panorámicas ----------
  function pintarPanos() {
    const caja = $('[data-panos]')
    if (!terreno()?.origen) { caja.innerHTML = '<div class="tarjeta"><p class="suave" style="margin:0">Primero ubica la finca (paso 1).</p></div>'; return }
    const lista = sitios().filter((s) => s.clase === 'panoramica')
    caja.innerHTML = `<div class="tarjeta">
      <p style="margin:0 0 10px">Donde haya buena vista, gira despacio sobre los pies: la app toma una foto cada 30 grados y después se miran girando, aquí y en el mapa.</p>
      <button class="btn oro ancho" data-acc="pano">📷 Tomar una panorámica aquí</button>
    </div>
    ${lista.length ? `<div class="lista">${lista.map((s) => `<div class="item"><span class="emoji">📷</span><div class="cuerpo"><b>${esc(s.nombre)}</b><span>${(s.cuadros || []).length} fotos · ${fechaCorta(s.fecha)} · ±${numero(s.precision)} m</span></div>
      <button class="btn suave chico" data-acc="ver-pano" data-id="${esc(s.id)}">Ver</button>
      <button class="icono-btn" data-acc="quitar-sitio" data-id="${esc(s.id)}" aria-label="Quitar">🗑️</button></div>`).join('')}</div>` : ''}`
  }
  async function tomarPanoramica() {
    const lugar = ultima()
    if (!lugar) return avisar(vigia == null ? 'Primero enciende el GPS' : 'Todavía no hay lectura del GPS', 'error')
    if (!navigator.mediaDevices?.getUserMedia) return avisar('Este navegador no deja usar la cámara', 'error')
    let flujo
    try {
      flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
    } catch (e) {
      return avisar(e.name === 'NotAllowedError' ? 'Sin permiso de cámara: actívalo para Safari en los Ajustes del teléfono' : 'No se pudo abrir la cámara', 'error')
    }
    pedirCandado()
    const conBrujula = brujula === 'ok'
    const tomados = [] // { sector, rumbo, blob }
    const velo = document.createElement('div')
    velo.className = 'velo pano captura'
    velo.innerHTML = `<div class="pano-caja">
      <video autoplay playsinline muted></video>
      <div class="pano-arriba"><b data-titulo></b><button class="icono-btn" data-cancelar aria-label="Cancelar">✕</button></div>
      <div class="pano-anillo">${Array.from({ length: SECTORES }, (_, i) => `<i data-s="${i}" style="transform:rotate(${i * (360 / SECTORES)}deg) translateY(-34px)"></i>`).join('')}<span data-aguja>▲</span></div>
      <div class="pano-abajo"><span data-guia></span>
        <div class="botonera" style="margin:8px 0 0">${conBrujula ? '' : '<button class="btn" data-disparo>📸 Tomar foto</button>'}<button class="btn oro" data-guardar disabled>Guardar</button></div></div>
    </div>`
    document.body.appendChild(velo)
    const video = velo.querySelector('video')
    video.srcObject = flujo
    video.play().catch(() => { /* con autoplay y sin sonido ya arranca solo; esto es por si acaso */ })
    let ocupado = false
    let rumboAntes = rumboCrudo, tiempoAntes = Date.now()
    let rapido = false
    const pintarCaptura = () => {
      velo.querySelector('[data-titulo]').textContent = `Panorámica · ${tomados.length} de ${SECTORES} fotos`
      velo.querySelector('[data-guia]').textContent = conBrujula
        ? (tomados.length >= SECTORES ? '¡Vuelta completa! Toca Guardar.' : rapido ? 'Vas muy rápido: gira más despacio.' : `Gira despacio sobre los pies. Mirando al ${nombreRumbo(rumboCrudo)} · ${Math.round(rumboCrudo)}°. Los puntos grises son las fotos que faltan.`)
        : 'Sin brújula: toma una foto, gira un poco a la derecha y toma la siguiente.'
      velo.querySelector('[data-guardar]').disabled = tomados.length < 3
      for (const n of velo.querySelectorAll('.pano-anillo i')) n.classList.toggle('hecho', tomados.some((t) => t.sector === Number(n.dataset.s)))
      if (conBrujula) velo.querySelector('[data-aguja]').style.transform = `rotate(${rumboCrudo}deg) translateY(-34px)`
    }
    const disparar = async (sector, r) => {
      if (ocupado || !video.videoWidth) return
      ocupado = true
      try {
        const blob = await reducir(video, video.videoWidth, video.videoHeight)
        tomados.push({ sector, rumbo: r, blob })
        velo.classList.add('destello')
        setTimeout(() => velo.classList.remove('destello'), 120)
      } catch { /* un cuadro que falla no daña la vuelta: se vuelve a intentar al pasar */ }
      ocupado = false
      pintarCaptura()
    }
    const reloj = setInterval(() => {
      if (!conBrujula || rumboCrudo == null) return
      // A pleno día la foto no sale movida aunque se gire: el límite (60° por
      // segundo, una vuelta en 6 s) es para que alcance a caer una foto en cada
      // tajada de 30°. Más rápido que eso se avisa y no se dispara.
      const ahora = Date.now()
      const giro = Math.abs(((rumboCrudo - rumboAntes + 540) % 360) - 180) / Math.max(0.05, (ahora - tiempoAntes) / 1000)
      rumboAntes = rumboCrudo
      tiempoAntes = ahora
      rapido = giro > 60
      const s = sectorDe(rumboCrudo, SECTORES)
      if (!rapido && !tomados.some((t) => t.sector === s)) disparar(s, Math.round(rumboCrudo))
      pintarCaptura()
    }, 250)
    const cerrar = () => {
      clearInterval(reloj)
      flujo.getTracks().forEach((t) => t.stop())
      velo.remove()
      camara = null
      if (!grabando) soltarCandado()
    }
    camara = { cerrar }
    velo.querySelector('[data-cancelar]').addEventListener('click', () => { if (!tomados.length || confirm('¿Salir sin guardar las fotos?')) cerrar() })
    velo.querySelector('[data-disparo]')?.addEventListener('click', () => disparar(-1 - tomados.length, null))
    velo.querySelector('[data-guardar]').addEventListener('click', async () => {
      velo.querySelector('[data-guardar]').disabled = true
      velo.querySelector('[data-guia]').textContent = 'Guardando las fotos…'
      clearInterval(reloj)
      const aqui = mejorLectura(lecturas) || lugar
      const cuadros = []
      let quedaron = true
      for (const t of tomados) {
        const fotoId = nuevoId()
        quedaron = (await guardarFoto(fotoId, t.blob)) && quedaron
        cuadros.push({ rumbo: t.rumbo, foto: fotoId })
      }
      const n = sitios().filter((s) => s.clase === 'panoramica').length + 1
      const sitio = { id: nuevoId(), clase: 'panoramica', nombre: `Panorámica ${n}`, lat: redondo(aqui.lat), lon: redondo(aqui.lon), alt: aqui.alt == null ? null : Math.round(aqui.alt), rumbo: null, precision: Math.round(aqui.precision), plan: false, fecha: ctx.hoy, cuadros }
      guardar((est) => est.mapa.push(sitio), quedaron ? `Panorámica guardada: ${cuadros.length} fotos` : 'Este teléfono no dejó guardar las fotos: se pierden al cerrar')
      cerrar()
      if (vivo) pintarPanos()
    })
    pintarCaptura()
  }

  // ---------- Borrar todo el escaneo ----------
  async function borrarEscaneo() {
    if (!terreno() && !sitios().length) return avisar('No hay nada escaneado')
    if (!confirm('¿Borrar el escaneo? Se van el punto de la finca, el lindero, los sitios marcados, las fotos y el relieve bajado. Las cuentas y los registros no se tocan.')) return
    grabando = false
    borrador = []
    soltarCandado()
    await borrarTodasLasFotos()
    await borrarRelieve()
    hayRelieve = false
    guardar((est) => { if (est.finca) delete est.finca.terreno; est.mapa = [] }, 'Escaneo borrado: el mapa vuelve al de ejemplo')
    pintarTodo()
  }

  function pintarTodo() {
    pintarSensores()
    pintarOrigen()
    pintarLindero()
    pintarMarcar()
    pintarSitios()
    pintarPanos()
  }

  // Un solo oyente para toda la pantalla: las tarjetas se repintan y sus botones cambian.
  const pantalla = $('.pantalla')
  pantalla.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acc]')
    if (!b) return
    const acc = b.dataset.acc
    if (acc === 'sensores') { encenderGps(); await encenderBrujula(); pintarSensores() }
    else if (acc === 'brujula') { await encenderBrujula(); pintarSensores() }
    else if (acc === 'origen') fijarOrigen(b)
    else if (acc === 'relieve') bajar()
    else if (acc === 'lindero-iniciar') iniciarLindero()
    else if (acc === 'lindero-pausar') { grabando = false; guardarBorrador(); soltarCandado(); pintarLindero() }
    else if (acc === 'lindero-cerrar') cerrarLindero()
    else if (acc === 'lindero-descartar') descartarLindero()
    else if (acc === 'quitar-sitio') quitarSitio(b.dataset.id)
    else if (acc === 'ver-pano') { const s = sitios().find((x) => x.id === b.dataset.id); if (s) abrirPanorama(s) }
    else if (acc === 'pano') tomarPanoramica()
    else if (acc === 'borrar-escaneo') borrarEscaneo()
  })
  pantalla.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-form-marcar]')) return
    e.preventDefault()
    marcar(e.target)
  })
  pantalla.addEventListener('change', (e) => { if (e.target.matches('[data-foto-de]')) fotoDeSitio(e.target) })

  pintarTodo()

  return () => {
    vivo = false
    if (vigia != null) navigator.geolocation.clearWatch(vigia)
    removeEventListener('deviceorientationabsolute', alGirar)
    removeEventListener('deviceorientation', alGirar)
    if (grabando && borrador.length) guardarBorrador()
    camara?.cerrar()
    soltarCandado()
  }
}
