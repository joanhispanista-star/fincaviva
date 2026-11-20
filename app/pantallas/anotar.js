// Anotar: lo que se hace todos los días. Tiene que tomar segundos, con las
// manos sucias y de pie en el galpón: botones grandes, el día ya puesto y los
// huevos con contadores de + y −.

import { TIPOS_SISTEMA, TIPOS_REGISTRO, MOTIVOS_BAJA, validarRegistro, nuevoId, insumosPara, categoriaDeInsumoNuevo } from '../../lib/modelo.js'
import { esc, cabeza, opciones, errores, enlazar, leerNumero } from '../ui.js'
import { avesVivas } from '../../lib/libro.js'
import { fechaLarga } from '../../lib/fechas.js'

const COLORES = [['huevo-azul', 'azul', 'Azules'], ['huevo-verde', 'verde', 'Verdes'], ['huevo-marron', 'marron', 'Marrones'], ['huevo-crema', 'crema', 'Crema o blancos']]
const CLIMA = { id: 'clima', tipo: 'clima', nombre: 'Clima de la finca' }

const num = (name, label, v = '', ayuda = '') => `<label class="campo"><span>${label}</span><input name="${name}" inputmode="decimal" autocomplete="off" value="${esc(v)}">${ayuda ? `<small>${ayuda}</small>` : ''}</label>`
const txt = (name, label, v = '', lista = '', ayuda = '') => `<label class="campo"><span>${label}</span><input name="${name}" autocomplete="off" value="${esc(v)}"${lista ? ` list="${lista}"` : ''}>${ayuda ? `<small>${ayuda}</small>` : ''}</label>`

function selectorInsumo(estado, categorias, v, etiqueta = 'Insumo') {
  const lista = insumosPara(estado.insumos, categorias).map((i) => [i.id, `${i.nombre} (${i.unidad || 'unidad'})`])
  return `<label class="campo"><span>${etiqueta}</span><select name="insumoId">${opciones([['', 'Escoge…'], ...lista, ['__nuevo', '➕ Uno nuevo…']], v.insumoId)}</select></label>
    <div data-nuevo-insumo hidden class="dos">${txt('nuevo_nombre', 'Nombre del insumo', v.nuevo_nombre)}${txt('nuevo_unidad', 'Unidad', v.nuevo_unidad || 'kg')}</div>`
}

