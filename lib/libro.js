// El libro de cuentas de la finca: inventario, costos por sistema, costo por
// huevo, utilidad y caja. Todo se recalcula desde los registros; nada se guarda
// sumado, así que un registro corregido corrige todas las cuentas.
//
// Tres decisiones que cambian los números y por eso están escritas:
// 1. El inventario va a COSTO PROMEDIO: el bulto comprado caro y el barato se
//    mezclan en la caneca; no tiene sentido fingir que se sabe cuál se gastó.
// 2. Una compra de insumo NO es costo el día que se compra: es costo el día que
//    se usa (alimentación, aplicación). Si no, el mes que se compran tres
//    bultos el huevo sale carísimo y el siguiente sale regalado.
// 3. Lo que dura (galpón, panel, las pollonas) se reparte en su vida útil
//    (depreciación lineal). Las pollonas son la inversión más grande del
//    gallinero y se «gastan» poniendo huevos durante unos dos años.

import { enRango, diasEntre, sumarDias } from './fechas.js'
import { TIPOS_SISTEMA } from './modelo.js'

const DIAS_MES = 30.4375 // 365,25 / 12

const esHuevo = (producto) => typeof producto === 'string' && producto.startsWith('huevo')

function ordenEventos(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  // El mismo día, primero lo que entra y después lo que sale: si llega el
  // bulto y se usa ese día, había con qué.
  if (a.tipo !== b.tipo) return a.tipo === 'entrada' ? -1 : 1
  return (a.orden || '') < (b.orden || '') ? -1 : 1
}

// ---------- Inventario ----------
export function calcularInventario(estado, hasta = null) {
  const eventos = []
  for (const c of estado.compras) {
    if (hasta && c.fecha > hasta) continue
    for (const it of c.items || []) {
      if (!it.insumoId || !(it.cantidad > 0)) continue
      eventos.push({ fecha: c.fecha, orden: c.creado, tipo: 'entrada', origen: 'comprado', insumoId: it.insumoId, cantidad: it.cantidad, costo: it.precio_total || 0, ref: c.id })
    }
  }
  for (const r of estado.registros) {
    if (hasta && r.fecha > hasta) continue
    const d = r.datos || {}
    if ((r.tipo === 'cosecha' || r.tipo === 'produccion') && d.insumoId && d.cantidad > 0) {
      // Lo que la finca produce y guarda (maíz para las gallinas, bocashi) entra
      // al inventario. Su costo lo pone el dueño; si no lo pone entra a $0 y la
      // ficha lo avisa, porque un maíz «gratis» hace ver el huevo más barato de lo que es.
      eventos.push({ fecha: r.fecha, orden: r.creado, tipo: 'entrada', origen: 'propio', insumoId: d.insumoId, cantidad: d.cantidad, costo: (d.costo_unit || 0) * d.cantidad, sinCosto: !d.costo_unit, ref: r.id })
    }
    if (['alimentacion', 'aplicacion', 'sanidad'].includes(r.tipo) && d.insumoId && d.cantidad > 0) {
      eventos.push({ fecha: r.fecha, orden: r.creado, tipo: 'salida', insumoId: d.insumoId, cantidad: d.cantidad, ref: r.id, sistemaId: r.sistemaId || null, registroTipo: r.tipo })
    }
  }
  eventos.sort(ordenEventos)

  const porInsumo = {}
  for (const i of estado.insumos) {
    const ini = i.stock_inicial || 0
    porInsumo[i.id] = {
      stock: ini,
      costoProm: i.costo_unit_inicial || 0,
      // Cuánto del stock es propio y cuánto comprado: sirve para medir si la
      // finca ya alimenta a sus gallinas o sigue dependiendo del concentrado.
      stockPropio: i.propio ? ini : 0,
      stockComprado: i.propio ? 0 : ini,
      propioSinCosto: false,
    }
  }
  const consumos = []
  const alertas = []
  for (const e of eventos) {
    const s = (porInsumo[e.insumoId] ||= { stock: 0, costoProm: 0, stockPropio: 0, stockComprado: 0, propioSinCosto: false })
    if (e.tipo === 'entrada') {
      const valor = Math.max(0, s.stock) * s.costoProm + e.costo
      s.stock += e.cantidad
      s.costoProm = s.stock > 0 ? valor / s.stock : 0
      if (e.origen === 'propio') {
        s.stockPropio += e.cantidad
        if (e.sinCosto) s.propioSinCosto = true
      } else s.stockComprado += e.cantidad
    } else {
      if (e.cantidad > s.stock + 1e-9) alertas.push({ tipo: 'stock-negativo', insumoId: e.insumoId, fecha: e.fecha, faltante: e.cantidad - Math.max(0, s.stock) })
      const totalOrigen = s.stockPropio + s.stockComprado
      const fraccionPropia = totalOrigen > 0 ? s.stockPropio / totalOrigen : 0
      consumos.push({ ref: e.ref, fecha: e.fecha, sistemaId: e.sistemaId, insumoId: e.insumoId, registroTipo: e.registroTipo, cantidad: e.cantidad, costo: e.cantidad * s.costoProm, fraccionPropia })
      // Se descuenta de lo propio y lo comprado en proporción: en la caneca están revueltos.
      const usarPropio = Math.min(s.stockPropio, e.cantidad * fraccionPropia)
      s.stockPropio -= usarPropio
      s.stockComprado = Math.max(0, s.stockComprado - (e.cantidad - usarPropio))
      s.stock -= e.cantidad
    }
  }
  for (const id in porInsumo) porInsumo[id].valor = Math.max(0, porInsumo[id].stock) * porInsumo[id].costoProm
  return { porInsumo, consumos, alertas }
}

