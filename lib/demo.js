// Una finca de prueba para explorar la app con números antes de tener los
// propios. Va marcada `demo: true` y la interfaz lo dice en todas partes: son
// números INVENTADOS, no datos de ninguna finca. Pero tienen la forma que dice
// la investigación (datos/gallinas.json), porque esta es la primera finca que
// ve quien está decidiendo si arranca:
//   - las pollonas se compran de 16 semanas a $35.000 y el primer huevo llega
//     hacia la semana 23: el primer mes y medio es solo gasto;
//   - la postura sube por la curva estimada hasta ~60 % en la semana 34;
//   - el concentrado se compra por bultos de 40 kg a ~$83.600.
// Así la finca de prueba enseña la verdad del negocio: con 30 gallinas, la
// cuenta solo cierra si no se cobra el trabajo propio.

import { estadoVacio, nuevoId } from './modelo.js'
import { sumarDias, hoyISO } from './fechas.js'

const DIAS = 120

// Copia de la curva ESTIMADA de datos/gallinas.json (hasta la semana 40). Va
// copiada porque la finca de prueba se arma sin red; pruebas/demo.test.js
// revisa que no se desvíe del archivo.
export const CURVA_DEMO = [[22,0], [23,2], [24,4], [25,8], [26,15], [27,23], [28,31], [29,39], [30,46], [31,51], [32,55], [33,58], [34,60], [36,60], [38,59]]

// Postura esperada (0 a 1) a una edad en semanas, interpolando entre puntos.
export function posturaCurva(semanas) {
  if (semanas <= CURVA_DEMO[0][0]) return 0
  for (let i = 1; i < CURVA_DEMO.length; i++) {
    const [s1, p1] = CURVA_DEMO[i]
    if (semanas <= s1) {
      const [s0, p0] = CURVA_DEMO[i - 1]
      return (p0 + ((p1 - p0) * (semanas - s0)) / (s1 - s0)) / 100
    }
  }
  return CURVA_DEMO[CURVA_DEMO.length - 1][1] / 100
}

