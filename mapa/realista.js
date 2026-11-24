// Gráficos «realistas» del estilo Juguete: lo que se dibuja con imágenes hechas
// con IA (suelos, cielo, árboles, huerta y matas), con modelos 3D sacados de
// imágenes (mapa/modelos3d.js) y con unas pocas fotos de dominio público.
//
// De dónde sale cada imagen lo dice mapa/texturas/texturas.json: las ia_* las
// arma herramientas/imagenes_ia.py; las demás (CC0), herramientas/texturas.py.
// Aquí solo se cargan y se vuelven materiales y geometrías.
//
// Cuatro ideas sostienen todo:
//  · El suelo son cinco fotos desde el aire (potrero, pasto de cerca, monte,
//    pasto seco y cultivo) mezcladas según qué es cada pedazo, con el borde
//    roto por ruido. Antes cada pedazo era de un color y terminaba en escalera.
//  · Un árbol es UNA lámina que siempre mira a la cámara, con la imagen de un
//    árbol visto desde un dron. Dos láminas cruzadas, vistas desde arriba como
//    se mira el mapa, se notaban como una X, y la acostada como un disco.
//  · Las láminas llevan la normal hacia arriba: reciben la luz como el suelo
//    donde están paradas. Con su normal de verdad, media lámina sale negra.
//  · En lo que sigue siendo de dominio público (pared, madera, zinc…) la foto
//    pone el detalle y el color del mapa pone el tono: se multiplica por un
//    color «neutro» que la deja blanca en promedio.

import * as THREE from '../vendor/three/three.module.js'
import { cargarModelo } from './modelos3d.js'

export { manada, bandada } from './modelos3d.js'

