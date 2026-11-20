// El modelo de datos de la finca: qué se guarda y con qué forma.
//
// La idea central (tomada de farmOS y adaptada): la finca tiene SISTEMAS (cada
// gallinero, cada cultivo, la lombricultura, el bosque, el agua, la energía) y
// todo lo que pasa se anota como un REGISTRO con fecha que pertenece a un
// sistema. De los registros salen las cuentas, los indicadores y el juego; por
// eso no se guardan totales: se recalculan, y nunca se descuadran.
//
// Las compras y las ventas son aparte porque mueven plata y tienen otra parte
// (proveedor o cliente). Los insumos son el inventario: el bulto de
// concentrado, el bocashi, la semilla.

export const COLECCIONES = ['sistemas', 'registros', 'insumos', 'compras', 'ventas', 'gastos', 'contactos', 'tareas', 'equipos', 'mapa', 'tecnicas', 'precios']

export const TIPOS_SISTEMA = {
  gallinas: {
    nombre: 'Gallinas ponedoras', emoji: '🐔', unidad: 'aves',
    productos: ['huevo-azul', 'huevo-verde', 'huevo-marron', 'huevo-crema', 'gallinaza'],
    registros: ['produccion', 'alimentacion', 'sanidad', 'altas', 'bajas', 'labor', 'medicion', 'nota'],
    vida_util_meses: 24, // las criollas ponen bien unos dos años; después baja la postura
  },
  cultivo: {
    nombre: 'Cultivo', emoji: '🌱', unidad: 'm²',
    productos: [],
    registros: ['siembra', 'aplicacion', 'labor', 'cosecha', 'medicion', 'sanidad', 'nota'],
  },
  lombricultura: {
    nombre: 'Lombricultura', emoji: '🪱', unidad: 'm² de lecho',
    productos: ['humus', 'lombriz'],
    registros: ['alimentacion', 'cosecha', 'medicion', 'labor', 'nota'],
  },
  compost: {
    nombre: 'Compostera / bocashi', emoji: '♻️', unidad: 'pilas',
    productos: ['compost', 'bocashi', 'biol'],
    registros: ['aplicacion', 'produccion', 'medicion', 'labor', 'nota'],
  },
  bosque: {
    nombre: 'Bosque nativo', emoji: '🌳', unidad: 'árboles',
    productos: [],
    registros: ['siembra', 'medicion', 'labor', 'nota'],
  },
  agua: {
    nombre: 'Agua', emoji: '💧', unidad: 'litros',
    productos: [],
    registros: ['medicion', 'labor', 'nota'],
  },
  energia: {
    nombre: 'Energía', emoji: '☀️', unidad: 'kWh',
    productos: [],
    registros: ['medicion', 'labor', 'nota'],
  },
  // Las vacas de la finca. El ganado de tierra fría NO se ha investigado para
  // esta app: este tipo anota y suma como cualquier otro, pero no trae metas,
  // costos de referencia ni plan sanitario, y la pantalla lo dice al crearlo.
  ganado: {
    nombre: 'Ganado', emoji: '🐄', unidad: 'animales',
    productos: ['leche', 'queso', 'ternero', 'estiércol'],
    registros: ['produccion', 'alimentacion', 'sanidad', 'labor', 'medicion', 'nota'],
  },
  otro: { nombre: 'Otro', emoji: '📦', unidad: '', productos: [], registros: ['produccion', 'labor', 'medicion', 'nota'] },
}