// ---------- Depreciación ----------
// Parte de una inversión que le toca al rango [desde, hasta].
export function depreciacionEnRango(monto, fecha, vidaMeses, desde, hasta) {
  if (!(monto > 0) || !(vidaMeses > 0)) return 0
  const vidaDias = Math.round(vidaMeses * DIAS_MES)
  const fin = sumarDias(fecha, vidaDias - 1)
  const a = desde && desde > fecha ? desde : fecha
  const b = hasta && hasta < fin ? hasta : fin
  if (b < a) return 0
  return (monto / vidaDias) * (diasEntre(a, b) + 1)
}

// ---------- Energía ----------
export function kwhDia(equipo) {
  return ((equipo.vatios || 0) * (equipo.horas_dia || 0)) / 1000
}

// Días que el equipo estuvo encendido dentro del rango (cada equipo tiene desde/hasta opcionales).
function diasActivo(equipo, desde, hasta) {
  const a = equipo.desde && (!desde || equipo.desde > desde) ? equipo.desde : desde
  const b = equipo.hasta && (!hasta || equipo.hasta < hasta) ? equipo.hasta : hasta
  if (!a || !b || b < a) return 0
  return diasEntre(a, b) + 1
}

// ---------- Costos por sistema ----------
const filaVacia = () => ({ insumos: 0, gastos: 0, depreciacion: 0, energia: 0, mano_obra: 0, total: 0 })

export function costosPorSistema(estado, desde, hasta) {
  const ajustes = estado.ajustes || {}
  const res = {}
  const fila = (id) => (res[id || 'general'] ||= filaVacia())
  const sistemas = Object.fromEntries(estado.sistemas.map((s) => [s.id, s]))

  const inv = calcularInventario(estado, hasta)
  for (const c of inv.consumos) if (enRango(c.fecha, desde, hasta)) fila(c.sistemaId).insumos += c.costo

  for (const g of estado.gastos) {
    if (g.es_inversion) fila(g.sistemaId).depreciacion += depreciacionEnRango(g.monto, g.fecha, g.vida_util_meses || 60, desde, hasta)
    else if (enRango(g.fecha, desde, hasta)) fila(g.sistemaId).gastos += g.monto || 0
  }

  for (const r of estado.registros) {
    const d = r.datos || {}
    if (r.tipo === 'altas' && d.costo_total > 0) {
      const tipo = sistemas[r.sistemaId]?.tipo
      const vida = d.vida_util_meses || TIPOS_SISTEMA[tipo]?.vida_util_meses || 24
      fila(r.sistemaId).depreciacion += depreciacionEnRango(d.costo_total, r.fecha, vida, desde, hasta)
    }
    if (r.tipo === 'labor' && ajustes.contar_mano_obra && enRango(r.fecha, desde, hasta)) {
      fila(r.sistemaId).mano_obra += (d.horas || 0) * (ajustes.valor_hora_cop || 0)
    }
  }

  const tarifa = ajustes.tarifa_kwh_cop || 0
  for (const eq of estado.equipos) {
    if (eq.activo === false) continue
    // Si el equipo funciona con panel solar propio, su energía no se paga por
    // kWh: se paga en la depreciación del panel (que va como inversión).
    if (eq.solar) continue
    fila(eq.sistemaId).energia += kwhDia(eq) * diasActivo(eq, desde, hasta) * tarifa
  }

  for (const id in res) {
    const f = res[id]
    f.total = f.insumos + f.gastos + f.depreciacion + f.energia + f.mano_obra
  }
  return res
}