function formulario(tipo, sis, estado, v, datos) {
  const fecha = `<label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}" max="${esc(v.hoy)}"></label>`
  switch (tipo) {
    case 'produccion':
      if (sis.tipo === 'gallinas') {
        return fecha + COLORES.map(([p, clase, t]) => `<label class="campo"><span><i class="huevo ${clase}"></i> ${t}</span><div class="contador"><button type="button" data-menos="${p}">−</button><input name="${p}" inputmode="numeric" value="${esc(v[p] ?? '')}" placeholder="0"><button type="button" data-mas="${p}">+</button></div></label>`).join('') +
          num('gallinaza', 'Gallinaza recogida (kg, opcional)', v.gallinaza)
      }
      return fecha + `<datalist id="productos">${(TIPOS_SISTEMA[sis.tipo]?.productos || []).map((p) => `<option value="${esc(p)}">`).join('')}</datalist>` +
        txt('producto', 'Producto', v.producto, 'productos') + `<div class="dos">${num('cantidad', 'Cantidad', v.cantidad)}${txt('unidad', 'Unidad', v.unidad || 'kg')}</div>` +
        selectorInsumo(estado, null, v, 'Guardar en el inventario como (opcional)') + num('costo_unit', 'Costo por unidad (opcional)', v.costo_unit, 'Lo que costó producirlo o lo que costaría comprarlo. Sin esto entra al inventario a $0 y el costo de quien lo use sale más bajo de lo real.')
    case 'alimentacion':
      // A las lombrices se les echa estiércol y residuos, no concentrado: su
      // formulario ofrece abonos y «otro», y lo que se cree ahí no sale después
      // como comida de las gallinas.
      return fecha + selectorInsumo(estado, sis.tipo === 'lombricultura' ? ['abono', 'otro'] : ['alimento'], v, 'Alimento') + num('cantidad', 'Cantidad que les diste', v.cantidad, 'En la unidad del alimento (kg, normalmente). Pésalo una vez y anota siempre lo mismo.')
    case 'aplicacion':
      return fecha + selectorInsumo(estado, ['abono', 'otro', 'sanidad'], v, 'Abono o insumo') + num('cantidad', 'Cantidad', v.cantidad)
    case 'sanidad': {
      // Las entradas «siempre» (el aviso al ICA, la obligación de vacunar) son
      // reglas para leer, no algo que se hizo un día: no van como sugerencia.
      const acciones = (datos?.plan_sanitario || []).filter((p) => !p.siempre).map((p) => `<option value="${esc(p.accion.slice(0, 90))}">`).join('')
      return fecha + `<datalist id="acciones">${acciones}</datalist>` + txt('accion', '¿Qué se hizo?', v.accion, 'acciones', 'Vacuna, desparasitada, revisión, limpieza…') + selectorInsumo(estado, ['sanidad'], v, 'Producto usado (opcional)') + num('cantidad', 'Cantidad del producto (opcional)', v.cantidad)
    }
    case 'siembra':
      return fecha + txt('especie', sis.tipo === 'bosque' ? 'Especie nativa' : 'Qué se sembró', v.especie, 'especies', sis.tipo === 'bosque' ? 'Aliso, roble, encenillo, arrayán, sietecueros…' : '') +
        `<datalist id="especies">${(datos?.especies || []).map((e) => `<option value="${esc(e)}">`).join('')}</datalist>` +
        `<div class="dos">${num('cantidad', sis.tipo === 'bosque' ? 'Árboles' : 'Plantas o semillas', v.cantidad)}${num('area_m2', 'Área (m², opcional)', v.area_m2)}</div>`
    case 'cosecha':
      return fecha + txt('producto', 'Qué se cosechó', v.producto) + `<div class="dos">${num('cantidad', 'Cantidad', v.cantidad)}${txt('unidad', 'Unidad', v.unidad || 'kg')}</div>` +
        `<label class="campo"><span>¿Para dónde va?</span><select name="destino">${opciones([['venta', 'Para vender'], ['casa', 'Para la casa'], ['gallinas', 'Para las gallinas'], ['inventario', 'Se guarda']], v.destino)}</select></label>` +
        selectorInsumo(estado, null, v, 'Guardar en el inventario como (opcional)') + num('costo_unit', 'Costo por unidad (opcional)', v.costo_unit, 'Si va para las gallinas, ponle precio: así el costo del huevo es honesto.')
    case 'altas':
      return fecha + `<div class="dos">${num('cantidad', '¿Cuántas llegaron?', v.cantidad)}${num('edad_semanas', 'Edad (semanas)', v.edad_semanas)}</div>` + num('costo_total', 'Costo total (pesos)', v.costo_total, 'Lo que pagaste por todas. Se reparte en su vida útil (24 meses), no se carga todo al primer mes.') + txt('origen', 'De dónde vienen', v.origen)
    case 'bajas':
      return fecha + num('cantidad', '¿Cuántas salieron?', v.cantidad) + `<label class="campo"><span>Motivo</span><select name="motivo">${opciones(MOTIVOS_BAJA.map((m) => [m, m.charAt(0).toUpperCase() + m.slice(1)]), v.motivo)}</select></label>`
    case 'labor':
      return fecha + num('horas', 'Horas de trabajo', v.horas, 'Aunque sea tu propio trabajo: la finca solo da si paga también tus horas.') + txt('descripcion', 'Qué se hizo', v.descripcion)
    case 'medicion':
      return fecha + txt('variable', 'Qué se midió', v.variable, '', 'Peso de 10 huevos, pH del suelo, nivel del tanque…') + `<div class="dos">${num('valor', 'Valor', v.valor)}${txt('unidad', 'Unidad', v.unidad)}</div>`
    case 'lluvia':
      return fecha + num('mm', 'Milímetros de lluvia', v.mm, 'Del pluviómetro. Un vaso recto sirve: los milímetros de agua en el vaso son los de la lluvia.')
    case 'temperatura':
      return fecha + `<div class="dos">${num('min', 'Mínima (°C)', v.min)}${num('max', 'Máxima (°C)', v.max)}</div>`
    default:
      return fecha + `<label class="campo"><span>Nota</span><textarea name="texto" rows="4">${esc(v.texto || '')}</textarea></label>`
  }
}

