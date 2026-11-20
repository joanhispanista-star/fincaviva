// Las cuentas: utilidad y caja del mes, ventas, compras, gastos e inventario.

import { CATEGORIAS_INSUMO, CATEGORIAS_GASTO, TIPOS_SISTEMA, nuevoId } from '../../lib/modelo.js'
import { resumen, calcularInventario, totalVenta, totalCompra } from '../../lib/libro.js'
import { rangoMes, fechaCorta, MESES } from '../../lib/fechas.js'
import { esc, pesos, numero, cabeza, opciones, errores, enlazar, leerNumero, nombreProducto } from '../ui.js'

const mesSiguiente = (m, d) => {
  const [a, mm] = m.split('-').map(Number)
  const t = a * 12 + (mm - 1) + d
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export async function pantallaCuentas(raiz, ctx, [mesParam]) {
  const { estado, hoy } = ctx
  const mes = /^\d{4}-\d{2}$/.test(mesParam || '') ? mesParam : hoy.slice(0, 7)
  const { desde, hasta } = rangoMes(mes)
  const r = resumen(estado, desde, hasta)
  const [a, m] = mes.split('-').map(Number)
  const nombres = Object.fromEntries(estado.sistemas.map((s) => [s.id, s.nombre]))
  const movs = [
    ...estado.ventas.filter((v) => v.fecha >= desde && v.fecha <= hasta).map((v) => ({ clase: 'venta', id: v.id, fecha: v.fecha, emoji: '💵', titulo: v.items.map((it) => `${numero(it.cantidad)} ${nombreProducto(it.producto).toLowerCase()}`).join(', '), detalle: v.cliente || 'Venta', valor: totalVenta(v), pendiente: !v.pagado })),
    ...estado.compras.filter((c) => c.fecha >= desde && c.fecha <= hasta).map((c) => ({ clase: 'compra', id: c.id, fecha: c.fecha, emoji: '🛒', titulo: c.items.map((it) => estado.insumos.find((i) => i.id === it.insumoId)?.nombre || 'Insumo').join(', '), detalle: c.proveedor || 'Compra', valor: -totalCompra(c), pendiente: c.pagado === false })),
    ...estado.gastos.filter((g) => g.fecha >= desde && g.fecha <= hasta).map((g) => ({ clase: 'gasto', id: g.id, fecha: g.fecha, emoji: g.es_inversion ? '🏗️' : '🧾', titulo: g.descripcion || CATEGORIAS_GASTO[g.categoria] || 'Gasto', detalle: g.es_inversion ? `Inversión · se reparte en ${g.vida_util_meses} meses` : CATEGORIAS_GASTO[g.categoria] || '', valor: -(g.monto || 0) })),
  ].sort((x, y) => (x.fecha < y.fecha ? 1 : -1))
  const filasSistema = Object.entries(r.por_sistema).filter(([, f]) => f.total > 0)

  raiz.innerHTML = `<div class="pantalla">
    ${cabeza('Cuentas', { atras: false })}
    <div class="fila-flex" style="margin-bottom:12px">
      <button class="btn suave chico" data-ir="cuentas/${mesSiguiente(mes, -1)}">‹</button>
      <b class="crece" style="text-align:center;font-size:17px">${MESES[m - 1]} de ${a}</b>
      <button class="btn suave chico" data-ir="cuentas/${mesSiguiente(mes, 1)}">›</button>
    </div>
    ${estado.demo ? '<div class="nota">🧪 Finca de prueba: estos números son inventados.</div>' : ''}
    <div class="kpis">
      <div class="kpi grande"><small>Utilidad del mes</small><b class="${r.utilidad < 0 ? 'rojo' : 'verde'}">${pesos(r.utilidad)}</b><i>Ventas ${pesos(r.ventas)} − costos ${pesos(r.costos)}</i></div>
      <div class="kpi"><small>Caja</small><b class="${r.caja < 0 ? 'rojo' : ''}">${pesos(r.caja)}</b><i>Entró ${pesos(r.entra)} · salió ${pesos(r.sale)}</i></div>
      <div class="kpi"><small>Te deben</small><b>${pesos(r.por_cobrar)}</b><i>Ventas fiadas</i></div>
      <div class="kpi"><small>Debes</small><b>${pesos(r.por_pagar)}</b><i>Compras sin pagar</i></div>
      <div class="kpi"><small>Tu trabajo</small><b>${estado.ajustes.contar_mano_obra ? 'Contado' : 'No contado'}</b><i>${estado.ajustes.contar_mano_obra ? `a ${pesos(estado.ajustes.valor_hora_cop)} la hora` : 'Actívalo en Ajustes'}</i></div>
    </div>
    <p class="suave chico"><b>Utilidad</b> es lo vendido menos lo que costó producir, con lo que dura repartido en su vida útil. <b>Caja</b> es la plata que de verdad entró y salió. El mes que compras el galpón la caja se hunde y la utilidad casi no se mueve: son cosas distintas.</p>
    <div class="botonera"><a class="btn oro" href="#/venta">💵 Venta</a><a class="btn suave" href="#/compra">🛒 Compra</a><a class="btn suave" href="#/gasto">🧾 Gasto</a><a class="btn suave" href="#/inventario">📦 Inventario</a></div>
    ${filasSistema.length ? `<h3 class="seccion">Costos por sistema</h3><div class="lista">${filasSistema.map(([id, f]) => `<div class="item${id !== 'general' ? ' tocable" data-ir="sistema/' + esc(id) : ''}"><div class="cuerpo"><b>${esc(nombres[id] || 'General')}</b><span>Insumos ${pesos(f.insumos)} · trabajo ${pesos(f.mano_obra)} · depreciación ${pesos(f.depreciacion)}</span></div><span class="valor">${pesos(f.total)}</span></div>`).join('')}${r.transferencias_internas > 0 ? `<div class="item"><div class="cuerpo"><b>Menos lo que la finca se dio a sí misma</b><span>Alimento y abono propios: ya están en los costos de quien los produjo</span></div><span class="valor">−${pesos(r.transferencias_internas).replace('$', '$')}</span></div>` : ''}</div>` : ''}
    <h3 class="seccion">Movimientos del mes</h3>
    ${movs.length ? `<div class="lista">${movs.map((x) => `<div class="item"><span class="emoji">${x.emoji}</span><div class="cuerpo"><b>${esc(x.titulo)}</b><span>${fechaCorta(x.fecha)} · ${esc(x.detalle)}${x.pendiente ? ` · <span class="etiqueta oro">${x.clase === 'venta' ? 'fiado' : 'sin pagar'}</span>` : ''}</span></div><div class="derecha"><div class="valor ${x.valor < 0 ? 'rojo' : 'verde'}">${pesos(x.valor)}</div>${x.pendiente ? `<button class="btn chico" data-saldar="${x.clase}:${esc(x.id)}">${x.clase === 'venta' ? 'Me pagaron' : 'Ya pagué'}</button>` : `<button class="icono-btn" data-quitar="${x.clase}:${esc(x.id)}" aria-label="Borrar">🗑️</button>`}</div></div>`).join('')}</div>` : '<div class="lista"><div class="vacio"><span class="emoji">📒</span>Nada anotado este mes.</div></div>'}
  </div>`
  enlazar(raiz, ctx)
  const coleccion = { venta: 'ventas', compra: 'compras', gasto: 'gastos' }
  raiz.addEventListener('click', (e) => {
    const s = e.target.closest('[data-saldar]')
    const q = e.target.closest('[data-quitar]')
    if (s) {
      const [clase, id] = s.dataset.saldar.split(':')
      ctx.cambiar((est) => {
        const x = est[coleccion[clase]].find((y) => y.id === id)
        x.pagado = true
        x.fecha_pago = ctx.hoy
      }, { mensaje: clase === 'venta' ? 'Cobrado' : 'Pagado' })
    } else if (q) {
      const [clase, id] = q.dataset.quitar.split(':')
      if (!confirm('¿Borrar este movimiento? Las cuentas se recalculan sin él.')) return
      ctx.cambiar((est) => { est[coleccion[clase]] = est[coleccion[clase]].filter((y) => y.id !== id) }, { mensaje: 'Borrado' })
    }
  })
}

// ---------- Venta ----------
const PRODUCTOS_HUEVO = ['huevo-azul', 'huevo-verde', 'huevo-marron', 'huevo-crema']

export async function pantallaVenta(raiz, ctx) {
  const { estado, hoy } = ctx
  const activos = estado.sistemas.filter((s) => !s.archivado)
  const productos = [...new Set([...PRODUCTOS_HUEVO, ...activos.flatMap((s) => TIPOS_SISTEMA[s.tipo]?.productos || [])])]
  const clientes = [...new Set(estado.ventas.map((v) => v.cliente).filter(Boolean))]
  const porCubeta = estado.ajustes.huevos_por_cubeta || 30
  let problemas = []
  const fila = (i, v) => `<div class="tarjeta plana"><b class="chico">Producto ${i + 1}</b>
    <label class="campo"><span>Qué</span><input name="producto${i}" list="productos" value="${esc(v['producto' + i] ?? (i === 0 ? 'huevo-azul' : ''))}" autocomplete="off"></label>
    <div class="dos"><label class="campo"><span>Cantidad</span><input name="cantidad${i}" inputmode="decimal" value="${esc(v['cantidad' + i] ?? '')}"></label>
    <label class="campo"><span>En</span><select name="unidad${i}">${opciones([['unidad', 'Unidades'], ['cubeta', `Cubetas de ${porCubeta}`]], v['unidad' + i])}</select></label></div>
    <label class="campo"><span>Precio por unidad o por cubeta (pesos)</span><input name="precio${i}" inputmode="numeric" value="${esc(v['precio' + i] ?? '')}"></label>
    <label class="campo"><span>De qué sistema sale</span><select name="sistema${i}">${opciones([['', 'General'], ...activos.map((s) => [s.id, s.nombre])], v['sistema' + i] ?? activos.find((s) => s.tipo === 'gallinas')?.id)}</select></label></div>`
  const pintar = (v) => {
    raiz.innerHTML = `<div class="pantalla">${cabeza('💵 Nueva venta')}<form>${errores(problemas)}
      <datalist id="productos">${productos.map((p) => `<option value="${esc(p)}">${esc(nombreProducto(p))}</option>`).join('')}</datalist>
      <datalist id="clientes">${clientes.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="dos"><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}"></label><label class="campo"><span>Cliente</span><input name="cliente" list="clientes" value="${esc(v.cliente || '')}" autocomplete="off"></label></div>
      ${[0, 1, 2].map((i) => fila(i, v)).join('')}
      <label class="marcar"><input type="checkbox" name="pagado" ${v.pagado !== false ? 'checked' : ''}> Ya me pagaron</label>
      <button class="btn oro ancho">Guardar venta</button></form></div>`
    enlazar(raiz, ctx)
    raiz.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(e.target))
      const items = []
      for (const i of [0, 1, 2]) {
        const producto = f['producto' + i]?.trim()
        const cantidad = leerNumero(f['cantidad' + i])
        const precio = leerNumero(f['precio' + i], { entero: true })
        if (!producto && !cantidad) continue
        if (!producto || !(cantidad > 0) || !(precio >= 0) || precio == null) { problemas = [`Producto ${i + 1}: falta el producto, la cantidad o el precio`]; return pintar({ ...f, pagado: !!f.pagado }) }
        const cubeta = f['unidad' + i] === 'cubeta'
        items.push({ producto, cantidad: cubeta ? cantidad * porCubeta : cantidad, precio_unit: cubeta ? precio / porCubeta : precio, sistemaId: f['sistema' + i] || null })
      }
      if (!items.length) { problemas = ['Anota al menos un producto']; return pintar({ ...f, pagado: !!f.pagado }) }
      const venta = { id: nuevoId(), fecha: f.fecha || hoy, creado: new Date().toISOString(), cliente: f.cliente?.trim(), pagado: !!f.pagado, items }
      if (venta.pagado) venta.fecha_pago = venta.fecha
      ctx.cambiar((est) => est.ventas.push(venta), { mensaje: `Venta de ${pesos(totalVenta(venta))}`, ir: 'cuentas' })
    })
  }
  pintar({ fecha: hoy })
}