// ---------- Gallinas ----------
// Aves vivas al final de un día: llegadas menos salidas hasta esa fecha.
export function avesVivas(estado, sistemaId, fecha) {
  let n = 0
  for (const r of estado.registros) {
    if (r.sistemaId !== sistemaId || r.fecha > fecha) continue
    if (r.tipo === 'altas') n += r.datos?.cantidad || 0
    if (r.tipo === 'bajas') n -= r.datos?.cantidad || 0
  }
  return Math.max(0, n)
}

// Suma de aves de cada día del rango («aves-día»): la base honesta para la
// postura. 30 gallinas durante 10 días son 300 aves-día; si pusieron 210 huevos,
// la postura fue 70 %.
export function avesDia(estado, sistemaId, desde, hasta) {
  const cambios = {}
  let inicial = 0
  for (const r of estado.registros) {
    if (r.sistemaId !== sistemaId || (r.tipo !== 'altas' && r.tipo !== 'bajas')) continue
    const delta = (r.tipo === 'altas' ? 1 : -1) * (r.datos?.cantidad || 0)
    if (r.fecha < desde) inicial += delta
    else if (r.fecha <= hasta) cambios[r.fecha] = (cambios[r.fecha] || 0) + delta
  }
  // Una baja del día cuenta desde el día siguiente; una llegada cuenta ese mismo día.
  let total = 0
  let vivas = Math.max(0, inicial)
  const dias = diasEntre(desde, hasta) + 1
  let fecha = desde
  for (let i = 0; i < dias; i++) {
    const delta = cambios[fecha] || 0
    if (delta > 0) vivas += delta
    total += Math.max(0, vivas)
    if (delta < 0) vivas += delta
    fecha = sumarDias(fecha, 1)
  }
  return total
}

export function indicadoresGallinas(estado, sistemaId, desde, hasta) {
  let huevos = 0
  const porColor = {}
  let bajasMuerte = 0
  for (const r of estado.registros) {
    if (r.sistemaId !== sistemaId || !enRango(r.fecha, desde, hasta)) continue
    const d = r.datos || {}
    if (r.tipo === 'produccion' && esHuevo(d.producto)) {
      huevos += d.cantidad || 0
      porColor[d.producto] = (porColor[d.producto] || 0) + (d.cantidad || 0)
    }
    if (r.tipo === 'bajas' && ['muerte', 'depredador', 'enfermedad'].includes(d.motivo)) bajasMuerte += d.cantidad || 0
  }
  const ad = avesDia(estado, sistemaId, desde, hasta)
  const inv = calcularInventario(estado, hasta)
  let alimentoKg = 0
  let alimentoPropioKg = 0
  for (const c of inv.consumos) {
    if (c.sistemaId !== sistemaId || c.registroTipo !== 'alimentacion' || !enRango(c.fecha, desde, hasta)) continue
    alimentoKg += c.cantidad
    alimentoPropioKg += c.cantidad * c.fraccionPropia
  }
  const costos = costosPorSistema(estado, desde, hasta)[sistemaId] || filaVacia()
  let vendidos = 0
  let ingresos = 0
  for (const v of estado.ventas) {
    if (!enRango(v.fecha, desde, hasta)) continue
    for (const it of v.items || []) {
      if (it.sistemaId === sistemaId && esHuevo(it.producto)) {
        vendidos += it.cantidad || 0
        ingresos += (it.cantidad || 0) * (it.precio_unit || 0)
      }
    }
  }
  const avesInicio = avesVivas(estado, sistemaId, sumarDias(desde, -1))
  return {
    aves: avesVivas(estado, sistemaId, hasta),
    aves_dia: ad,
    huevos,
    por_color: porColor,
    postura: ad > 0 ? huevos / ad : null,
    alimento_kg: alimentoKg,
    consumo_g_ave_dia: ad > 0 ? (alimentoKg * 1000) / ad : null,
    kg_alimento_por_docena: huevos > 0 ? alimentoKg / (huevos / 12) : null,
    autosuficiencia_alimento: alimentoKg > 0 ? alimentoPropioKg / alimentoKg : null,
    costos,
    costo_por_huevo: huevos > 0 ? costos.total / huevos : null,
    vendidos,
    ingresos,
    precio_medio_huevo: vendidos > 0 ? ingresos / vendidos : null,
    margen_por_huevo: vendidos > 0 && huevos > 0 ? ingresos / vendidos - costos.total / huevos : null,
    mortalidad: avesInicio > 0 ? bajasMuerte / avesInicio : null,
  }
}

