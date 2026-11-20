// La pantalla de la finca: el mapa 3D con el tablero del juego encima.
//
// Lo que se ve en el mapa sale de lo anotado: un sistema que no existe se dibuja
// como plano azul («plan»), el parque tiene tantas gallinas como las que están
// vivas en el libro, y los números del tablero son los de las cuentas.
//
// Hay dos mapas. Mientras no se escanee la finca (pantalla Escanear) se dibuja
// la distribución de ejemplo sobre la ladera de ejemplo, y el aviso lo dice.
// Con la finca escaneada se dibuja lo que se caminó y se marcó, sobre el relieve
// bajado para ese punto.

import { crearMundo, FINCA_EJEMPLO } from '../../mapa/mundo.js'
import { relieveDeLaFinca } from '../../mapa/relieve-vivo.js'
import { armarFinca, CLASES_SITIO } from '../../lib/topografia.js'
import { urlFoto } from '../fotos.js'
import { abrirPanorama } from '../panorama.js'
import { estadoLuna } from '../../lib/luna.js'
import { resumen, avesVivas } from '../../lib/libro.js'
import { calcularXP, nivelDe, misionesDeSemana, arbolesSembrados, racha } from '../../lib/juego.js'
import { rangoMes, inicioSemana, MESES, fechaCorta } from '../../lib/fechas.js'
import { crearFincaDePrueba } from '../../lib/demo.js'
import { esc, pesos, porcentaje, enlazar } from '../ui.js'

const huevosDe = (estado, fecha) => estado.registros.filter((r) => r.fecha === fecha && r.tipo === 'produccion' && r.datos?.producto?.startsWith('huevo')).reduce((s, r) => s + (r.datos.cantidad || 0), 0)

// La finca del mapa según lo anotado.
function fincaDelEstado(estado, hoy) {
  const f = structuredClone(FINCA_EJEMPLO)
  f.nombre = estado.finca?.nombre || f.nombre
  const sistemas = estado.sistemas.filter((s) => !s.archivado)
  const de = (tipo) => sistemas.filter((s) => s.tipo === tipo)
  const gallineros = de('gallinas')
  const aves = gallineros.reduce((s, g) => s + avesVivas(estado, g.id, hoy), 0)
  const arboles = arbolesSembrados(estado)
  const plan = (o, sin) => { o.plan = sin; if (sin) o.etiqueta = o.etiqueta.replace(/ · .*$/, '') + ' · plan' }
  for (const o of f.objetos) {
    if (o.id === 'galpon') { o.plan = !gallineros.length; o.etiqueta = gallineros.length ? `🐔 ${gallineros[0].nombre} · ${aves} aves` : '🐔 Gallinero · plan' }
    if (o.id === 'parque') { o.plan = !gallineros.length; o.gallinas = aves }
    // Cuando el sistema ya existe, la etiqueta es su nombre: la del ejemplo
    // («Panel 600 W», «Tanque 1.000 L», «Huerta · 6 camas») decía como hecho algo
    // que la finca no tiene, y crear el sistema de Energía para leer el contador
    // dejaba en el mapa un panel de 600 W.
    const real = (o, tipo, emoji) => { const s = de(tipo); plan(o, !s.length); if (s.length) o.etiqueta = `${emoji} ${s[0].nombre}` }
    if (o.id === 'huerta') real(o, 'cultivo', '🥬')
    if (o.id === 'compost') real(o, 'compost', '♻️')
    if (o.id === 'lombriz') real(o, 'lombricultura', '🪱')
    if (o.id === 'panel') real(o, 'energia', '☀️')
    if (o.id === 'tanque') real(o, 'agua', '💧')
    if (o.id === 'bosque' && arboles > 0) o.etiqueta = `🌳 Bosque nativo · ${arboles} sembrados`
  }
  return f
}