// Convierte lo escrito en uno o varios registros (los huevos: uno por color).
function armarRegistros(tipo, sis, f, hoy) {
  const base = { sistemaId: sis.id === 'clima' ? null : sis.id, tipo, fecha: f.fecha || hoy, creado: new Date().toISOString() }
  const n = (k, o) => leerNumero(f[k], o)
  const r = (datos) => ({ ...base, id: nuevoId(), datos })
  switch (tipo) {
    case 'produccion':
      if (sis.tipo === 'gallinas') {
        const out = COLORES.filter(([p]) => n(p) > 0).map(([p]) => r({ producto: p, cantidad: n(p), unidad: 'unidades' }))
        if (n('gallinaza') > 0) out.push(r({ producto: 'gallinaza', cantidad: n('gallinaza'), unidad: 'kg' }))
        return out.length ? out : [r({ producto: 'huevo-azul', cantidad: 0 })] // para que la validación diga qué falta
      }
      return [r({ producto: f.producto?.trim(), cantidad: n('cantidad'), unidad: f.unidad, insumoId: f.insumoId || undefined, costo_unit: n('costo_unit', { entero: true }) || undefined })]
    case 'alimentacion': case 'aplicacion':
      return [r({ insumoId: f.insumoId, cantidad: n('cantidad') })]
    case 'sanidad':
      return [r({ accion: f.accion?.trim(), insumoId: f.insumoId || undefined, cantidad: n('cantidad') || undefined })]
    case 'siembra':
      return [r({ especie: f.especie?.trim(), cantidad: n('cantidad'), area_m2: n('area_m2') || undefined })]
    case 'cosecha':
      return [r({ producto: f.producto?.trim(), cantidad: n('cantidad'), unidad: f.unidad, destino: f.destino, insumoId: f.insumoId || undefined, costo_unit: n('costo_unit', { entero: true }) || undefined })]
    case 'altas':
      return [r({ cantidad: n('cantidad'), costo_total: n('costo_total', { entero: true }) ?? 0, edad_semanas: n('edad_semanas') ?? undefined, origen: f.origen?.trim() })]
    case 'bajas':
      return [r({ cantidad: n('cantidad'), motivo: f.motivo })]
    case 'labor':
      return [r({ horas: n('horas'), descripcion: f.descripcion?.trim() })]
    case 'medicion':
      return [r({ variable: f.variable?.trim(), valor: n('valor'), unidad: f.unidad?.trim() })]
    case 'lluvia':
      return [r({ mm: n('mm') })]
    case 'temperatura':
      return [r({ min: n('min'), max: n('max') })]
    default:
      return [r({ texto: f.texto?.trim() })]
  }
}