// Las imágenes que el mapa usa de verdad. El índice trae además las CC0 que las
// de IA reemplazaron (árboles horneados, pasto y cielo): siguen en la carpeta
// por si hay que devolverse, pero no se bajan ni se publican.
// pruebas/realista.test.js vigila que cada clave exista.
export const EN_USO = [
  'ia_cielo', 'ia_pasto', 'ia_potrero', 'ia_monte', 'ia_seco', 'ia_arado',
  'ia_aliso', 'ia_roble', 'ia_encenillo', 'ia_sietecueros', 'ia_arrayan', 'ia_eucalipto', 'ia_pino', 'ia_frutal',
  'ia_lechuga', 'ia_repollo', 'ia_maiz', 'ia_arveja',
  'ia_kikuyo', 'ia_pasto_alto', 'ia_helecho', 'ia_diente_leon', 'ia_trebol', 'ia_lupino',
  'tierra', 'camino', 'pared', 'madera', 'zinc', 'paja', 'concreto',
]
export const MODELOS_EN_USO = ['vaca', 'gallina', 'casa', 'galpon']

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
// `ladoArbol`: de cuántos puntos de lado se suben los recortes y los suelos a la
// tarjeta gráfica (lib/graficos.js → `ladoDeArbol`: en un celular, a 512).
export async function cargarTexturas(base, renderer, { claves = EN_USO, modelos = MODELOS_EN_USO, espera = 7000, ladoArbol = 1024 } = {}) {
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
        if ((d.recorte || d.aereo) && Math.max(t.image.width, t.image.height) > ladoArbol) achicar(t, ladoArbol)
        tex[clave] = t
      }))
      const m3d = {}
      if (modelos.length) {
        const r = await fetch(`${base}mapa/modelos3d/modelos3d.json`)
        if (!r.ok) throw new Error(`el índice de modelos respondió ${r.status}`)
        const lista = await r.json()
        await Promise.all(modelos.map(async (nombre) => {
          if (!lista[nombre]) throw new Error(`falta el modelo «${nombre}»`)
          m3d[nombre] = await cargarModelo(base, nombre, lista[nombre], renderer)
        }))
      }
      const promedio = (clave) => new THREE.Color(indice[clave].promedio)
      return {
        indice, tex, promedio, modelos: m3d,
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
        soltar() {
          for (const t of Object.values(tex)) t.dispose()
          for (const m of Object.values(m3d)) m.soltar()
        },
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
  const d = T.indice.ia_cielo
  const sinTonos = { side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }
  const grupo = new THREE.Group()
  // La imagen trae abajo una franja de calina sin nubes. En la pantalla de un
  // celular, mirando la finca, del cielo solo se ve esa franja: se corre hacia
  // abajo para que asomen las nubes.
  const CALINA = 0.17
  const cupula = new THREE.SphereGeometry(30000, 48, 14, 0, Math.PI * 2, 0, Math.PI / 2)
  const uvC = cupula.attributes.uv
  for (let i = 0; i < uvC.count; i++) uvC.setY(i, CALINA + (1 - CALINA) * uvC.getY(i))
  const boveda = new THREE.Mesh(cupula, new THREE.MeshBasicMaterial({ map: T.tex.ia_cielo, ...sinTonos }))
  // En la esfera, la columna u del panorama mira hacia (−cos 2πu, sen 2πu) en (x, z).
  boveda.rotation.y = Math.PI - d.sol_u * Math.PI * 2 - Math.atan2(solVector.z, solVector.x)
  const faja = new THREE.Mesh(new THREE.SphereGeometry(30000, 24, 4, 0, Math.PI * 2, Math.PI / 2, 0.6), new THREE.MeshBasicMaterial({ color: d.horizonte, ...sinTonos }))
  // Bruma: los últimos grados de cielo se van fundiendo en el color del
  // horizonte, que es también el de la niebla. Sin ella la foto termina en una
  // raya y debajo queda una franja lisa: la costura se ve desde toda la finca.
  const ALTO = 0.15 // radianes de cielo que cubre (unos 9°)
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

// ---------- El suelo ----------

// Ruido suave en la tarjeta gráfica: rompe el borde entre un potrero y otro.
const RUIDO_GLSL = `
float azarS(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float ruidoS(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(azarS(i), azarS(i + vec2(1., 0.)), f.x), mix(azarS(i + vec2(0., 1.)), azarS(i + vec2(1., 1.)), f.x), f.y);
}
`

// El material del relieve. Cada vértice trae `clase` (cuánto hay ahí de pasto,
// monte, pasto seco y cultivo) y `color`, que aquí no es el color del suelo sino
// un tinte alrededor del blanco (ver `tinteSuelo` en mapa/mundo.js).
//
// Lo que evita que se note la repetición de una foto de 60 m sobre una ladera de
// un kilómetro: la misma foto otra vez, girada y cuatro veces más grande, manda
// manchas claras y oscuras que no empatan con la primera.
const SUELOS = { tPasto: 'ia_pasto', tPotrero: 'ia_potrero', tMonte: 'ia_monte', tSeco: 'ia_seco', tArado: 'ia_arado' }
export function materialSuelo(T) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true })
  const inversa = (clave) => {
    const c = T.promedio(clave)
    return new THREE.Vector3(1 / c.r, 1 / c.g, 1 / c.b)
  }
  material.onBeforeCompile = (programa) => {
    for (const [nombre, clave] of Object.entries(SUELOS)) {
      programa.uniforms[nombre] = { value: T.tex[clave] }
      programa.uniforms['m' + nombre.slice(1)] = { value: T.indice[clave].metros }
    }
    programa.uniforms.iPasto = { value: inversa('ia_pasto') }
    programa.uniforms.iPotrero = { value: inversa('ia_potrero') }
    const declaraciones = Object.keys(SUELOS).map((n) => `uniform sampler2D ${n};\nuniform float m${n.slice(1)};`).join('\n')
    programa.vertexShader = `attribute vec4 clase;\nvarying vec4 vClase;\nvarying vec3 vSuelo;\n${programa.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvClase = clase;\n\tvSuelo = ( modelMatrix * vec4( position, 1.0 ) ).xyz;')
    programa.fragmentShader = `varying vec4 vClase;\nvarying vec3 vSuelo;\n${declaraciones}\nuniform vec3 iPasto;\nuniform vec3 iPotrero;\n${RUIDO_GLSL}${programa.fragmentShader}`
      .replace('#include <map_fragment>', `
	vec2 pm = vSuelo.xz;
	float lejos = length( vSuelo - cameraPosition );
	float detalle = 1.0 - smoothstep( 25.0, 170.0, lejos );
	// Potrero: la foto desde el aire, con manchas grandes y, de cerca, la hierba.
	vec3 pot = texture2D( tPotrero, pm / mPotrero ).rgb;
	vec3 gr = texture2D( tPotrero, mat2( 0.8, -0.6, 0.6, 0.8 ) * pm / ( mPotrero * 4.3 ) ).rgb * iPotrero;
	float mancha = clamp( ( gr.g - 1.0 ) * 2.4 + 0.5, 0.0, 1.0 );
	pot *= mix( vec3( 0.84, 0.88, 0.80 ), vec3( 1.16, 1.12, 1.16 ), mancha );
	// (dos veces, girada, y aplanada: las hebras secas de la foto se veían como una malla)
	vec3 hierba = ( texture2D( tPasto, pm / mPasto ).rgb + texture2D( tPasto, mat2( 0.5, 0.866, -0.866, 0.5 ) * pm / ( mPasto * 1.73 ) ).rgb ) * 0.5 * iPasto - 1.0;
	hierba = 1.0 + hierba / ( 1.0 + 0.8 * abs( hierba ) );
	vec3 cPasto = pot * mix( vec3( 1.0 ), hierba, detalle * 0.75 );
	vec3 cMonte = texture2D( tMonte, pm / mMonte ).rgb * mix( 0.82, 1.18, mancha );
	vec3 cSeco = texture2D( tSeco, pm / mSeco ).rgb * mix( vec3( 1.0 ), hierba, detalle * 0.6 );
	vec3 cArado = texture2D( tArado, pm / mArado ).rgb;
	// Los bordes: donde dos clases se encuentran, el ruido decide cuál gana.
	vec4 q = vClase;
	float n1 = ruidoS( pm * 0.11 ) * 0.65 + ruidoS( pm * 0.43 ) * 0.35;
	float n2 = ruidoS( pm * 0.13 + 71.0 );
	q = clamp( q + q * ( 1.0 - q ) * 3.4 * ( vec4( n1, 1.0 - n1, n2, 1.0 - n2 ) - 0.5 ), 0.0, 1.0 );
	q = q * q; q = q * q;
	q /= max( q.x + q.y + q.z + q.w, 1e-4 );
	diffuseColor.rgb *= cPasto * q.x + cMonte * q.y + cSeco * q.z + cArado * q.w;
`)
  }
  return material
}

// ---------- Láminas ----------

// La hora del viento, compartida por todas las láminas: la mueve mapa/mundo.js.
export const VIENTO = { value: 0 }

// Pone cada lámina de cara a la cámara. `position` es la esquina (x, y) de una
// lámina de alto 1 con el pie en el origen; la matriz de la instancia da el
// sitio y el tamaño. No gira del todo hacia la cámara (`uInclina`): parada del
// todo, vista desde arriba se aplasta; acostada del todo, flota.
// Cuando se dibuja la sombra, la «cámara» es el sol: la lámina le da la cara y
// echa la sombra del árbol entero.
const DE_CARA = `
	vec4 mvPosition;
	{
		mat4 alMundo = modelMatrix * instanceMatrix;
		vec3 pie = alMundo[ 3 ].xyz;
		float anchoL = length( alMundo[ 0 ].xyz ), altoL = length( alMundo[ 1 ].xyz );
		vec3 der = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
		vec3 arr = normalize( mix( vec3( 0.0, 1.0, 0.0 ), vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] ), uInclina ) );
		float espejo = fract( sin( dot( pie.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > 0.5 ? 1.0 : - 1.0;
		float mece = sin( uViento * 1.3 + pie.x * 0.35 + pie.z * 0.21 ) * uMece * transformed.y * transformed.y;
		vec3 enMundo = pie + der * ( transformed.x * espejo * anchoL + mece * altoL ) + arr * transformed.y * altoL;
		mvPosition = viewMatrix * vec4( enMundo, 1.0 );
		gl_Position = projectionMatrix * mvPosition;
	}
`
function deCara(programa, inclina, mece) {
  programa.uniforms.uInclina = { value: inclina }
  programa.uniforms.uMece = { value: mece }
  programa.uniforms.uViento = VIENTO
  programa.vertexShader = `uniform float uInclina;\nuniform float uMece;\nuniform float uViento;\n${programa.vertexShader}`.replace('#include <project_vertex>', DE_CARA)
}

// El material de una lámina recortada (árbol, mata).
//
// Dos trampas que resuelve:
//  · De lejos la tarjeta gráfica usa copias reducidas de la foto, y al reducirla
//    promedia cada hoja con el vacío de alrededor, que en el archivo es negro:
//    los árboles del monte se veían secos. Con el color multiplicado por la
//    transparencia al subir la foto (`premultiplyAlpha`) y dividido de vuelta
//    aquí, la hoja conserva su verde a cualquier distancia.
//  · Cortar por lo sano (dibujar o no dibujar cada punto) deja el borde en
//    sierra. `alphaToCoverage` reparte el borde entre las muestras del
//    suavizado que la pantalla ya hace, sin las mezclas que en un teléfono
//    cuestan y se ordenan mal.
//  · Ese reparto necesita escribir el alfa, y lo que se escribe queda en el
//    lienzo: el borde salía medio transparente y el navegador le sumaba el fondo
//    crema de la página (puntos amarillos por todo el potrero; el 2,4 % del mapa).
//    La mezcla propia de abajo pinta el color tal cual y deja quieto el alfa del
//    lienzo. Se mide con `herramientas/mapa-sin-ventana.mjs`: copiar el lienzo
//    no lo muestra.
export function materialDeLamina(T, clave, corte, color, inclina, mece) {
  const material = new THREE.MeshLambertMaterial({ map: T.tex[clave], alphaTest: 0.04, color, vertexColors: true, alphaToCoverage: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.ZeroFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor })
  material.onBeforeCompile = (programa) => {
    deCara(programa, inclina, mece)
    programa.fragmentShader = programa.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
	diffuseColor.rgb /= max( diffuseColor.a, 0.02 );
	diffuseColor.a = clamp( ( diffuseColor.a - ${corte.toFixed(2)} ) / max( fwidth( diffuseColor.a ), 0.0001 ) + 0.5, 0.0, 1.0 );`)
      // Esta versión de three escribe alfa 1 en lo que no es transparente, y
      // sin alfa el suavizado del borde no tiene de qué agarrarse.
      .replace('#include <opaque_fragment>', 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );')
  }
  // Dos láminas con distinto corte son dos programas distintos: sin esta clave
  // three reutiliza el primero que compiló.
  material.customProgramCacheKey = () => `lamina${corte}`
  return material
}