// La finca escaneada: el lindero caminado y los sitios marcados, con lo que el
// libro sabe de cada uno (cuántas aves hay vivas).
function fincaEscaneada(estado, hoy) {
  const f = armarFinca(estado.finca.terreno, estado.mapa)
  f.nombre = estado.finca.nombre
  const gallineros = estado.sistemas.filter((s) => s.tipo === 'gallinas' && !s.archivado)
  let aves = gallineros.reduce((s, g) => s + avesVivas(estado, g.id, hoy), 0)
  const parques = []
  for (const o of f.objetos) {
    o.etiqueta = `${o.emoji} ${o.nombre}${o.plan ? ' · plan' : ''}`
    if (o.tipo === 'galpon') {
      // Las aves del libro van al primer gallinero que ya existe; con dos
      // marcados no se pintan dos veces.
      const suyas = o.plan ? 0 : aves
      if (suyas) { o.etiqueta = `${o.emoji} ${o.nombre} · ${suyas} aves`; aves = 0 }
      // El parque de pastoreo va frente a la puerta, como en la finca de ejemplo.
      const φ = o.rot || 0
      parques.push({ id: `${o.id}-parque`, tipo: 'parque', x: o.x + 8.5 * Math.sin(φ), z: o.z + 8.5 * Math.cos(φ), rot: φ, ancho: 16, fondo: 12, plan: o.plan, gallinas: suyas })
    }
    if (o.tipo === 'huerta') o.camas = ['hoja', 'repollo', 'maiz', 'arveja', 'hoja', 'repollo']
    if (o.tipo === 'frutales') { o.filas = 3; o.columnas = 4 }
    if (o.tipo === 'bosque') o.radio = 18
  }
  f.objetos.push(...parques)
  return f
}

function bienvenida(raiz, ctx) {
  const v = document.createElement('div')
  v.className = 'velo'
  v.innerHTML = `<form class="celebra" style="text-align:left">
    <div class="grande" style="text-align:center">🧑‍🌾</div>
    <h2 style="text-align:center;margin-bottom:8px">Bienvenido a Finca Viva</h2>
    <p class="suave">Aquí llevas las gallinas, los cultivos y las cuentas de tu finca. Cada cosa que anotas te sube de nivel, y el marcador es la plata que de verdad gana la finca.</p>
    <label class="campo"><span>¿Cómo se llama tu finca?</span><input name="nombre" required maxlength="60" placeholder="Ej.: La Esperanza" autocomplete="off"></label>
    <button class="btn ancho">Empezar con mi finca</button>
    <button type="button" class="btn suave ancho" data-prueba style="margin-top:8px">Explorar una finca de prueba</button>
    <p class="suave chico" style="margin-top:10px">Tus cuentas, tus registros y tus fotos se guardan solo en este teléfono.</p>
  </form>`
  v.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault()
    const nombre = new FormData(e.target).get('nombre').trim()
    if (!nombre) return
    v.remove()
    ctx.cambiar((est) => { est.finca = { nombre, creada: ctx.hoy } }, { mensaje: `¡Bienvenido a ${nombre}!` })
  })
  v.querySelector('[data-prueba]').addEventListener('click', () => { v.remove(); ctx.reemplazar(crearFincaDePrueba(ctx.hoy), 'Finca de prueba cargada: los números son inventados') })
  raiz.appendChild(v)
}

