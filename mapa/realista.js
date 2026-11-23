// Gráficos «realistas» del estilo Juguete: lo que se dibuja con fotos y con
// árboles horneados en vez de colores planos.
//
// De dónde sale cada imagen (todo CC0, dominio público) lo dice
// mapa/texturas/texturas.json, que arma herramientas/texturas.py. Aquí solo se
// cargan y se vuelven materiales y geometrías.
//
// Tres ideas sostienen todo:
//  · La foto pone el detalle y el color del mapa pone el tono. Cada textura se
//    multiplica por un color «neutro» que la deja blanca en promedio; así el
//    verde de cada potrero o el blanco de la pared siguen mandando.
//  · Un árbol son tres láminas con la imagen de un árbol de verdad (dos de lado,
//    cruzadas, y una acostada en la copa). Diez triángulos en vez de cien: el
//    bosque entero pesa menos que antes y se ve como bosque.
//  · Las láminas llevan la normal hacia arriba: reciben la luz como el suelo
//    donde están paradas. Con su normal de verdad, media lámina sale negra.

import * as THREE from '../vendor/three/three.module.js'

// Las fotos que el mapa usa de verdad. El índice trae tres más que quedaron
// horneadas y sin uso (el relieve del pasto `pasto_n`, la corteza y la
// celidonia): no se bajan ni ocupan memoria en el teléfono. Si algún día se
// usan, se agregan aquí; pruebas/realista.test.js vigila que cada clave exista.
export const EN_USO = [
  'cielo', 'pasto', 'tierra', 'camino',
  'teja', 'pared', 'madera', 'zinc', 'paja', 'concreto',
  'aliso', 'roble', 'encenillo', 'sietecueros', 'pino', 'arbusto', 'frutal',
  'mata', 'mata_alta', 'helecho', 'flor_amarilla', 'trebol',
  'hortaliza', 'hortaliza_arriba', 'ortiga',
]

// Cambia la foto de una textura por una copia más pequeña (de `lado` puntos en
// su lado mayor) antes de que suba a la tarjeta gráfica: lo que ocupa memoria
// allá son los puntos, no lo que pesa el archivo. Las cuatro vistas del árbol
// siguen en los mismos sitios de la imagen.
function achicar(t, lado) {
  const foto = t.image
  const k = lado / Math.max(foto.width, foto.height)
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(foto.width * k)
  lienzo.height = Math.round(foto.height * k)
  const g = lienzo.getContext('2d')
  g.imageSmoothingQuality = 'high'
  g.drawImage(foto, 0, 0, lienzo.width, lienzo.height)
  t.image = lienzo
}