// Qué pide cada tipo de registro. La interfaz arma el formulario con esto.
export const TIPOS_REGISTRO = {
  produccion: { nombre: 'Producción', emoji: '🥚', campos: ['producto', 'cantidad', 'unidad', 'insumoId?'] },
  alimentacion: { nombre: 'Alimento', emoji: '🌽', campos: ['insumoId', 'cantidad'] },
  aplicacion: { nombre: 'Abono o aplicación', emoji: '🧪', campos: ['insumoId', 'cantidad'] },
  siembra: { nombre: 'Siembra', emoji: '🌱', campos: ['especie', 'cantidad', 'area_m2?'] },
  cosecha: { nombre: 'Cosecha', emoji: '🧺', campos: ['producto', 'cantidad', 'unidad', 'destino', 'insumoId?'] },
  sanidad: { nombre: 'Sanidad', emoji: '💉', campos: ['accion', 'insumoId?', 'cantidad?'] },
  altas: { nombre: 'Llegada de animales', emoji: '🐣', campos: ['cantidad', 'costo_total', 'origen'] },
  bajas: { nombre: 'Salida o muerte', emoji: '🕊️', campos: ['cantidad', 'motivo'] },
  labor: { nombre: 'Trabajo', emoji: '🧑‍🌾', campos: ['horas', 'descripcion'] },
  medicion: { nombre: 'Medición', emoji: '📏', campos: ['variable', 'valor', 'unidad'] },
  lluvia: { nombre: 'Lluvia', emoji: '🌧️', campos: ['mm'] },
  temperatura: { nombre: 'Temperatura', emoji: '🌡️', campos: ['min', 'max'] },
  nota: { nombre: 'Nota', emoji: '📝', campos: ['texto'] },
}

export const MOTIVOS_BAJA = ['muerte', 'depredador', 'enfermedad', 'descarte', 'venta', 'consumo']

export const CATEGORIAS_INSUMO = {
  alimento: '🌽 Alimento',
  abono: '🧪 Abono e insumo',
  semilla: '🌱 Semilla y plántula',
  sanidad: '💉 Sanidad',
  empaque: '📦 Empaque',
  otro: '🧰 Otro',
}

// Qué insumos ofrece cada formulario. Lo que la finca produce («propio») y quedó
// como «otro» (el forraje o la cáscara que entran con una cosecha o una
// producción) se puede dar de comer: antes no salía en «Alimento», y «Comida de
// la finca» se quedaba en cero con datos de verdad. Lo propio que ya tiene otra
// categoría no es comida: el bocashi es «abono», y el 18-nov salió en el
// formulario de Alimento del gallinero de la finca de prueba.
export function insumosPara(insumos, categorias) {
  return insumos.filter((i) => !categorias || categorias.includes(i.categoria) || (categorias.includes('alimento') && i.propio && i.categoria === 'otro'))
}

// La categoría de un insumo que se crea desde un formulario de registro. Una
// cosecha que va «para las gallinas» es alimento, no «otro». Lo que sale de la
// compostera (bocashi, compost, biol) y el humus del lombricultivo son abono. La
// lombriz no: es comida de gallina aunque se coseche «para vender» o «se
// guarda», y como abono no salía nunca en el Alimento del gallinero (un insumo
// no se edita después de creado). Y lo que se les echa a las lombrices no es
// comida de gallina: como «alimento» aparecía después en el gallinero.
export function categoriaDeInsumoNuevo(tipoRegistro, destino, tipoSistema, producto = '') {
  if (tipoRegistro === 'cosecha' && destino === 'gallinas') return 'alimento'
  if (tipoRegistro === 'alimentacion') return tipoSistema === 'lombricultura' ? 'otro' : 'alimento'
  if (tipoRegistro === 'aplicacion') return 'abono'
  if (tipoRegistro === 'sanidad') return 'sanidad'
  if (tipoSistema === 'lombricultura' && /lombri/i.test(producto)) return 'alimento'
  if (tipoSistema === 'compost' || tipoSistema === 'lombricultura') return 'abono'
  return 'otro'
}

// «kg», «Kg», «kilos» y «kilogramos» son lo mismo: la revisión de unidades de
// validarRegistro no tiene por qué frenar a nadie por eso.
const SINONIMOS_UNIDAD = { kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg', kgs: 'kg', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g', litro: 'l', litros: 'l', lt: 'l', lts: 'l', und: 'unidad', unid: 'unidad', unidades: 'unidad' }
export function unidadNormal(u) {
  const s = String(u ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\.$/, '')
  if (SINONIMOS_UNIDAD[s]) return SINONIMOS_UNIDAD[s]
  // Plural a singular: «bultos», «costales», «libras», «galones». Sin esto, un
  // insumo en «bulto» frenaba una cosecha de 3 «bultos».
  const singular = s.length > 3 ? s.replace(/([lnrd])es$/, '$1').replace(/s$/, '') : s
  return SINONIMOS_UNIDAD[singular] || singular
}

