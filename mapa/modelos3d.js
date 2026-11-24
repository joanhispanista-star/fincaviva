// Los modelos 3D hechos con IA (vaca, gallina, casa y gallinero) de los gráficos
// realistas. Los arma herramientas/modelos_ia.py; aquí se leen, se visten y se
// mueven.
//
// Nada de esto es la finca de verdad: es una vaca, una gallina, una casa y un
// gallinero cualquiera, y Ajustes lo dice.
//
// Los modelos llegan de una sola pieza, sin huesos. En vez de partirlos, el
// movimiento se hace en la tarjeta gráfica: cada vértice sabe por dónde queda
// (las patas, el cuello) y gira alrededor de la cadera o del hombro. Así una
// vacada entera sigue siendo UNA llamada de dibujo.

import * as THREE from '../vendor/three/three.module.js'

// Lee un .bin (ver modelos_ia.py) y su textura. `base` es la raíz de la app.
export async function cargarModelo(base, nombre, d, renderer) {
  const [respuesta, tex] = await Promise.all([fetch(`${base}mapa/modelos3d/${d.archivo}`), new THREE.TextureLoader().loadAsync(`${base}mapa/texturas/${d.textura}`)])
  if (!respuesta.ok) throw new Error(`el modelo «${nombre}» respondió ${respuesta.status}`)
  const b = await respuesta.arrayBuffer()
  const n = d.vertices
  const [lo, hi] = d.caja
  const q = new Uint16Array(b, 0, n * 4)
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = lo[k] + (q[i * 4 + k] / 65535) * (hi[k] - lo[k])
  // Las normales van en 4 bytes (el cuarto es relleno) pero aquí se entregan de
  // a 3: así las aceptan las cuentas de three.js que esperan una normal.
  const nb = new Int8Array(b, n * 8, n * 4)
  const nor = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) nor[i * 3 + k] = nb[i * 4 + k] / 127
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(b, n * 12, n * 2), 2, true))
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(b, n * 16, d.indices), 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  // Con qué se dibuja lo que no se mueve (la casa, el gallinero): lo lee `vestir`
  // de mapa/mundo.js.
  const material = new THREE.MeshLambertMaterial({ map: tex })
  g.userData.material = material
  return {
    geom: g, tex, caja: d.caja,
    soltar() {
      g.dispose()
      tex.dispose()
      material.dispose()
    },
  }
}

// El color del animal: el blanco y el negro de la textura se cambian por los
// suyos y lo que tiene color propio (la cresta, el hocico, la ubre) se respeta.
// `oscuro` = null en la gallina, que es toda de un color.
const PELO = `
	{
		vec3 c = diffuseColor.rgb;
		float mx = max( c.r, max( c.g, c.b ) ), mn = min( c.r, min( c.g, c.b ) );
		float sat = ( mx - mn ) / max( mx, 0.001 );
		float lum = dot( c, vec3( 0.3, 0.6, 0.1 ) );
`

// ---------- Vacas ----------

// Dónde dobla la vaca, en metros de su modelo (mira hacia +x, mide 1,75 de alto).
export const ARTICULACIONES = { cadera: 0.86, cuelloX: 0.45, cuelloY: 1.1, cabezaAbajo: -1.35, estira: 0.34 }

const MUEVE_VACA = `
attribute vec3 aPaso;
attribute vec3 aPelo;
attribute vec3 aMancha;
varying vec3 vPelo;
varying vec3 vMancha;
// Gira el punto (o la normal) del vértice: las patas alrededor de la cadera, por
// parejas cruzadas como camina una vaca, y el cuello alrededor del hombro.
vec3 moverVaca( vec3 v, vec3 sitio, float esPunto ) {
	const float CADERA = ${ARTICULACIONES.cadera.toFixed(2)};
	float pata = smoothstep( CADERA, CADERA - 0.22, sitio.y ) * step( sitio.x, 0.95 );
	float fase = ( sitio.x > 0.0 ? 0.0 : 3.1416 ) + ( sitio.z > 0.0 ? 0.0 : 3.1416 );
	float giro = sin( aPaso.x + fase ) * 0.38 * aPaso.y * pata;
	vec3 eje = vec3( sitio.x > 0.0 ? 0.4 : - 0.64, CADERA, 0.0 ) * esPunto;
	float co = cos( giro ), se = sin( giro );
	vec3 r = v - eje;
	v = eje + vec3( co * r.x - se * r.y, se * r.x + co * r.y, r.z );
	// La vaca de la imagen tiene la cabeza vuelta hacia un lado (+z): el cuello se
	// mide hacia allá, o una oreja se queda atrás y se estira como una goma.
	float cuello = smoothstep( 0.55, 0.92, sitio.x + 0.9 * max( sitio.z, 0.0 ) ) * smoothstep( 0.72, 1.0, sitio.y );
	float baja = ${ARTICULACIONES.cabezaAbajo.toFixed(2)} * aPaso.z * cuello;
	vec3 hombro = vec3( ${ARTICULACIONES.cuelloX.toFixed(2)}, ${ARTICULACIONES.cuelloY.toFixed(2)}, 0.0 ) * esPunto;
	co = cos( baja ); se = sin( baja );
	r = v - hombro;
	// Girar no alcanza para llegar al pasto: además el cuello se estira hacia abajo.
	hombro.y -= ${ARTICULACIONES.estira.toFixed(2)} * aPaso.z * cuello * esPunto;
	return hombro + vec3( co * r.x - se * r.y, se * r.x + co * r.y, r.z );
}
`
function prepararVaca(programa) {
  programa.vertexShader = MUEVE_VACA + programa.vertexShader
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tobjectNormal = moverVaca( objectNormal, position, 0.0 );')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = moverVaca( transformed, position, 1.0 );\n\tvPelo = aPelo;\n\tvMancha = aMancha;')
}