// Carga el índice y las fotos de `claves`. Si algo falla devuelve null y el
// mapa sigue con los gráficos nuevos: en la montaña puede no haber señal.
//
// `espera` (ms) es la paciencia: con señal lenta, 3 MB tardan más de lo que
// alguien aguanta mirando un mapa en blanco. Pasado ese tiempo también se
// devuelve null, pero la descarga SIGUE por detrás y queda guardada (ver
// sw.js): la próxima vez que se abra el mapa, las fotos ya están.
//
// `ladoArbol`: de cuántos puntos de lado se suben los árboles a la tarjeta
// gráfica (lib/graficos.js → `ladoDeArbol`: en un celular, a la mitad).
export async function cargarTexturas(base, renderer, { claves = EN_USO, espera = 7000, ladoArbol = 1024 } = {}) {
  let reloj = null
  try {
    const carga = (async () => {
      const respuesta = await fetch(`${base}mapa/texturas/texturas.json`)
      if (!respuesta.ok) throw new Error(`el índice de fotos respondió ${respuesta.status}`)
      const todas = (await respuesta.json()).texturas
      // Solo lo que se pidió: `indice` nunca nombra una foto que no esté cargada.
      const indice = Object.fromEntries(claves.map((clave) => {
        if (!todas[clave]) throw new Error(`falta la foto «${clave}» en el índice`)
        return [clave, todas[clave]]
      }))
      const cargador = new THREE.TextureLoader()
      const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      const tex = {}
      await Promise.all(Object.entries(indice).map(async ([clave, d]) => {
        const t = await cargador.loadAsync(`${base}mapa/texturas/${d.archivo}`)
        // Los mapas de normales (…_n) son números, no colores: no se les aplica la curva sRGB.
        if (!clave.endsWith('_n')) t.colorSpace = THREE.SRGBColorSpace
        if (d.repetible) {
          t.wrapS = t.wrapT = THREE.RepeatWrapping
          t.anisotropy = anisotropia
        }
        // Las recortadas (árboles, matas) suben con el color ya multiplicado
        // por su transparencia: ver `materialDeLamina`.
        if (d.transparente) t.premultiplyAlpha = true
        if (d.arbol && Math.max(t.image.width, t.image.height) > ladoArbol) achicar(t, ladoArbol)
        tex[clave] = t
      }))
      const promedio = (clave) => new THREE.Color(indice[clave].promedio)
      return {
        indice, tex, promedio,
        // El color que deja la textura blanca en promedio (por `k`, para aclarar u oscurecer).
        neutro(clave, k = 1) {
          const c = promedio(clave)
          return new THREE.Color(k / Math.max(c.r, 0.02), k / Math.max(c.g, 0.02), k / Math.max(c.b, 0.02))
        },
        // El color que lleva una lámina (mata, flor) al tono `meta`.
        hacia(clave, meta, k = 1) {
          const c = promedio(clave)
          return new THREE.Color((meta.r * k) / Math.max(c.r, 0.02), (meta.g * k) / Math.max(c.g, 0.02), (meta.b * k) / Math.max(c.b, 0.02))
        },
        // Devuelve la memoria gráfica: hay que llamarlo ANTES de soltar el renderer.
        soltar() { for (const t of Object.values(tex)) t.dispose() },
      }
    })()
    // Si la paciencia se acaba primero, la carga sigue sola: que un fallo
    // tardío no salga en la consola como un error que nadie atrapó.
    carga.catch(() => {})
    const T = await Promise.race([carga, new Promise((listo) => { reloj = setTimeout(() => listo(null), espera) })])
    if (!T) console.warn(`Las fotos del mapa no llegaron en ${espera / 1000} s: se dibuja sin ellas y se siguen bajando.`)
    return T
  } catch (e) {
    console.warn('Sin fotos para el mapa:', e.message)
    return null
  } finally {
    clearTimeout(reloj)
  }
}

// El cielo: media esfera con el panorama, girada para que su sol quede donde
// alumbra el sol del mapa, y una faja del color del horizonte por debajo.
export function crearCielo(T, solVector) {
  const d = T.indice.cielo
  const sinTonos = { side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }
  const grupo = new THREE.Group()
  const boveda = new THREE.Mesh(new THREE.SphereGeometry(30000, 48, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: T.tex.cielo, ...sinTonos }))
  // En la esfera, la columna u del panorama mira hacia (−cos 2πu, sen 2πu) en (x, z).
  boveda.rotation.y = Math.PI - d.sol_u * Math.PI * 2 - Math.atan2(solVector.z, solVector.x)
  const faja = new THREE.Mesh(new THREE.SphereGeometry(30000, 24, 4, 0, Math.PI * 2, Math.PI / 2, 0.6), new THREE.MeshBasicMaterial({ color: d.horizonte, ...sinTonos }))
  // Bruma: los últimos grados de cielo se van fundiendo en el color del
  // horizonte, que es también el de la niebla. Sin ella la foto termina en una
  // raya y debajo queda una franja lisa: la costura se ve desde toda la finca.
  const ALTO = 0.3 // radianes de cielo que cubre (unos 17°)
  const anillo = new THREE.SphereGeometry(29000, 48, 6, 0, Math.PI * 2, Math.PI / 2 - ALTO, ALTO)
  const tono = new THREE.Color(d.horizonte), velo = []
  const p = anillo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const sube = Math.asin(THREE.MathUtils.clamp(p.getY(i) / 29000, 0, 1)) / ALTO // 0 en el horizonte, 1 arriba
    velo.push(tono.r, tono.g, tono.b, Math.pow(1 - sube, 1.6))
  }
  anillo.setAttribute('color', new THREE.Float32BufferAttribute(velo, 4))
  const bruma = new THREE.Mesh(anillo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, ...sinTonos }))
  // Antes que todo lo demás que es transparente (lo que es «plan», la tierra
  // pelada): three.js las ordena por su centro, y el de la bruma está en la
  // finca; sin esto se pintaría encima de ellas.
  bruma.renderOrder = -1
  grupo.add(boveda, faja, bruma)
  return grupo
}

