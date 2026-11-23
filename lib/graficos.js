// Los gráficos del mapa: cuáles hay, cuál pide el dueño y cuánto pesan sus fotos.
//
// Cuenta pura (probada en Node). Lo que se dibuja con cada uno vive en mapa/.
//
//  · 'clasico'  — el estilo Juguete como salió el 18-nov: el más liviano.
//  · 'nuevo'    — fase B (20-nov): pasto, flores, tierra pelada y sombras nítidas.
//  · 'realista' — los nuevos más fotos: pasto, cielo, tejas y árboles horneados
//                 (mapa/realista.js). Necesita bajar las fotos; si no llegan, el
//                 mapa se dibuja con los nuevos.

// En el orden en que se ofrecen en Ajustes.
export const GRAFICOS = ['realista', 'nuevo', 'clasico']

// Lo que ve quien nunca ha escogido en Ajustes. Lo decide Joan después de ver
// el antes y el después (pruebas/capturas/realista-*.jpg); mientras tanto se
// queda en lo que ya está publicado.
export const GRAFICOS_POR_DEFECTO = 'nuevo'

// De lo guardado en Ajustes (que puede faltar, o venir de una versión vieja) a
// uno de los tres. Nunca devuelve otra cosa: el mapa no tiene que adivinar.
export function graficosDelMapa(ajuste) {
  return GRAFICOS.includes(ajuste) ? ajuste : GRAFICOS_POR_DEFECTO
}

// De cuántos puntos de lado se suben a la tarjeta gráfica los árboles
// horneados (vienen de 1024). En un celular, a la mitad: los siete árboles son
// casi dos tercios de la memoria de todas las fotos (37 de 61 MB) y en una
// pantalla de 390 puntos de ancho un árbol casi nunca mide más de 250, así que
// la mitad que se bota no se alcanza a ver. Son 28 MB menos en el aparato que
// menos memoria tiene. Una tableta o un computador los suben enteros.
export function ladoDeArbol(anchoPantalla, altoPantalla) {
  return Math.min(anchoPantalla, altoPantalla) < 600 ? 512 : 1024
}

// Cuánta memoria gráfica ocupan unas texturas ya subidas a la tarjeta, en
// bytes: 4 por punto, y un tercio más por las copias reducidas (mipmaps) que
// evitan que la foto titile de lejos. El .webp pesa veinte veces menos en el
// disco, pero la tarjeta la guarda sin comprimir: este es el número que le
// importa a un iPhone, no el de la descarga. `ladoArbol`: ver `ladoDeArbol`.
export function memoriaDeTexturas(indice, claves = Object.keys(indice), ladoArbol = Infinity) {
  let bytes = 0
  for (const clave of claves) {
    const d = indice[clave]
    if (!d) continue
    const escala = d.arbol ? Math.min(1, ladoArbol / Math.max(d.px[0], d.px[1])) : 1
    bytes += (d.px[0] * escala * d.px[1] * escala * 4 * 4) / 3
  }
  return Math.round(bytes)
}