export function crearFincaDePrueba(hoy = hoyISO()) {
  const e = estadoVacio()
  e.demo = true
  e.finca = { nombre: 'Finca de prueba', creada: hoy }
  let semilla = 11
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
  const ini = sumarDias(hoy, -DIAS)
  const sis = (tipo, nombre, extra = {}) => { const s = { id: nuevoId(), tipo, nombre, creado: ini, ...extra }; e.sistemas.push(s); return s }
  const g = sis('gallinas', 'Gallinero de araucanas', { tamano: 30 })
  const huerta = sis('cultivo', 'Huerta de la casa', { tamano: 60 })
  const maiz = sis('cultivo', 'Maíz para las gallinas', { tamano: 400 })
  const bocashi = sis('compost', 'Bocashi')
  const bosque = sis('bosque', 'Lindero de alisos')
  const ins = (nombre, categoria, unidad, extra = {}) => { const i = { id: nuevoId(), nombre, categoria, unidad, stock_inicial: 0, ...extra }; e.insumos.push(i); return i }
  const conc = ins('Concentrado de postura', 'alimento', 'kg')
  const maizP = ins('Maíz de la finca', 'alimento', 'kg', { propio: true })
  const boc = ins('Bocashi de la finca', 'abono', 'kg', { propio: true })
  ins('Cubeta de cartón', 'empaque', 'unidad', { stock_inicial: 20, costo_unit_inicial: 600 })

  let n = 0
  const reg = (s, tipo, fecha, datos) => e.registros.push({ id: nuevoId(), sistemaId: s ? s.id : null, tipo, fecha, creado: `${fecha}T08:${String(n++ % 60).padStart(2, '0')}:00`, datos })
  const dia = (d) => sumarDias(ini, d)

  e.gastos.push({ id: nuevoId(), fecha: dia(-12), descripcion: 'Galpón de 12 m² con malla y nidos', monto: 2500000, categoria: 'construccion', sistemaId: g.id, es_inversion: true, vida_util_meses: 120 })
  e.gastos.push({ id: nuevoId(), fecha: dia(-5), descripcion: 'Comederos y bebederos', monto: 180000, categoria: 'herramienta', sistemaId: g.id, es_inversion: true, vida_util_meses: 36 })
  reg(g, 'altas', ini, { cantidad: 30, edad_semanas: 16, costo_total: 1200000, origen: 'Granja de la región: 30 pollonas a $35.000 + $150.000 de transporte' })
  e.equipos.push({ id: nuevoId(), nombre: 'Bombillos LED del galpón', sistemaId: g.id, vatios: 18, horas_dia: 3, desde: ini })

  for (let d = 0; d <= DIAS; d += 12) {
    e.compras.push({ id: nuevoId(), fecha: dia(d), creado: dia(d) + 'T07:00', proveedor: 'Agropecuaria del pueblo', pagado: true, items: [{ insumoId: conc.id, cantidad: 40, precio_total: 83600 }] })
  }
  reg(maiz, 'cosecha', dia(9), { producto: 'maiz', cantidad: 60, unidad: 'kg', destino: 'gallinas', insumoId: maizP.id, costo_unit: 1200 })
  reg(maiz, 'cosecha', dia(104), { producto: 'maiz', cantidad: 50, unidad: 'kg', destino: 'gallinas', insumoId: maizP.id, costo_unit: 1200 })
  reg(bocashi, 'produccion', dia(3), { producto: 'bocashi', cantidad: 120, unidad: 'kg', insumoId: boc.id, costo_unit: 300 })
  reg(bocashi, 'produccion', dia(60), { producto: 'bocashi', cantidad: 150, unidad: 'kg', insumoId: boc.id, costo_unit: 300 })
  reg(huerta, 'siembra', dia(4), { especie: 'Lechuga y acelga', cantidad: 80, area_m2: 12 })
  reg(huerta, 'aplicacion', dia(4), { insumoId: boc.id, cantidad: 40 })
  reg(huerta, 'cosecha', dia(41), { producto: 'lechuga', cantidad: 35, unidad: 'unidades', destino: 'venta' })
  reg(huerta, 'siembra', dia(50), { especie: 'Cilantro y cebolla larga', cantidad: 300, area_m2: 15 })
  reg(huerta, 'aplicacion', dia(62), { insumoId: boc.id, cantidad: 50 })
  reg(huerta, 'cosecha', dia(105), { producto: 'cilantro', cantidad: 40, unidad: 'atados', destino: 'venta' })
  for (const [d, horas] of [[4, 3], [41, 2], [50, 3], [105, 2]]) reg(huerta, 'labor', dia(d), { horas, descripcion: 'Huerta' })
  reg(bosque, 'siembra', dia(15), { especie: 'Aliso', cantidad: 12 })
  reg(bosque, 'siembra', dia(30), { especie: 'Aliso', cantidad: 8 })
  reg(bosque, 'siembra', dia(75), { especie: 'Arrayán', cantidad: 15 })

  let aves = 30
  let guardados = 0
  let maizQueda = 0
  for (let d = 1; d <= DIAS; d++) {
    const f = dia(d)
    if (d === 50) { reg(g, 'bajas', f, { cantidad: 1, motivo: 'depredador' }); aves-- }
    if (d === 9) maizQueda += 60
    if (d === 104) maizQueda += 50
    const semanas = 16 + d / 7
    const esperada = posturaCurva(semanas)
    // Una bandada cualquiera: la curva más un ruido de ±4 puntos (nunca negativo).
    const postura = esperada > 0 ? Math.max(0, esperada + (azar() - 0.5) * 0.08) : 0
    const huevos = Math.round(aves * postura)
    if (huevos > 0) {
      const azul = Math.round(huevos * 0.55)
      const verde = Math.round(huevos * 0.4)
      reg(g, 'produccion', f, { producto: 'huevo-azul', cantidad: azul, unidad: 'unidades' })
      if (verde > 0) reg(g, 'produccion', f, { producto: 'huevo-verde', cantidad: verde, unidad: 'unidades' })
      if (huevos - azul - verde > 0) reg(g, 'produccion', f, { producto: 'huevo-crema', cantidad: huevos - azul - verde, unidad: 'unidades' })
    }
    // Las pollonas comen ~100 g al día; en postura, ~110 g.
    const racion = semanas < 21 ? 0.1 : 0.11
    const maizHoy = maizQueda >= 0.6 ? 0.6 : 0
    maizQueda -= maizHoy
    reg(g, 'alimentacion', f, { insumoId: conc.id, cantidad: Math.round((aves * racion - maizHoy) * 10) / 10 })
    if (maizHoy) reg(g, 'alimentacion', f, { insumoId: maizP.id, cantidad: maizHoy })
    reg(g, 'labor', f, { horas: 1, descripcion: 'Comida, agua y recoger huevos' })
    guardados += Math.max(0, huevos - 4) // cuatro huevos al día para la casa
    if (d % 4 === 0 && guardados >= 30) {
      const cantidad = Math.floor(guardados / 30) * 30
      guardados -= cantidad
      // La tienda paga cada quince días: lo de las dos últimas semanas está por cobrar.
      const tienda = d % 12 === 0
      e.ventas.push({ id: nuevoId(), fecha: f, cliente: tienda ? 'Tienda de la vereda' : 'Vecinos', pagado: !tienda || d < DIAS - 14, items: [{ producto: 'huevo-azul', cantidad, precio_unit: 1000, sistemaId: g.id }] })
    }
  }
  e.ventas.push({ id: nuevoId(), fecha: dia(42), cliente: 'Vecinos', pagado: true, items: [{ producto: 'lechuga', cantidad: 30, precio_unit: 2000, sistemaId: huerta.id }] })
  e.ventas.push({ id: nuevoId(), fecha: dia(106), cliente: 'Vecinos', pagado: true, items: [{ producto: 'cilantro', cantidad: 35, precio_unit: 1500, sistemaId: huerta.id }] })
  e.tareas.push({ id: nuevoId(), origen: 'calendario', titulo: 'Newcastle: revacunación de la semana 26', fecha: dia(70), hecha: true, fecha_hecha: dia(70) })
  // Llegaron de 16 semanas: la semana 36 cae el día (36 − 16) × 7 = 140.
  e.tareas.push({ id: nuevoId(), origen: 'calendario', titulo: 'Newcastle: revacunación de la semana 36', fecha: dia(140), hecha: false })
  e.tareas.push({ id: nuevoId(), origen: 'calendario', titulo: 'Voltear la pila de bocashi', fecha: sumarDias(hoy, 2), hecha: false })
  return e
}
