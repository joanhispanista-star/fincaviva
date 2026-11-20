// El relieve de la finca de verdad, bajado por el celular y guardado en él.
//
// Se baja UNA vez (unos 10 mosaicos, 1 a 2 MB) cuando el dueño toca «Estoy en la
// finca» con señal, y desde ahí el mapa abre sin internet. La cuenta está en
// lib/relieve-descarga.js; aquí solo se piden los mosaicos y se guardan.
//
// Lo que sale del teléfono: la petición de cada mosaico le dice al servidor
// (AWS) qué cuadro de unos 2,4 km se pidió. No viaja el punto exacto ni ningún
// dato de la finca. La pantalla de Escanear lo avisa antes de bajar.

import { hornear, relievePlano, aMetrosDeAltura, CAPAS_RELIEVE, FUENTE_RELIEVE } from '../lib/relieve-descarga.js'
import { guardarAparte, leerAparte, borrarAparte } from '../lib/almacen.js'

const CLAVE = 'relieve'

// Un mosaico PNG → sus píxeles. Se pide sin conversión de color: la altura va
// escrita en el rojo, el verde y el azul, y un «arreglo» de color del navegador
// la dañaría (por eso hornear() revisa que las alturas tengan sentido).
async function traerMosaico(z, x, y) {
  const url = FUENTE_RELIEVE.plantilla.replace('{z}', z).replace('{x}', x).replace('{y}', y)
  const r = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!r.ok) throw new Error(`El servidor del relieve respondió ${r.status}`)
  const blob = await r.blob()
  let img
  try {
    img = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  } catch {
    img = await createImageBitmap(blob) // Safari viejo no acepta opciones
  }
  const lienzo = document.createElement('canvas')
  lienzo.width = img.width
  lienzo.height = img.height
  const g = lienzo.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0)
  const px = g.getImageData(0, 0, img.width, img.height).data
  const ancho = img.width, alto = img.height
  img.close?.()
  // Safari cuenta la memoria de todos los lienzos vivos: este ya no se usa.
  lienzo.width = lienzo.height = 1
  return { ancho, alto, canales: 4, px }
}

// Baja y guarda el relieve alrededor de un punto. `alAvanzar(hechos, total)`
// es para la barra de progreso. Devuelve los metadatos de lo guardado.
export async function bajarRelieve(lat, lon, alAvanzar = () => {}) {
  const capas = {}
  let hechos = 0
  const total = Object.keys(CAPAS_RELIEVE).length
  for (const [nombre, capa] of Object.entries(CAPAS_RELIEVE)) {
    const { meta, dm } = await hornear({ lat, lon, ...capa, traer: traerMosaico, nombre })
    capas[nombre] = { meta, dm: dm.buffer }
    alAvanzar(++hechos, total)
  }
  const guardado = await guardarAparte(CLAVE, capas)
  return { guardado, cerca: capas.cerca.meta, paisaje: capas.paisaje.meta }
}

// Lo que necesita crearMundo: { cerca: { meta, alturas }, paisaje: { meta, alturas } }.
// Si no hay relieve bajado para ese origen, una mesa plana a la altura del GPS.
export async function relieveDeLaFinca(origen) {
  const g = await leerAparte(CLAVE)
  const sirve = g?.cerca?.meta && Math.abs(g.cerca.meta.lat - origen.lat) < 1e-6 && Math.abs(g.cerca.meta.lon - origen.lon) < 1e-6
  if (sirve) {
    return {
      plano: false,
      cerca: { meta: g.cerca.meta, alturas: aMetrosDeAltura(new Uint16Array(g.cerca.dm)) },
      paisaje: { meta: g.paisaje.meta, alturas: aMetrosDeAltura(new Uint16Array(g.paisaje.dm)) },
    }
  }
  const capa = (c, nombre) => { const p = relievePlano(origen.alt ?? 2600, c, nombre); return { meta: { ...p.meta, lat: origen.lat, lon: origen.lon }, alturas: aMetrosDeAltura(p.dm) } }
  return { plano: true, cerca: capa(CAPAS_RELIEVE.cerca, 'plano'), paisaje: capa(CAPAS_RELIEVE.paisaje, 'plano-paisaje') }
}

export const borrarRelieve = () => borrarAparte(CLAVE)
