// Que las imágenes del mapa queden en el teléfono desde la PRIMERA visita.
//
// En la primera visita el mapa pide sus imágenes mientras el trabajador de fondo
// (sw.js) todavía se está instalando: esas descargas no pasan por él y no las
// guarda. El 24-nov-2026 se midió: quedaban 8 de 41, y al otro día en la finca,
// sin señal, el mapa salía con los gráficos de repuesto aunque Ajustes promete
// que quedan guardadas. Lo mismo le pasa a quien ya tenía la app cuando cambian
// las imágenes: las baja con el trabajador viejo, y el nuevo estrena caja vacía.
//
// Por eso la página le AVISA al trabajador que el mapa usa las imágenes, y él
// revisa su lista y baja solo las que le falten. Se le avisa al que esté ahora y
// a cada uno que tome el mando después. Avisar de más no cuesta: si ya las tiene
// todas, no toca la red.

let atento = false

export function guardarImagenes(sw = globalThis.navigator?.serviceWorker) {
  if (!sw) return
  const pedir = () => sw.controller?.postMessage({ tipo: 'guardar-imagenes' })
  if (!atento) {
    // Una sola vez en la vida de la página: el mapa se abre y se cierra muchas.
    atento = true
    sw.addEventListener('controllerchange', pedir)
  }
  pedir()
}