// Una manada de `n` vacas en una sola malla. `poner(i, matriz, paso, marcha, cabeza)`
// la mueve; `pintar(i, pelo, mancha)` le pone los colores (mancha null = sin manchas).
export function manada(T, n) {
  const modelo = T.modelos.vaca
  const g = modelo.geom.clone()
  const paso = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  const pelo = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  const mancha = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
  g.setAttribute('aPaso', paso)
  g.setAttribute('aPelo', pelo)
  g.setAttribute('aMancha', mancha)
  const material = new THREE.MeshLambertMaterial({ map: modelo.tex })
  material.onBeforeCompile = (programa) => {
    prepararVaca(programa)
    programa.fragmentShader = ('varying vec3 vPelo;\nvarying vec3 vMancha;\n' + programa.fragmentShader).replace('#include <color_fragment>', `#include <color_fragment>${PELO}
		// 1 = piel o pezuña con color propio, que se deja como está.
		float propio = smoothstep( 0.30, 0.52, sat ) * smoothstep( 0.08, 0.2, lum );
		float blanco = smoothstep( 0.10, 0.34, lum );
		// La sombra de la textura se conserva, pero pareja entre lo claro y lo oscuro:
		// si no, en una vaca de un solo color se le ven las manchas de la otra.
		float sombreado = mix( 0.86 + lum * 0.5, 0.72 + lum * 0.4, blanco );
		vec3 nuevo = mix( vMancha, vPelo, blanco ) * sombreado;
		diffuseColor.rgb = mix( nuevo, c, propio * 0.85 );
	}`)
  }
  const malla = new THREE.InstancedMesh(g, material, n)
  malla.castShadow = malla.receiveShadow = true
  // Sin este material la sombra sale del modelo quieto: una vaca que come con la
  // cabeza abajo y su sombra mirando al frente.
  const sombra = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  sombra.onBeforeCompile = prepararVaca
  malla.customDepthMaterial = sombra
  const color = new THREE.Color()
  return {
    malla,
    pintar(i, colorPelo, colorMancha) {
      color.set(colorPelo)
      pelo.setXYZ(i, color.r, color.g, color.b)
      color.set(colorMancha || colorPelo)
      mancha.setXYZ(i, color.r, color.g, color.b)
    },
    poner(i, matriz, pasoVaca, marcha, cabeza) {
      malla.setMatrixAt(i, matriz)
      paso.setXYZ(i, pasoVaca, marcha, cabeza)
    },
    listo() {
      malla.instanceMatrix.needsUpdate = true
      paso.needsUpdate = true
    },
  }
}

// ---------- Gallinas ----------

// Al picotear baja el cuerpo desde las rodillas y dobla el cuello; las patas
// quedan quietas. Girando el modelo entero se le hundían en la tierra.
const MUEVE_GALLINA = `
attribute float aPica;
varying float vAltoG;
vec3 moverGallina( vec3 v, vec3 sitio, float esPunto ) {
	float baja = - 0.72 * aPica * smoothstep( 0.11, 0.19, sitio.y );
	vec3 eje = vec3( 0.06, 0.17, 0.0 ) * esPunto;
	float co = cos( baja ), se = sin( baja );
	vec3 r = v - eje;
	v = eje + vec3( co * r.x - se * r.y, se * r.x + co * r.y, r.z );
	float dobla = - 0.75 * aPica * smoothstep( 0.1, 0.19, sitio.x ) * smoothstep( 0.2, 0.32, sitio.y );
	eje = vec3( 0.2, 0.2, 0.0 ) * esPunto;
	co = cos( dobla ); se = sin( dobla );
	r = v - eje;
	return eje + vec3( co * r.x - se * r.y, se * r.x + co * r.y, r.z );
}
`
function prepararGallina(programa) {
  programa.vertexShader = MUEVE_GALLINA + programa.vertexShader
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tobjectNormal = moverGallina( objectNormal, position, 0.0 );')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = moverGallina( transformed, position, 1.0 );\n\tvAltoG = position.y;')
}

// Una bandada de `n` gallinas en una sola malla, cada una del color de su pluma.
// `malla.userData.pica` (0 a 1 por gallina) dice cuáles están picoteando.
export function bandada(T, n) {
  const modelo = T.modelos.gallina
  const g = modelo.geom.clone()
  const pica = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
  g.setAttribute('aPica', pica)
  const material = new THREE.MeshLambertMaterial({ map: modelo.tex })
  material.onBeforeCompile = (programa) => {
    prepararGallina(programa)
    // El color de la instancia no tiñe todo (dejaría la cresta negra en una
    // gallina negra): solo la pluma, que es lo claro y sin color de la textura.
    programa.fragmentShader = ('varying float vAltoG;\n' + programa.fragmentShader).replace('#include <color_fragment>', `${PELO}
		float pluma = ( 1.0 - smoothstep( 0.28, 0.5, sat ) ) * smoothstep( 0.10, 0.15, vAltoG );
		vec3 tenida = vColor * ( 0.18 + lum * 1.12 );
		vec3 pata = c * vec3( 1.15, 0.98, 0.6 );
		diffuseColor.rgb = mix( vAltoG < 0.13 ? pata : c, tenida, pluma );
	}`)
  }
  const malla = new THREE.InstancedMesh(g, material, n)
  malla.castShadow = true
  const sombra = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  sombra.onBeforeCompile = prepararGallina
  malla.customDepthMaterial = sombra
  malla.userData.pica = pica
  return malla
}
