// Las fotos del escáner: se achican antes de guardarlas y viven en el teléfono
// (lib/almacen.js, documentos aparte). No viajan en el respaldo JSON.
//
// Por qué achicar: una foto del iPhone pesa de 2 a 4 MB, y una panorámica son
// doce. A 1.280 px de lado quedan en unos 200 KB y siguen sirviendo para ver
// la finca en la pantalla del celular.

import { guardarAparte, leerAparte, borrarAparte, clavesAparte } from '../lib/almacen.js'

const clave = (id) => `foto:${id}`

// Dibuja la fuente (un <video>, una imagen o un ImageBitmap) en un lienzo de
// máximo `max` píxeles de lado y devuelve el JPEG.
export function reducir(fuente, ancho, alto, max = 1280, calidad = 0.8) {
  const k = Math.min(1, max / Math.max(ancho, alto))
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.max(1, Math.round(ancho * k))
  lienzo.height = Math.max(1, Math.round(alto * k))
  lienzo.getContext('2d').drawImage(fuente, 0, 0, lienzo.width, lienzo.height)
  return new Promise((ok, mal) => {
    lienzo.toBlob((b) => {
      // Safari cuenta la memoria de todos los lienzos vivos: este ya no se usa.
      lienzo.width = lienzo.height = 1
      b ? ok(b) : mal(new Error('No se pudo guardar la foto'))
    }, 'image/jpeg', calidad)
  })
}

// Una foto escogida o tomada con la cámara del sistema (<input type="file">).
// Se abre con un <img> y no con createImageBitmap: el <img> respeta siempre el
// giro que el teléfono anota en la foto, y una foto vertical no sale acostada.
export async function reducirArchivo(archivo, max = 1280) {
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return await reducir(img, img.naturalWidth, img.naturalHeight, max)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function guardarFoto(id, blob) {
  return guardarAparte(clave(id), { tipo: blob.type || 'image/jpeg', datos: await blob.arrayBuffer() })
}

// Dirección para un <img>. Quien la pide la suelta con URL.revokeObjectURL.
// Devuelve null si la foto no está en este teléfono (por ejemplo, tras recuperar
// un respaldo en otro aparato).
export async function urlFoto(id) {
  const f = await leerAparte(clave(id))
  return f?.datos ? URL.createObjectURL(new Blob([f.datos], { type: f.tipo || 'image/jpeg' })) : null
}

export const borrarFoto = (id) => borrarAparte(clave(id))

export async function borrarTodasLasFotos() {
  for (const k of await clavesAparte('foto:')) await borrarAparte(k)
}

// Los ids de foto de un sitio: la suya y, si es panorámica, las de la vuelta.
export const fotosDeSitio = (s) => [s.foto, ...(s.cuadros || []).map((c) => c.foto)].filter(Boolean)