function sombraDeLamina(T, clave, inclina, mece) {
  const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.tex[clave], alphaTest: 0.4 })
  material.onBeforeCompile = (programa) => deCara(programa, inclina, mece)
  return material
}

// La lámina de una imagen: alto 1, el pie del tronco en el origen, y con sus
// dos caras dibujadas por separado (la mitad de las láminas va en espejo, y un
// material de dos caras voltearía la luz de las espejadas y saldrían negras).
// `luz` = [pie, punta]: el pie recibe menos luz, a la sombra de sus hojas.
export function geomLamina(d, luz = [0.72, 1.06]) {
  const w = d.ancho_m / d.alto_m
  const x0 = -d.eje_u * w
  const x1 = (1 - d.eje_u) * w
  const m = 0.004 // un pelo hacia adentro: en el borde de la foto hay medio punto mezclado
  const [a, b] = luz
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, 0, 0, x1, 0, 0, x1, 1, 0, x0, 1, 0], 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([m, m, 1 - m, m, 1 - m, 1 - m, m, 1 - m], 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute([a, a, a, a, a, a, b, b, b, b, b, b], 3))
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2])
  return g
}

// Qué imagen lleva cada árbol del mapa y cuánto mide de alto (m). El texto con
// que se pidió cada imagen nombra la especie, pero la imagen es de IA: se parece
// a un aliso, no es la foto de un aliso, y Ajustes lo dice.
export const ESPECIES = {
  aliso: { imagen: 'ia_aliso', alto: 10 },
  roble: { imagen: 'ia_roble', alto: 9 },
  encenillo: { imagen: 'ia_encenillo', alto: 7 },
  sietecueros: { imagen: 'ia_sietecueros', alto: 5.5 },
  arrayan: { imagen: 'ia_arrayan', alto: 4.2 },
  eucalipto: { imagen: 'ia_eucalipto', alto: 17 },
  pino: { imagen: 'ia_pino', alto: 11 },
  frutal: { imagen: 'ia_frutal', alto: 3.4 },
}

