// Los gráficos del mapa: cuáles hay, cuál pide el dueño y cuánto pesan sus fotos.
//
// Cuenta pura (probada en Node). Lo que se dibuja con cada uno vive en mapa/.
//
//  · 'clasico'  — el estilo Juguete como salió el 18-nov: el más liviano.
//  · 'nuevo'    — fase B (20-nov): pasto, flores, tierra pelada y sombras nítidas.
//  · 'realista' — imágenes hechas con IA: suelos, cielo, árboles, huerta, casa,
//                 gallinero y animales (mapa/realista.js y mapa/modelos3d.js).
//                 Necesita bajarlas; si no llegan, el mapa se dibuja con los nuevos.

// En el orden en que se ofrecen en Ajustes.
export const GRAFICOS = ['realista', 'nuevo', 'clasico']

// Lo que ve quien nunca ha escogido en Ajustes. Desde el 24-nov-2026, los
// realistas: Joan abrió la finca, no los vio («aún no veo la finca con gráficos
// realistas») y con razón, porque estaban escondidos detrás de un ajuste. Lo
// que hay que ir a buscar para verlo, no existe. Si las imágenes no llegan, el
// mapa se dibuja con los nuevos y lo avisa; y «De antes» sigue en Ajustes para
// un teléfono al que le pese.
export const GRAFICOS_POR_DEFECTO = 'realista'

// De lo guardado en Ajustes (que puede faltar, o venir de una versión vieja) a
// uno de los tres. Nunca devuelve otra cosa: el mapa no tiene que adivinar.
//
// `elegido`: si ese valor se guardó desde que los realistas son lo normal
// (ajustes.graficos_elegidos). Hasta el 24-nov, guardar CUALQUIER ajuste (el
// nombre de la finca, el valor de la hora) dejaba escrito «nuevo» aunque nadie
// lo hubiera escogido; ese «nuevo» viejo no cuenta como elección, o quien
// guardó algo alguna vez no vería nunca los realistas. «De antes» y
// «realista» sí se respetan: esos solo quedaban escritos escogiéndolos.
export function graficosDelMapa(ajuste, elegido = true) {
  if (ajuste === 'nuevo' && !elegido) return GRAFICOS_POR_DEFECTO
  return GRAFICOS.includes(ajuste) ? ajuste : GRAFICOS_POR_DEFECTO
}

// De cuántos puntos de lado, como mucho, se suben a la tarjeta gráfica los
// suelos y los recortes (árboles, matas). En un celular, 512: en una pantalla de
// 390 puntos de ancho un árbol casi nunca mide más de 250, así que lo que se
// bota no se alcanza a ver, y son 25 MB menos en el aparato que menos memoria
// tiene. Una tableta o un computador los suben enteros.
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
    const escala = d.recorte || d.aereo ? Math.min(1, ladoArbol / Math.max(d.px[0], d.px[1])) : 1
    bytes += (d.px[0] * escala * d.px[1] * escala * 4 * 4) / 3
  }
  return Math.round(bytes)
}