// ---------- Compra ----------
export async function pantallaCompra(raiz, ctx) {
  const { estado, hoy } = ctx
  const proveedores = [...new Set(estado.compras.map((c) => c.proveedor).filter(Boolean))]
  let problemas = []
  const fila = (i, v) => `<div class="tarjeta plana"><b class="chico">Insumo ${i + 1}</b>
    <label class="campo"><span>Qué</span><select name="insumo${i}">${opciones([['', i === 0 ? 'Escoge…' : '(ninguno)'], ...estado.insumos.map((x) => [x.id, `${x.nombre} (${x.unidad || 'unidad'})`]), ['__nuevo', '➕ Uno nuevo…']], v['insumo' + i])}</select></label>
    <div class="dos" data-nuevo="${i}" ${v['insumo' + i] === '__nuevo' ? '' : 'hidden'}><label class="campo"><span>Nombre</span><input name="nombre${i}" value="${esc(v['nombre' + i] || '')}"></label><label class="campo"><span>Unidad</span><input name="unidadn${i}" value="${esc(v['unidadn' + i] || 'kg')}"></label>
    <label class="campo" style="grid-column:1/-1"><span>Tipo</span><select name="categoria${i}">${opciones(Object.entries(CATEGORIAS_INSUMO), v['categoria' + i] || 'alimento')}</select></label></div>
    <div class="dos"><label class="campo"><span>Cantidad</span><input name="cantidad${i}" inputmode="decimal" value="${esc(v['cantidad' + i] ?? '')}"></label><label class="campo"><span>Precio total</span><input name="precio${i}" inputmode="numeric" value="${esc(v['precio' + i] ?? '')}"></label></div></div>`
  const pintar = (v) => {
    raiz.innerHTML = `<div class="pantalla">${cabeza('🛒 Nueva compra')}<form>${errores(problemas)}
      <datalist id="proveedores">${proveedores.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
      <div class="dos"><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}"></label><label class="campo"><span>Proveedor</span><input name="proveedor" list="proveedores" value="${esc(v.proveedor || '')}" autocomplete="off"></label></div>
      <p class="suave chico">Lo comprado entra al inventario. Se vuelve costo el día que se usa, no el día que se compra: si no, el mes de los tres bultos el huevo saldría carísimo.</p>
      ${[0, 1, 2].map((i) => fila(i, v)).join('')}
      <label class="marcar"><input type="checkbox" name="pagado" ${v.pagado !== false ? 'checked' : ''}> Ya la pagué</label>
      <button class="btn ancho">Guardar compra</button></form></div>`
    enlazar(raiz, ctx)
    const form = raiz.querySelector('form')
    form.addEventListener('change', (e) => {
      const m = e.target.name?.match(/^insumo(\d)$/)
      if (m) form.querySelector(`[data-nuevo="${m[1]}"]`).hidden = e.target.value !== '__nuevo'
    })
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(form))
      const items = []
      const nuevos = []
      for (const i of [0, 1, 2]) {
        let insumoId = f['insumo' + i]
        if (!insumoId) continue
        const cantidad = leerNumero(f['cantidad' + i])
        const precio = leerNumero(f['precio' + i], { entero: true })
        if (insumoId === '__nuevo') {
          if (!f['nombre' + i]?.trim()) { problemas = [`Insumo ${i + 1}: escribe el nombre`]; return pintar({ ...f, pagado: !!f.pagado }) }
          const n = { id: nuevoId(), nombre: f['nombre' + i].trim(), unidad: f['unidadn' + i]?.trim() || 'kg', categoria: f['categoria' + i], stock_inicial: 0 }
          nuevos.push(n)
          insumoId = n.id
        }
        if (!(cantidad > 0) || precio == null || precio < 0) { problemas = [`Insumo ${i + 1}: falta la cantidad o el precio`]; return pintar({ ...f, pagado: !!f.pagado }) }
        items.push({ insumoId, cantidad, precio_total: precio })
      }
      if (!items.length) { problemas = ['Escoge al menos un insumo']; return pintar({ ...f, pagado: !!f.pagado }) }
      const compra = { id: nuevoId(), fecha: f.fecha || hoy, creado: new Date().toISOString(), proveedor: f.proveedor?.trim(), pagado: !!f.pagado, items }
      ctx.cambiar((est) => { est.insumos.push(...nuevos); est.compras.push(compra) }, { mensaje: `Compra de ${pesos(totalCompra(compra))}`, ir: 'cuentas' })
    })
  }
  pintar({ fecha: hoy })
}