// Qué imagen hace de cada cultivo de la huerta y de qué tamaño (m).
export const CULTIVOS = {
  hoja: { imagen: 'ia_lechuga', alto: 0.34 },
  repollo: { imagen: 'ia_repollo', alto: 0.44 },
  maiz: { imagen: 'ia_maiz', alto: 1.7 },
  arveja: { imagen: 'ia_arveja', alto: 1.25 },
}

// Siembra láminas. `lista`: [x, y, z, alto] por mata.
function sembrar(T, clave, lista, { color = new THREE.Color(1, 1, 1), variar = 0.3, inclina = 0.5, mece = 0.008, corte = 0.4, sombra = false, luz } = {}) {
  const im = new THREE.InstancedMesh(geomLamina(T.indice[clave], luz), materialDeLamina(T, clave, corte, color, inclina, mece), lista.length)
  const m4 = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const tinte = new THREE.Color()
  lista.forEach(([x, y, z, alto], i) => {
    m4.compose(p.set(x, y, z), q, s.setScalar(alto))
    im.setMatrixAt(i, m4)
    // Ninguna mata es del mismo verde que la de al lado: sembradas todas del
    // mismo tono se ven como un estampado.
    const k = 1 - variar / 2 + (((i * 7919) % 100) / 100) * variar
    im.setColorAt(i, tinte.setRGB(k * (0.97 + (((i * 104729) % 100) / 100) * 0.1), k, k * 0.96))
  })
  if (sombra) {
    im.castShadow = true
    im.customDepthMaterial = sombraDeLamina(T, clave, inclina, mece)
  }
  return im
}