export const CATEGORIAS_GASTO = {
  mano_obra: 'Mano de obra pagada',
  transporte: 'Transporte',
  servicios: 'Servicios (luz, agua, internet)',
  arriendo: 'Arriendo',
  construccion: 'Construcción e infraestructura',
  herramienta: 'Herramienta y equipo',
  tramites: 'Trámites y certificaciones',
  otro: 'Otro',
}

// Ajustes por omisión. Los números que dependen del mercado llevan su porqué y
// el dueño los cambia en Ajustes; ninguno se presenta como dato oficial.
export const AJUSTES_INICIALES = {
  moneda: 'COP',
  // Contar la mano de obra propia es la diferencia entre saber si la finca da o
  // creer que da. Va encendido; quien quiera verla sin su trabajo la apaga.
  contar_mano_obra: true,
  valor_hora_cop: 10000, // estimado: un jornal rural en Cundinamarca ronda $80.000 por 8 horas; el dueño lo ajusta
  tarifa_kwh_cop: 900, // estimado provisional; se reemplaza con la tarifa de Enel de la investigación
  huevos_por_cubeta: 30,
}

export function nuevoId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID()
  // Respaldo para navegadores viejos: suficiente para una sola finca, no para un servidor.
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

// Estado vacío de una finca. `finca` y `ajustes` son documentos únicos.
export function estadoVacio() {
  const estado = { finca: null, ajustes: { ...AJUSTES_INICIALES } }
  for (const c of COLECCIONES) estado[c] = []
  return estado
}

// Validación mínima: devuelve una lista de problemas en español (vacía = bien).
// No valida todo: valida lo que, si falta, descuadra las cuentas.
export function validarRegistro(r, estado) {
  const p = []
  if (!r.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) p.push('Falta la fecha')
  if (!TIPOS_REGISTRO[r.tipo]) p.push('Tipo de registro desconocido')
  const d = r.datos || {}
  const num = (v) => typeof v === 'number' && Number.isFinite(v)
  if (['produccion', 'alimentacion', 'aplicacion', 'siembra', 'cosecha', 'altas', 'bajas'].includes(r.tipo)) {
    if (!num(d.cantidad) || d.cantidad <= 0) p.push('La cantidad tiene que ser mayor que cero')
  }
  if (['alimentacion', 'aplicacion'].includes(r.tipo)) {
    if (!d.insumoId) p.push('Escoge qué insumo se usó')
    else if (estado && !estado.insumos.some((i) => i.id === d.insumoId)) p.push('Ese insumo no existe en el inventario')
  }
  // Producción y Cosecha tienen su propia «Unidad», y el inventario suma el
  // número tal cual: 500 g guardados en un insumo que se lleva en kg entraban
  // como 500 kg, y 10 bandejas de forraje como 10 kg.
  if (['produccion', 'cosecha'].includes(r.tipo) && d.insumoId && d.unidad && estado) {
    const i = estado.insumos.find((x) => x.id === d.insumoId)
    if (i?.unidad && unidadNormal(d.unidad) !== unidadNormal(i.unidad)) p.push(`«${i.nombre}» se lleva en ${i.unidad}: escribe la cantidad en ${i.unidad}, no en ${d.unidad}`)
  }
  if (r.tipo === 'labor' && (!num(d.horas) || d.horas <= 0)) p.push('Las horas tienen que ser mayores que cero')
  if (r.tipo === 'lluvia' && (!num(d.mm) || d.mm < 0)) p.push('Los milímetros no pueden ser negativos')
  if (r.tipo === 'altas' && d.costo_total != null && (!num(d.costo_total) || d.costo_total < 0)) p.push('El costo no puede ser negativo')
  return p
}
