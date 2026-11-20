// Arranque de la app: carga la finca guardada, arma el contexto que reciben las
// pantallas y cambia de pantalla según el # de la dirección (#/cuentas, #/sistema/abc).
// Se usa el # y no rutas de verdad porque GitHub Pages no sabe redirigir: con #
// la app abre bien aunque se recargue en cualquier pantalla.

import { cargar, guardar, pedirPersistencia } from '../lib/almacen.js'
import { estadoVacio } from '../lib/modelo.js'
import { hoyISO } from '../lib/fechas.js'
import { calcularXP, nivelDe } from '../lib/juego.js'
import { avisar, celebrar, esc } from './ui.js'

// nombre de la ruta → [archivo de la pantalla, función que la pinta, pestaña de abajo]
const RUTAS = {
  finca: ['finca', 'pantallaFinca', 'finca'],
  sistemas: ['sistemas', 'pantallaSistemas', 'sistemas'],
  sistema: ['sistemas', 'pantallaFicha', 'sistemas'],
  'nuevo-sistema': ['sistemas', 'pantallaNuevoSistema', 'sistemas'],
  anotar: ['anotar', 'pantallaAnotar', 'anotar'],
  cuentas: ['cuentas', 'pantallaCuentas', 'cuentas'],
  venta: ['cuentas', 'pantallaVenta', 'cuentas'],
  compra: ['cuentas', 'pantallaCompra', 'cuentas'],
  gasto: ['cuentas', 'pantallaGasto', 'cuentas'],
  inventario: ['cuentas', 'pantallaInventario', 'cuentas'],
  insumo: ['cuentas', 'pantallaInsumo', 'cuentas'],
  calendario: ['calendario', 'pantallaCalendario', 'calendario'],
  aprende: ['aprende', 'pantallaAprende', ''],
  tecnica: ['aprende', 'pantallaTecnica', ''],
  construir: ['construir', 'pantallaConstruir', ''],
  precios: ['precios', 'pantallaPrecios', ''],
  logros: ['logros', 'pantallaLogros', ''],
  ajustes: ['ajustes', 'pantallaAjustes', ''],
  escanear: ['escanear', 'pantallaEscanear', ''],
}

const raiz = document.getElementById('app')
let estado = null
let persistente = true
let limpiar = null
let turno = 0
let rutaAnterior = ''
const catalogos = new Map()

function rutaActual() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  return { nombre: RUTAS[partes[0]] ? partes[0] : 'finca', params: partes.slice(1) }
}

// ---------- Guardado ----------
let pendiente = null
function programarGuardado() {
  clearTimeout(pendiente)
  pendiente = setTimeout(guardarYa, 250)
}
async function guardarYa() {
  clearTimeout(pendiente)
  pendiente = null
  const ok = await guardar(estado)
  if (!ok && persistente) {
    persistente = false
    avisar('Este teléfono no deja guardar: descarga un respaldo en Ajustes', 'error')
  }
}
// Si se cierra la app justo después de anotar, se guarda en ese instante.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pendiente) guardarYa() })
addEventListener('pagehide', () => { if (pendiente) guardarYa() })

// ---------- XP: avisar lo ganado ----------
let xpAntes = 0
function revisarXP(mensaje) {
  // Calcular la XP recorre toda la historia; se hace después de pintar para no frenar el toque.
  setTimeout(() => {
    const xp = calcularXP(estado, hoyISO()).total
    const ganada = xp - xpAntes
    const antes = nivelDe(xpAntes)
    const ahora = nivelDe(xp)
    xpAntes = xp
    if (ahora.numero > antes.numero) celebrar(ahora.emoji, `¡Nivel ${ahora.numero}: ${ahora.nombre}!`, 'Todo lo que anotas hace crecer tu finca en el juego. Sigue así.')
    else if (ganada > 0) avisar(`${mensaje ? mensaje + ' · ' : ''}+${ganada} XP`, 'xp')
    else if (mensaje) avisar(mensaje)
  }, 40)
}

// ---------- Contexto que recibe cada pantalla ----------
const ctx = {
  get estado() { return estado },
  get persistente() { return persistente },
  get hoy() { return hoyISO() },
  ir(r) { location.hash = '#/' + r },
  atras() { if (history.length > 1) history.back(); else ctx.ir('finca') },
  // TODA escritura pasa por aquí: modifica, guarda, avisa la XP y repinta.
  cambiar(fn, { mensaje, ir, repintar = true } = {}) {
    fn(estado)
    estado.actualizado = new Date().toISOString()
    programarGuardado()
    revisarXP(mensaje)
    if (ir) ctx.ir(ir)
    else if (repintar) pintar()
  },
  // Reemplaza la finca entera (importar un respaldo, cargar la de prueba, borrar).
  reemplazar(nuevo, mensaje) {
    estado = nuevo
    xpAntes = calcularXP(estado, hoyISO()).total
    guardarYa()
    if (mensaje) avisar(mensaje)
    ctx.ir('finca')
    pintar()
  },
  // Los datos de la investigación (datos/*.json). Si un archivo falta, la
  // pantalla recibe null y lo dice; no se cae.
  catalogo(nombre) {
    if (!catalogos.has(nombre)) catalogos.set(nombre, fetch(`datos/${nombre}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
    return catalogos.get(nombre)
  },
}

// ---------- Pintar la pantalla de la ruta ----------
async function pintar() {
  const mio = ++turno
  const { nombre, params } = rutaActual()
  const [archivo, funcion, pestana] = RUTAS[nombre]
  const misma = nombre === rutaAnterior.split('/')[0] && location.hash === rutaAnterior.slice(rutaAnterior.indexOf('#'))
  const y = scrollY
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('activo', a.dataset.nav === pestana)
  try {
    const modulo = await import(`./pantallas/${archivo}.js`)
    if (mio !== turno) return // el usuario ya se fue a otra pantalla
    if (limpiar) { try { limpiar() } catch { /* la pantalla anterior ya no importa */ } limpiar = null }
    raiz.innerHTML = ''
    raiz.className = nombre === 'finca' ? 'finca' : ''
    const r = await modulo[funcion](raiz, ctx, params)
    if (mio !== turno) { if (typeof r === 'function') r(); return }
    limpiar = typeof r === 'function' ? r : null
  } catch (err) {
    console.error(err)
    raiz.innerHTML = `<div class="pantalla"><div class="ob-error">Esta pantalla falló al abrir: ${esc(err.message)}</div><a class="btn" href="#/finca">Volver a la finca</a></div>`
  }
  // Repintar la misma pantalla (marcar una casilla) no debe mandar al usuario arriba.
  scrollTo(0, misma ? y : 0)
  rutaAnterior = nombre + '/' + location.hash
}

async function arrancar() {
  const r = await cargar()
  persistente = r.persistente
  estado = r.estado || estadoVacio()
  xpAntes = calcularXP(estado, hoyISO()).total
  pedirPersistencia()
  addEventListener('hashchange', pintar)
  pintar()
  // El trabajador de fondo (para que abra sin internet en la montaña) solo en
  // https: en el computador de desarrollo guardaría versiones viejas.
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {})
}

arrancar()