// ---------- Gasto ----------
export async function pantallaGasto(raiz, ctx, [prefijo]) {
  const { estado, hoy } = ctx
  const activos = estado.sistemas.filter((s) => !s.archivado)
  let problemas = []
  // Desde «Construir» llega prellenado: #/gasto/inversion?desc|monto|sistema
  const pre = prefijo ? Object.fromEntries(new URLSearchParams(prefijo)) : {}
  const pintar = (v) => {
    raiz.innerHTML = `<div class="pantalla">${cabeza('🧾 Nuevo gasto')}<form>${errores(problemas)}
      <div class="dos"><label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(v.fecha)}"></label><label class="campo"><span>Monto (pesos)</span><input name="monto" inputmode="numeric" value="${esc(v.monto ?? '')}"></label></div>
      <label class="campo"><span>Qué fue</span><input name="descripcion" value="${esc(v.descripcion || '')}"></label>
      <label class="campo"><span>Tipo</span><select name="categoria">${opciones(Object.entries(CATEGORIAS_GASTO), v.categoria)}</select></label>
      <label class="campo"><span>De qué sistema</span><select name="sistemaId">${opciones([['', 'General de la finca'], ...activos.map((s) => [s.id, s.nombre])], v.sistemaId)}</select></label>
      <label class="marcar"><input type="checkbox" name="es_inversion" ${v.es_inversion ? 'checked' : ''}> Es algo que dura (galpón, panel, herramienta)</label>
      <label class="campo"><span>¿Cuántos meses dura?</span><input name="vida_util_meses" inputmode="numeric" value="${esc(v.vida_util_meses ?? 60)}"><small>Lo que dura se reparte mes a mes en la utilidad. En la caja sí sale completo el día que se paga.</small></label>
      <button class="btn ancho">Guardar gasto</button></form></div>`
    enlazar(raiz, ctx)
    raiz.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(e.target))
      const monto = leerNumero(f.monto, { entero: true })
      const vida = leerNumero(f.vida_util_meses, { entero: true })
      problemas = []
      if (!(monto > 0)) problemas.push('El monto tiene que ser mayor que cero')
      if (!f.descripcion?.trim()) problemas.push('Escribe qué fue')
      if (f.es_inversion && !(vida > 0)) problemas.push('Los meses que dura tienen que ser más de cero')
      if (problemas.length) return pintar({ ...f, es_inversion: !!f.es_inversion })
      const gasto = { id: nuevoId(), fecha: f.fecha || hoy, creado: new Date().toISOString(), descripcion: f.descripcion.trim(), monto, categoria: f.categoria, sistemaId: f.sistemaId || null, es_inversion: !!f.es_inversion, vida_util_meses: f.es_inversion ? vida : undefined, tareaId: pre.tarea || undefined }
      ctx.cambiar((est) => {
        est.gastos.push(gasto)
        const t = pre.tarea && est.tareas.find((x) => x.id === pre.tarea)
        if (t && !t.hecha) { t.hecha = true; t.fecha_hecha = gasto.fecha }
      }, { mensaje: `Gasto de ${pesos(monto)}`, ir: pre.tarea ? 'construir' : 'cuentas' })
    })
  }
  pintar({ fecha: hoy, descripcion: pre.desc, monto: pre.monto, sistemaId: pre.sistema, es_inversion: pre.inversion === '1', categoria: pre.categoria || 'construccion', vida_util_meses: pre.vida || 60 })
}