// ---------- Láminas ----------

// El material de una lámina recortada (árbol, mata): lo transparente no se
// dibuja (`corte`), y sin mezclas, que en un teléfono cuestan y se ordenan mal.
//
// La trampa que esto resuelve: de lejos la tarjeta gráfica usa copias reducidas
// de la foto, y al reducirla promedia cada hoja con el vacío de alrededor, que
// en el archivo es negro. Los árboles del monte salían con la copa casi negra:
// se veían solo los troncos, como árboles secos. Con el color multiplicado por
// la transparencia al subir la foto (`premultiplyAlpha`), el promedio pesa cada
// punto por lo que tiene de hoja; aquí se divide de vuelta y la hoja conserva
// su verde a cualquier distancia.
function materialDeLamina(T, clave, corte, color) {
  // `vertexColors`: la luz de cada punta de la lámina (ver `laminas`).
  const material = new THREE.MeshLambertMaterial({ map: T.tex[clave], alphaTest: corte, color, vertexColors: true })
  material.onBeforeCompile = (programa) => {
    programa.fragmentShader = programa.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb /= max( diffuseColor.a, 0.02 );')
  }
  return material
}

// Arma una geometría de láminas. Cada lámina: cuatro esquinas [x, y, z] en
// orden (abajo-izq, abajo-der, arriba-der, arriba-izq), su caja de textura
// [u0, v0, u1, v1] y si se ve por las dos caras.
//
// `luz` = [abajo, arriba]: cuánta luz recibe la lámina en el pie y en la punta
// (va al color de los vértices). Una lámina no tiene caras a la sombra: toda
// recibe la misma luz y, vista desde arriba, un árbol se confundía con el
// suelo del monte, verde sobre verde. Oscura abajo y clara arriba vuelve a
// tener volumen, igual que el sombreado por altura de mapa/modelos.js.
function laminas(lista) {
  const pos = [], uv = [], col = []
  for (const { e, caja: [u0, v0, u1, v1], dosCaras = true, luz = [1, 1] } of lista) {
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
    const luces = [luz[0], luz[0], luz[1], luz[1]]
    const caras = dosCaras ? [[0, 1, 2, 0, 2, 3], [0, 2, 1, 0, 3, 2]] : [[0, 1, 2, 0, 2, 3]]
    for (const orden of caras)
      for (const i of orden) {
        pos.push(...e[i])
        uv.push(...uvs[i])
        col.push(luces[i], luces[i], luces[i])
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
  return g
}

// Lámina parada de alto 1, girada `giro` sobre su eje, con el tronco en el origen.
function parada(c, alto, giro, caja, luz) {
  const w = c.ancho_m / alto, h = c.alto_m / alto
  const x0 = -c.eje_u * w, x1 = (1 - c.eje_u) * w
  const p = (x, y) => [x * Math.cos(giro), y, -x * Math.sin(giro)]
  return { e: [p(x0, 0), p(x1, 0), p(x1, h), p(x0, h)], caja, luz }
}

// Un pelo hacia adentro de cada pedazo: si no, al reducirse la imagen se cuela el vecino.
const adentro = ([u0, v0, u1, v1], m = 0.006) => [u0 + m, v0 + m, u1 - m, v1 - m]

// Árbol de alto 1: dos láminas cruzadas y una acostada a la altura de la copa.
// `copa`: a qué fracción del alto va la lámina de arriba (un pino la lleva baja).
export function geomArbol(d, copa = 0.62) {
  const c = d.celdas
  const alto = c.lado0.alto_m
  const w = c.arriba.ancho_m / alto / 2, f = c.arriba.alto_m / alto / 2
  // El pie a media luz y la copa a plena luz; la lámina de arriba, la que más
  // recibe, es la que se ve desde la cámara del mapa.
  const luz = [0.42, 1.06]
  return laminas([
    parada(c.lado0, alto, 0, adentro(c.lado0.uv), luz),
    parada(c.lado90, alto, Math.PI / 2, adentro(c.lado90.uv), luz),
    { e: [[-w, copa, f], [w, copa, f], [w, copa, -f], [-w, copa, -f]], caja: adentro(c.arriba.uv), dosCaras: false, luz: [1.14, 1.14] },
  ])
}

// Mata, flor u hortaliza de alto 1: dos láminas cruzadas con la misma imagen.
export function geomMata(d) {
  const caja = [0.01, 0.01, 0.99, 0.99]
  const luz = [0.62, 1.08] // el pie de la mata, a la sombra de sus propias hojas
  return laminas([parada(d, d.alto_m, 0, caja, luz), parada(d, d.alto_m, Math.PI / 2, caja, luz)])
}

// Lámina acostada de ancho 1, centrada: una hortaliza vista desde arriba (las
// imágenes con `vista: 'arriba'`). Desde la cámara del mapa, que mira de
// arriba, una lechuga es su roseta; de lado casi no se ve. Una sola cara: por
// debajo solo hay tierra.
export function geomAcostada(d) {
  const f = d.alto_m / d.ancho_m / 2
  return laminas([{ e: [[-0.5, 0, f], [0.5, 0, f], [0.5, 0, -f], [-0.5, 0, -f]], caja: [0.01, 0.01, 0.99, 0.99], dosCaras: false }])
}

// Qué imagen lleva cada árbol del mapa, cuánto mide de alto (m) y sus ajustes.
// El eucalipto no tiene modelo libre: es el aliso estirado y azulado. El
// arrayán es el arbusto. Están dichos aquí para que nadie crea que son fotos
// de esas especies.
//
// `tono` es el verde de la especie, el mismo con que la pintan los gráficos
// nuevos (mapa/modelos.js): la foto pone las hojas y el tono pone el color. Las
// hojas horneadas son de un oliva apagado, casi café; sin teñir, el monte visto
// de lejos parecía seco. `fuerza` (0 a 1) es cuánto se tiñe: baja donde hay
// flores o frutas pintadas, para que no se vuelvan verdes también. El
// eucalipto lleva un tono más oscuro que el de los gráficos nuevos: con el
// suyo (un gris azulado claro) la foto salía lavada, como un árbol fantasma.
export const ESPECIES = {
  aliso: { imagen: 'aliso', alto: 10, tono: '#56923f' },
  roble: { imagen: 'roble', alto: 9, tono: '#4f8538' },
  encenillo: { imagen: 'encenillo', alto: 7, tono: '#3f6f34' },
  sietecueros: { imagen: 'sietecueros', alto: 5.5, tono: '#4c7b3a', fuerza: 0.45 },
  arrayan: { imagen: 'arbusto', alto: 4.2, tono: '#3d7031' },
  eucalipto: { imagen: 'aliso', alto: 17, ancho: 0.62, tono: '#5c8872' },
  pino: { imagen: 'pino', alto: 11, copa: 0.3, tono: '#325e35' },
  frutal: { imagen: 'frutal', alto: 3.4, tono: '#5a9640', fuerza: 0.7 },
}

// Qué foto hace de cada cultivo de la huerta, de qué tamaño (m) y de qué tono.
// Ninguna es la foto de ese cultivo: la mata horneada es una maleza de hoja
// ancha (weed_plant_02) y hace de lechuga y de repollo; el maíz es el pasto
// alto agrandado y la arveja, la ortiga. Son dibujo, como las bolitas de los
// gráficos nuevos, y están dichos aquí para que nadie crea otra cosa. Las de
// hoja llevan dos capas: la roseta vista desde arriba (lo que ve la cámara del
// mapa) y dos láminas paradas que le dan cuerpo cuando se mira de lado.
export const CULTIVOS = {
  hoja: [{ imagen: 'hortaliza_arriba', acostada: true, alto: 0.36, sube: 0.05, tono: '#6cbf4a' }, { imagen: 'hortaliza', alto: 0.13, tono: '#5fae40' }],
  repollo: [{ imagen: 'hortaliza_arriba', acostada: true, alto: 0.46, sube: 0.07, tono: '#a6d86a' }, { imagen: 'hortaliza', alto: 0.17, tono: '#93cf7a' }],
  maiz: [{ imagen: 'mata_alta', alto: 1.5, tono: '#6cbf4a' }],
  arveja: [{ imagen: 'ortiga', alto: 1.0, tono: '#3f7f35' }],
}

// Siembra la huerta. `porCultivo`: { hoja: [[x, y, z, azar, giro], …], maiz: … },
// un dato por mata, con `azar` de 0 a 1 para que no salgan todas del mismo
// tamaño. Un cultivo que no esté en CULTIVOS se dibuja como hoja. Devuelve las
// mallas: una por capa y cultivo, no una por mata.
export function huerta(T, porCultivo) {
  const mallas = []
  for (const [cultivo, lista] of Object.entries(porCultivo))
    for (const capa of CULTIVOS[cultivo] || CULTIVOS.hoja) {
      const im = matas(T, capa.imagen, lista.map(([x, y, z, azar, giro]) => [x, y + (capa.sube || 0), z, capa.alto * (0.85 + azar * 0.3), giro]), T.hacia(capa.imagen, new THREE.Color(capa.tono)), { acostada: !!capa.acostada, variar: 0.25 })
      // Solo lo alto da sombra: la de una lechuga no se alcanza a ver.
      im.castShadow = capa.alto > 0.5
      mallas.push(im)
    }
  return mallas
}

// Siembra árboles de una especie. `lista`: [x, y, z, escala, giro] por árbol.
// `brillo` es cuánto se aclara la foto en lo que no se tiñe (ver `fuerza`).
export function arbolado(T, especie, lista, { sombra = true, brillo = 1.55 } = {}) {
  const esp = ESPECIES[especie] || ESPECIES.roble
  const d = T.indice[esp.imagen]
  // No se tiñe del todo (0,8) ni hasta el tono entero (0,82): una lámina
  // recibe la luz pareja, sin caras a la sombra, y teñida a fondo se ve
  // pintada y más clara que los árboles de los gráficos nuevos.
  const color = new THREE.Color(brillo, brillo, brillo).lerp(T.hacia(esp.imagen, new THREE.Color(esp.tono), 0.82), esp.fuerza ?? 0.8)
  const material = materialDeLamina(T, esp.imagen, 0.3, color)
  const im = new THREE.InstancedMesh(geomArbol(d, esp.copa), material, lista.length)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(), tinte = new THREE.Color()
  lista.forEach(([x, y, z, escala, giro], i) => {
    const alto = esp.alto * escala
    q.setFromAxisAngle(eje, giro)
    m4.compose(p.set(x, y, z), q, s.set(alto * (esp.ancho || 1), alto, alto * (esp.ancho || 1)))
    im.setMatrixAt(i, m4)
    // Ningún bosque tiene todos los árboles del mismo verde.
    const k = 0.84 + ((i * 7919) % 100) / 100 * 0.3
    im.setColorAt(i, tinte.setRGB(k, 0.9 + ((i * 104729) % 100) / 100 * 0.18, k))
  })
  im.castShadow = sombra
  // Las láminas no reciben sombra: la de una caería sobre la otra en rayas.
  im.receiveShadow = false
  return im
}

// Siembra láminas sueltas (matas, flores, hortalizas). `lista`: [x, y, z, alto, giro].
// Con `acostada`, la lámina va tendida y `alto` es su ancho en metros.
// `variar` (0 a 1) reparte el brillo entre una y otra: sembradas todas del
// mismo tono se ven como un estampado.
export function matas(T, clave, lista, color, { acostada = false, variar = 0 } = {}) {
  const material = materialDeLamina(T, clave, 0.35, color)
  const im = new THREE.InstancedMesh(acostada ? geomAcostada(T.indice[clave]) : geomMata(T.indice[clave]), material, lista.length)
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eje = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(), tinte = new THREE.Color()
  lista.forEach(([x, y, z, alto, giro], i) => {
    q.setFromAxisAngle(eje, giro)
    m4.compose(p.set(x, y, z), q, s.setScalar(alto))
    im.setMatrixAt(i, m4)
    if (variar) im.setColorAt(i, tinte.setScalar(1 - variar / 2 + (((i * 7919) % 100) / 100) * variar))
  })
  im.receiveShadow = true
  return im
}