// Siembra árboles de una especie. `lista`: [x, y, z, escala, giro] por árbol;
// el giro no se usa (la lámina siempre mira a la cámara).
export function arbolado(T, especie, lista, { sombra = true } = {}) {
  const esp = ESPECIES[especie] || ESPECIES.roble
  return sembrar(T, esp.imagen, lista.map(([x, y, z, escala]) => [x, y, z, esp.alto * escala]), { color: new THREE.Color(1.12, 1.36, 1.02), sombra, inclina: 0.42 })
}

// Siembra la huerta. `porCultivo`: { hoja: [[x, y, z, azar, giro], …], maiz: … },
// un dato por mata, con `azar` de 0 a 1 para que no salgan todas del mismo
// tamaño. Un cultivo que no esté en CULTIVOS se dibuja como hoja.
export function huerta(T, porCultivo) {
  return Object.entries(porCultivo).map(([cultivo, lista]) => {
    const c = CULTIVOS[cultivo] || CULTIVOS.hoja
    // Solo lo alto da sombra: la de una lechuga no se alcanza a ver.
    return sembrar(T, c.imagen, lista.map(([x, y, z, azar]) => [x, y - 0.02, z, c.alto * (0.85 + azar * 0.3)]), { inclina: 0.6, mece: 0.012, variar: 0.22, sombra: c.alto > 0.6 })
  })
}

// Siembra matas sueltas del potrero. `lista`: [x, y, z, alto, giro].
export function matas(T, clave, lista, color) {
  return sembrar(T, clave, lista, { color, inclina: 0.6, mece: 0.03, variar: 0.3, luz: [0.8, 1.05] })
}