export async function pantallaAnotar(raiz, ctx, [sistemaId, tipo]) {
  const { estado, hoy } = ctx
  const activos = estado.sistemas.filter((s) => !s.archivado)

  // Paso 1: ¿de qué sistema?
  if (!sistemaId) {
    if (activos.length === 1) return ctx.ir(`anotar/${activos[0].id}`)
    raiz.innerHTML = `<div class="pantalla">${cabeza('Anotar', { atras: false })}
      ${activos.length ? '' : '<div class="nota">Primero crea un sistema: el gallinero, la huerta, el bosque…</div>'}
      <div class="lista">
        ${activos.map((s) => `<div class="item tocable" data-ir="anotar/${esc(s.id)}"><span class="emoji">${TIPOS_SISTEMA[s.tipo]?.emoji || '📦'}</span><div class="cuerpo"><b>${esc(s.nombre)}</b></div><span>›</span></div>`).join('')}
        <div class="item tocable" data-ir="anotar/clima"><span class="emoji">🌧️</span><div class="cuerpo"><b>Clima de la finca</b><span>Lluvia y temperatura</span></div><span>›</span></div>
      </div>
      <a class="btn suave ancho" href="#/nuevo-sistema">➕ Nuevo sistema</a></div>`
    enlazar(raiz, ctx)
    return
  }

  const sis = sistemaId === 'clima' ? CLIMA : estado.sistemas.find((s) => s.id === sistemaId)
  if (!sis) return ctx.ir('anotar')
  const permitidos = sis.tipo === 'clima' ? ['lluvia', 'temperatura'] : TIPOS_SISTEMA[sis.tipo]?.registros || ['nota']

  // Paso 2: ¿qué se va a anotar?
  if (!tipo || !permitidos.includes(tipo)) {
    raiz.innerHTML = `<div class="pantalla">${cabeza(`Anotar · ${sis.nombre}`)}
      <div class="botonera">${permitidos.map((t, i) => `<a class="btn ${i === 0 ? 'oro' : 'suave'}" href="#/anotar/${esc(sis.id)}/${t}">${TIPOS_REGISTRO[t].emoji} ${t === 'produccion' && sis.tipo === 'gallinas' ? 'Huevos del día' : TIPOS_REGISTRO[t].nombre}</a>`).join('')}</div></div>`
    enlazar(raiz, ctx)
    return
  }

  // Paso 3: el formulario.
  const datos = sis.tipo === 'gallinas' ? await ctx.catalogo('gallinas') : null
  const especies = sis.tipo === 'bosque' ? ['Aliso', 'Roble', 'Encenillo', 'Arrayán', 'Sietecueros', 'Mano de oso', 'Cedro andino', 'Gaque', 'Raque', 'Tibar'] : []
  let problemas = []
  let confirmado = null // huevos de más ya avisados: el segundo toque guarda
  const pintar = (v) => {
    raiz.innerHTML = `<div class="pantalla">${cabeza(`${TIPOS_REGISTRO[tipo].emoji} ${tipo === 'produccion' && sis.tipo === 'gallinas' ? 'Huevos del día' : TIPOS_REGISTRO[tipo].nombre}`)}
      <p class="suave" style="margin-top:-8px">${esc(sis.nombre)}</p>
      <form>${errores(problemas)}${formulario(tipo, sis, estado, v, { ...datos, especies })}<button class="btn ancho">Guardar</button></form></div>`
    enlazar(raiz, ctx)
    const form = raiz.querySelector('form')
    const nuevo = raiz.querySelector('[data-nuevo-insumo]')
    const sel = form.querySelector('[name=insumoId]')
    if (sel && nuevo) {
      const ver = () => (nuevo.hidden = sel.value !== '__nuevo')
      sel.addEventListener('change', ver)
      ver()
    }
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mas],[data-menos]')
      if (!b) return
      const input = form.querySelector(`[name="${b.dataset.mas || b.dataset.menos}"]`)
      input.value = Math.max(0, (leerNumero(input.value) || 0) + (b.dataset.mas ? 1 : -1))
    })
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(form))
      let insumoNuevo = null
      if (f.insumoId === '__nuevo') {
        if (!f.nuevo_nombre?.trim()) { problemas = ['Escribe el nombre del insumo nuevo']; return pintar({ ...f, hoy }) }
        const categoria = categoriaDeInsumoNuevo(tipo, f.destino, sis.tipo, `${f.producto || ''} ${f.nuevo_nombre || ''}`)
        insumoNuevo = { id: nuevoId(), nombre: f.nuevo_nombre.trim(), unidad: f.nuevo_unidad?.trim() || 'kg', categoria, stock_inicial: 0, propio: ['produccion', 'cosecha'].includes(tipo) }
        f.insumoId = insumoNuevo.id
      }
      const regs = armarRegistros(tipo, sis, f, hoy)
      const vista = insumoNuevo ? { ...estado, insumos: [...estado.insumos, insumoNuevo] } : estado
      problemas = [...new Set(regs.flatMap((r) => validarRegistro(r, vista)))]
      if (tipo === 'siembra' && !f.especie?.trim()) problemas.push('Escribe qué se sembró')
      if (problemas.length) return pintar({ ...f, insumoId: insumoNuevo ? '__nuevo' : f.insumoId, hoy })
      const huevos = regs.filter((r) => r.datos.producto?.startsWith('huevo')).reduce((s, r) => s + r.datos.cantidad, 0)
      // Una gallina pone máximo un huevo al día. Si el día suma más huevos que
      // gallinas vivas, casi siempre es lo mismo anotado dos veces (y la postura
      // saldría por encima del 100 %). Pero las criollas esconden nidos y a veces
      // aparecen diez huevos de golpe: por eso se avisa y un segundo toque guarda
      // igual, en vez de bloquear.
      if (sis.tipo === 'gallinas' && huevos > 0) {
        const fecha = regs[0].fecha
        const ya = estado.registros.filter((x) => x.sistemaId === sis.id && x.fecha === fecha && x.tipo === 'produccion' && x.datos?.producto?.startsWith('huevo')).reduce((s, x) => s + (x.datos.cantidad || 0), 0)
        const aves = avesVivas(estado, sis.id, fecha)
        const clave = `${fecha}:${ya + huevos}`
        if (aves > 0 && ya + huevos > aves && confirmado !== clave) {
          confirmado = clave
          problemas = [`${ya ? `Ese día ya había ${ya} anotados; con estos suman ${ya + huevos}` : `Son ${huevos} huevos`} y hay ${aves} gallinas vivas el ${fechaLarga(fecha)}: una gallina pone máximo uno al día. Si ya los habías anotado, corrige el número. Si encontraste un nido escondido, toca Guardar otra vez.`]
          return pintar({ ...f, hoy })
        }
      }
      ctx.cambiar((est) => {
        if (insumoNuevo) est.insumos.push(insumoNuevo)
        est.registros.push(...regs)
      }, { mensaje: huevos ? `${huevos} huevos anotados` : 'Anotado', ir: sis.tipo === 'clima' ? 'calendario' : `sistema/${sis.id}` })
    })
  }
  pintar({ fecha: hoy, hoy })
}