export async function pantallaFinca(raiz, ctx) {
  const { estado, hoy } = ctx
  const xp = calcularXP(estado, hoy).total
  const nivel = nivelDe(xp)
  const mes = rangoMes(hoy)
  const r = resumen(estado, mes.desde, mes.hasta)
  const hayCuentas = r.ventas > 0 || r.costos > 0
  const luna = estadoLuna(new Date())
  const gallineros = estado.sistemas.filter((s) => s.tipo === 'gallinas' && !s.archivado)
  const aves = gallineros.reduce((s, g) => s + avesVivas(estado, g.id, hoy), 0)
  const huevosHoy = huevosDe(estado, hoy)
  const misiones = misionesDeSemana(estado, inicioSemana(hoy))
  const hechas = misiones.filter((m) => m.hecha).length
  const dias = racha(estado, hoy)
  const clima = await ctx.catalogo('clima-zona')
  const mesActual = Number(hoy.slice(5, 7))
  const temporada = clima?.temporadas?.find((t) => t.meses?.includes(mesActual))
  // El nombre largo de la temporada ("Segunda temporada de lluvias (la más
  // fuerte…)") ocupaba una fila entera del celular encima del mapa. El chip dice
  // lo mínimo y avisa de heladas, que es lo que cambia el trabajo del día; el
  // detalle está en el calendario, a un toque.
  const CORTO = { seca: '☀️ Verano', lluvias: '🌧️ Lluvias', transicion: '🌦️ Cambio de temporada' }
  const helada = clima?.heladas?.meses_riesgo?.includes(mesActual) ? ' · ❄️ heladas' : ''
  const chipClima = temporada ? `${CORTO[temporada.tipo] || '🌦️ ' + esc(temporada.nombre.split('(')[0].trim())}${helada}` : '🌦️ Temporada: sin datos'

  // ¿Finca escaneada o mapa de ejemplo? El aviso dice siempre cuál se está viendo.
  const terreno = estado.finca?.terreno?.origen ? estado.finca.terreno : null
  const relieveDatos = terreno ? await relieveDeLaFinca(terreno.origen) : null
  const fincaMapa = terreno ? fincaEscaneada(estado, hoy) : fincaDelEstado(estado, hoy)
  const aviso = estado.demo && !terreno
    ? '🧪 Finca de prueba: los números son inventados'
    : !terreno
      ? 'Mapa de ejemplo · toca aquí para escanear tu finca'
      : relieveDatos.plano
        ? 'Tu finca, todavía sin relieve: bájalo en Escanear'
        : fincaMapa.linderoProvisional
          ? 'Tu finca escaneada · falta caminar el lindero'
          : `Tu finca escaneada con el celular (GPS a ±${terreno.lindero?.precision_m ?? terreno.origen.precision} m)`

  raiz.innerHTML = `
    <canvas id="lienzo"></canvas>
    <div id="etiquetas"></div>
    <div class="hud hud-arriba">
      <div class="tarjeta jugador" data-ir="logros">
        <div class="avatar">🧑‍🌾</div>
        <div>
          <b>${esc(estado.finca?.nombre || 'Mi finca')}</b>
          <div class="nivel">${nivel.emoji} Nivel ${nivel.numero} · ${esc(nivel.nombre)}</div>
          <div class="barra"><i style="width:${Math.round(nivel.progreso * 100)}%"></i></div>
        </div>
      </div>
      <div class="tarjeta plata" data-ir="cuentas">
        <small>UTILIDAD DE ${MESES[mesActual - 1].toUpperCase()}</small>
        <b class="${r.utilidad < 0 ? 'rojo' : 'verde'}">${hayCuentas ? pesos(r.utilidad) : 'Sin cuentas'}</b>
      </div>
      <div class="chips">
        <div class="tarjeta chip" data-ir="calendario">${luna.emoji} ${esc(luna.nombre)} · ${Math.round(luna.iluminacion * 100)} %</div>
        <div class="tarjeta chip" data-ir="calendario">${chipClima}</div>
        ${aves ? `<div class="tarjeta chip" data-ir="anotar">🥚 ${huevosHoy ? `${huevosHoy} huevos hoy · ${porcentaje(huevosHoy / aves)}` : 'Anota los huevos de hoy'}</div>` : '<div class="tarjeta chip" data-ir="construir">🐣 Sin gallinas todavía</div>'}
        ${dias > 1 ? `<div class="tarjeta chip" data-ir="logros">🔥 ${dias} días seguidos</div>` : ''}
        <div class="tarjeta chip boton-misiones" data-misiones>🎯 Misiones ${hechas}/${misiones.length}</div>
      </div>
    </div>
    <div class="hud hud-misiones"><div class="tarjeta">
      <h3 style="font-size:14px;margin-bottom:6px">🎯 Misiones de la semana</h3>
      ${misiones.map((m) => `<div class="mision${m.hecha ? ' hecha' : ''}"><span>${m.hecha ? '✅' : m.emoji}</span><span>${esc(m.texto)}${!m.hecha && m.meta > 1 && m.id !== 'costo-huevo' ? ` <span class="suave chico">(${m.valor}/${m.meta})</span>` : ''}</span><span class="xp">+${m.xp}</span></div>`).join('')}
    </div></div>
    <div class="hud hud-aviso"><span data-ir="escanear">${esc(aviso)}</span></div>
    <div class="hud ficha-mapa"></div>
    <div class="hud hud-abajo">
      <a class="btn oro" href="#/construir"><span>🏗️</span>Construir</a>
      <a class="btn" href="#/escanear"><span>📡</span>Escanear</a>
      <a class="btn" href="#/logros"><span>🏆</span>Logros</a>
      <a class="btn" href="#/aprende"><span>📚</span>Aprende</a>
      <a class="btn suave" href="#/ajustes"><span>⚙️</span>Ajustes</a>
    </div>
    ${relieveDatos?.plano ? '' : '<div class="hud hud-credito">Relieve: datos SRTM, cortesía del U.S. Geological Survey (AWS Terrain Tiles)</div>'}`
  enlazar(raiz, ctx)
  raiz.querySelector('[data-misiones]').addEventListener('click', () => raiz.querySelector('.hud-misiones').classList.toggle('abierta'))
  if (!estado.finca) bienvenida(raiz, ctx)

  // ---------- Letreros sobre el mapa ----------
  const capa = raiz.querySelector('#etiquetas')
  const nodos = new Map()
  function pintarEtiquetas(lista) {
    // Las más cercanas primero; una que se monta sobre otra ya puesta no se
    // muestra (a lo lejos todo sería un enredo de letreros).
    const puestas = []
    for (const e of [...lista].sort((a, b) => a.distancia - b.distancia)) {
      // Por id y no por texto: en una finca escaneada puede haber dos «Potrero».
      const clave = e.id || e.texto
      let n = nodos.get(clave)
      if (!n) {
        n = document.createElement('div')
        n.className = 'etq' + (e.plan ? ' plan' : '')
        n.textContent = e.texto
        // El letrero también se toca: es más grande que un banderín o un trípode
        // vistos desde lejos.
        if (e.id) n.addEventListener('click', () => alTocar({ id: e.id, etiqueta: e.texto, plan: e.plan }))
        capa.appendChild(n)
        nodos.set(clave, n)
        n._ancho = n.offsetWidth || e.texto.length * 7
      }
      const x = Math.min(Math.max(e.x, n._ancho / 2 + 6), innerWidth - n._ancho / 2 - 6)
      const caja = { x0: x - n._ancho / 2 - 4, x1: x + n._ancho / 2 + 4, y0: e.y - 26, y1: e.y }
      const ver = e.visible && e.distancia < 600 && !puestas.some((p) => caja.x0 < p.x1 && caja.x1 > p.x0 && caja.y0 < p.y1 && caja.y1 > p.y0)
      n.style.display = ver ? '' : 'none'
      if (ver) {
        n.style.transform = `translate(${x}px, ${e.y}px) translate(-50%, -100%)`
        puestas.push(caja)
      }
    }
  }

  // ---------- Tocar un objeto del mapa ----------
  const ficha = raiz.querySelector('.ficha-mapa')
  // Qué sistema lleva las cuentas de cada cosa del mapa: en la finca de ejemplo
  // lo dice el id del objeto; en la escaneada, la clase del sitio marcado.
  const sistemaPara = { galpon: 'gallinas', huerta: 'cultivo', compost: 'compost', lombriz: 'lombricultura', panel: 'energia', tanque: 'agua', bosque: 'bosque' }
  let fotoAbierta = null
  const soltarFoto = () => { if (fotoAbierta) URL.revokeObjectURL(fotoAbierta); fotoAbierta = null }
  function alTocar(o) {
    soltarFoto()
    if (!o) { ficha.innerHTML = ''; return }
    const sitio = terreno ? estado.mapa.find((x) => x.id === o.id) : null
    if (sitio?.clase === 'panoramica') { ficha.innerHTML = ''; abrirPanorama(sitio); return }
    const tipoSistema = sitio ? CLASES_SITIO[sitio.clase]?.sistema : sistemaPara[o.id]
    const esGallinero = tipoSistema === 'gallinas'
    const s = tipoSistema ? estado.sistemas.find((x) => x.tipo === tipoSistema && !x.archivado) : null
    // Construir solo tiene el plan del gallinero: mandar ahí desde la huerta o el
    // panel prometía un plan con costos que no existe.
    const accion = o.plan
      ? (esGallinero
        ? '<p class="suave" style="margin:6px 0 10px">Esto todavía no existe en tu finca. Mira cuánto cuesta y qué hace falta.</p><a class="btn oro ancho" href="#/construir">🏗️ Ver el plan</a>'
        : `<p class="suave" style="margin:6px 0 10px">Esto todavía no existe en tu finca. Su plan con costos todavía no está en la app: por ahora solo está el del gallinero.</p>${tipoSistema ? `<a class="btn ancho" href="#/nuevo-sistema/${tipoSistema}">Crear el sistema</a>` : ''}`)
      : s
        ? `<a class="btn ancho" href="#/sistema/${s.id}" style="margin-top:10px">Abrir la ficha</a>`
        : sitio && !tipoSistema
          ? ''
          : `<p class="suave" style="margin:6px 0 10px">Para llevar sus cuentas, créalo como sistema.</p><a class="btn ancho" href="#/nuevo-sistema/${tipoSistema || 'otro'}">Crear el sistema</a>`
    const medida = sitio ? `<p class="suave chico" style="margin:6px 0 0">Marcado con el celular el ${fechaCorta(sitio.fecha)} · GPS a ±${sitio.precision} m</p>` : ''
    ficha.innerHTML = `<div class="tarjeta" style="margin:0"><div class="fila-flex"><b class="crece" style="font-size:16px">${esc(o.etiqueta || o.id)}</b><button class="icono-btn" data-cerrar aria-label="Cerrar">✕</button></div>${medida}<div data-foto></div>${accion}</div>`
    ficha.querySelector('[data-cerrar]').addEventListener('click', () => { soltarFoto(); ficha.innerHTML = '' })
    // La foto del sitio, si se le tomó una al marcarlo.
    if (sitio?.foto) {
      urlFoto(sitio.foto).then((u) => {
        const hueco = ficha.querySelector('[data-foto]')
        if (!u || !hueco || !vivo) { if (u) URL.revokeObjectURL(u); return }
        soltarFoto()
        fotoAbierta = u
        hueco.innerHTML = `<img class="foto-sitio" src="${u}" alt="Foto de ${esc(sitio.nombre)}">`
      })
    }
  }

  let mundo = null
  let vivo = true
  try {
    mundo = await crearMundo(raiz.querySelector('#lienzo'), {
      base: './',
      // El estilo Satélite está apagado (ver ESTILOS.realista en mapa/mundo.js): quien
      // lo tenía guardado ve el Juguete, no una foto que la licencia no permite.
      // La finca escaneada va siempre en Juguete: el Diorama recorta un cuadro
      // fijo de 240 m y una finca de verdad no tiene por qué caber ahí.
      estilo: !terreno && estado.ajustes.estilo_mapa === 'diorama' ? 'diorama' : 'juguete',
      finca: fincaMapa,
      relieveDatos,
      alDibujar: pintarEtiquetas,
      alTocar,
    })
    if (!vivo) mundo.destruir()
  } catch (err) {
    console.error(err)
    raiz.classList.add('sin-3d')
    raiz.querySelector('#lienzo').remove()
    raiz.querySelector('.hud-aviso span').textContent = 'Este teléfono no pudo dibujar el mapa 3D. Todo lo demás funciona.'
  }
  return () => {
    vivo = false
    soltarFoto()
    if (mundo) mundo.destruir()
  }
}