// ---------- Inventario ----------
export async function pantallaInventario(raiz, ctx) {
  const { estado, hoy } = ctx
  const inv = calcularInventario(estado, hoy)
  const nombre = (id) => estado.insumos.find((i) => i.id === id)?.nombre || 'Insumo'
  raiz.innerHTML = `<div class="pantalla">${cabeza('📦 Inventario')}
    ${inv.alertas.length ? `<div class="ob-error">Se usó más de lo que había:<ul>${inv.alertas.slice(-5).map((a) => `<li>${esc(nombre(a.insumoId))} el ${fechaCorta(a.fecha)}: faltaron ${numero(a.faltante, 2)}. ¿Falta anotar una compra, o una cosecha o producción guardada en el inventario?</li>`).join('')}</ul></div>` : ''}
    ${estado.insumos.length ? `<div class="lista">${estado.insumos.map((i) => {
      const s = inv.porInsumo[i.id] || { stock: 0, costoProm: 0, valor: 0 }
      return `<div class="item"><span class="emoji">${(CATEGORIAS_INSUMO[i.categoria] || '🧰').split(' ')[0]}</span><div class="cuerpo"><b>${esc(i.nombre)} ${i.propio ? '<span class="etiqueta">de la finca</span>' : ''}${s.propioSinCosto ? ' <span class="etiqueta oro">sin precio</span>' : ''}</b><span>${numero(s.costoProm)} $/${esc(i.unidad || 'u')} · vale ${pesos(s.valor)}</span></div><span class="valor ${s.stock < 0 ? 'rojo' : ''}">${numero(s.stock, 1)} ${esc(i.unidad || '')}</span></div>`
    }).join('')}</div>` : '<div class="lista"><div class="vacio"><span class="emoji">📦</span>Sin insumos. Aparecen al anotar compras o al crearlos aquí.</div></div>'}
    <p class="suave chico">El costo es el promedio de lo que hay en la caneca: el bulto caro y el barato se mezclan, y así se cobran.</p>
    <a class="btn ancho" href="#/insumo">➕ Nuevo insumo</a></div>`
  enlazar(raiz, ctx)
}