// ---------- Ventas, utilidad y caja ----------
export function totalVenta(v) {
  return (v.items || []).reduce((s, it) => s + (it.cantidad || 0) * (it.precio_unit || 0), 0)
}

export function totalCompra(c) {
  return (c.items || []).reduce((s, it) => s + (it.precio_total || 0), 0)
}

export function resumen(estado, desde, hasta) {
  let ventas = 0
  let porCobrar = 0
  let entra = 0
  const porProducto = {}
  for (const v of estado.ventas) {
    const t = totalVenta(v)
    if (enRango(v.fecha, desde, hasta)) {
      ventas += t
      for (const it of v.items || []) porProducto[it.producto] = (porProducto[it.producto] || 0) + (it.cantidad || 0) * (it.precio_unit || 0)
    }
    // Lo fiado se cuenta hasta el final del rango: es plata que alguien debe hoy.
    if (!v.pagado && v.fecha <= hasta) porCobrar += t
    if (v.pagado && enRango(v.fecha_pago || v.fecha, desde, hasta)) entra += t
  }
  let sale = 0
  let porPagar = 0
  for (const c of estado.compras) {
    const t = totalCompra(c)
    if (c.pagado === false) {
      if (c.fecha <= hasta) porPagar += t
    } else if (enRango(c.fecha, desde, hasta)) sale += t
  }
  for (const g of estado.gastos) if (enRango(g.fecha, desde, hasta)) sale += g.monto || 0
  for (const r of estado.registros) if (r.tipo === 'altas' && enRango(r.fecha, desde, hasta)) sale += r.datos?.costo_total || 0

  const costos = costosPorSistema(estado, desde, hasta)
  const sumaSistemas = Object.values(costos).reduce((s, f) => s + f.total, 0)
  // Lo que la finca se da a sí misma (el maíz propio que comen las gallinas) es
  // costo del gallinero a su precio de traslado, pero lo que costó producirlo ya
  // está en las cuentas del cultivo. Para la finca entera se resta una vez; si
  // no, el maíz se cobra dos veces. (Con el inventario a costo promedio, la parte
  // propia sale valorada al promedio de la caneca: es una aproximación.)
  let internas = 0
  for (const c of calcularInventario(estado, hasta).consumos) if (enRango(c.fecha, desde, hasta)) internas += c.costo * c.fraccionPropia
  const costoTotal = sumaSistemas - internas
  return {
    ventas,
    costos: costoTotal,
    transferencias_internas: internas,
    // Utilidad = lo vendido menos lo que costó producirlo en ese tiempo (con
    // depreciación). Caja = la plata que de verdad entró menos la que salió.
    // Pueden diferir mucho: el mes que se compra el galpón la caja se hunde y
    // la utilidad casi no se mueve.
    utilidad: ventas - costoTotal,
    caja: entra - sale,
    entra,
    sale,
    por_cobrar: porCobrar,
    por_pagar: porPagar,
    por_producto: porProducto,
    por_sistema: costos,
  }
}