export async function pantallaInsumo(raiz, ctx) {
  let problemas = []
  const pintar = (v) => {
    raiz.innerHTML = `<div class="pantalla">${cabeza('Nuevo insumo')}<form>${errores(problemas)}
      <label class="campo"><span>Nombre</span><input name="nombre" value="${esc(v.nombre || '')}" placeholder="Concentrado de postura"></label>
      <div class="dos"><label class="campo"><span>Tipo</span><select name="categoria">${opciones(Object.entries(CATEGORIAS_INSUMO), v.categoria)}</select></label><label class="campo"><span>Unidad</span><input name="unidad" value="${esc(v.unidad || 'kg')}"></label></div>
      <label class="marcar"><input type="checkbox" name="propio" ${v.propio ? 'checked' : ''}> Lo produce la finca (maíz, bocashi, humus)</label>
      <div class="dos"><label class="campo"><span>Cuánto hay hoy</span><input name="stock_inicial" inputmode="decimal" value="${esc(v.stock_inicial ?? '')}"></label><label class="campo"><span>Costo por unidad</span><input name="costo_unit_inicial" inputmode="numeric" value="${esc(v.costo_unit_inicial ?? '')}"></label></div>
      <button class="btn ancho">Crear</button></form></div>`
    enlazar(raiz, ctx)
    raiz.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(e.target))
      problemas = f.nombre?.trim() ? [] : ['Ponle un nombre']
      if (problemas.length) return pintar(f)
      ctx.cambiar((est) => est.insumos.push({ id: nuevoId(), nombre: f.nombre.trim(), categoria: f.categoria, unidad: f.unidad?.trim() || 'kg', propio: !!f.propio, stock_inicial: leerNumero(f.stock_inicial) || 0, costo_unit_inicial: leerNumero(f.costo_unit_inicial, { entero: true }) || 0 }), { mensaje: 'Insumo creado', ir: 'inventario' })
    })
  }
  pintar({ categoria: 'alimento' })
}
