// Lo que se mueve en el mapa: las vacas del potrero, las garzas que cruzan de
// vez en cuando y las lombrices del lombricultivo.
//
// Tres reglas de la casa mandan aquí:
//  · El mapa no inventa animales de la finca. Las vacas son las del libro (el
//    tamaño del sistema Ganado); sin sistema, el potrero queda vacío. Las garzas
//    son paisaje, como las nubes. Las lombrices son un dibujo y la ficha lo dice:
//    nadie las cuenta.
//  · Rendimiento de iPhone: todo va instanciado (una llamada de dibujo por
//    pieza, no por animal) y lo que solo se ve de cerca (las lombrices) no se
//    dibuja ni se calcula de lejos.
//  · La ladera es de verdad: cada animal pisa el suelo donde está.
//
// Cómo se mueven las vacas (cuenta pura, probada en Node) vive en lib/rebano.js.

import * as THREE from '../vendor/three/three.module.js'
import * as M from './modelos.js'
import { crearRebano, avanzarRebano, crearAzar, formacionEnV } from '../lib/rebano.js'

// Pelo y manchas de las razas lecheras de la Sabana: holstein, normando,
// holstein negro, jersey y criolla colorada. Son colores de dibujo: la app no
// sabe de qué raza son las vacas de la finca, y la ficha del potrero lo dice.
const PINTAS = [
  ['#f4f1ea', '#26262a'], ['#f1e9d8', '#6b3a22'], ['#2a2a2e', '#f4f1ea'], ['#b98a5a', null], ['#f4f1ea', '#26262a'], ['#8c4a2a', null],
]

// Un número estable a partir del id del objeto: el mismo potrero arranca igual cada vez.
function semillaDe(texto) {
  let h = 2166136261
  for (const c of String(texto)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

export function crearVida({ escena, mat, suelo, local, poner, animables, tocables, estilo, camara, objetivo, distancia }) {
  const m4 = new THREE.Matrix4(), mLocal = new THREE.Matrix4(), mGiro = new THREE.Matrix4(), mHijo = new THREE.Matrix4()
  const q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3()
  const NADA = new THREE.Matrix4().makeScale(0, 0, 0)

  // ---------- Vacas ----------
  // `n` vacas dentro del potrero `o` (un rectángulo que puede estar girado).
  function vacas(o, n) {
    if (!(n > 0)) return
    const ancho = o.ancho || 26, fondo = o.fondo || 18
    const semilla = semillaDe(o.id || 'potrero')
    const rebano = crearRebano(n, { ancho, fondo, semilla })
    const azar = crearAzar(semilla + 1)
    const g = M.geomVaca()
    const mCuerpo = new THREE.InstancedMesh(g.cuerpo, mat, n)
    const mManchas = new THREE.InstancedMesh(g.manchas, mat, n)
    const mCabeza = new THREE.InstancedMesh(g.cabeza, mat, n)
    const mPatas = new THREE.InstancedMesh(g.pata, mat, n * 4)
    mCuerpo.castShadow = mCabeza.castShadow = true
    // Las vacas se agrandan menos que las gallinas: una vaca ya se ve desde lejos.
    const escala = 1 + (estilo.escalaAnimales - 1) * 0.25
    // Se mueven por todo el potrero: la esfera para decidir si están en pantalla
    // se pone a mano, o three.js la calcularía con el primer cuadro y las
    // escondería al alejarse de donde nacieron.
    const esfera = new THREE.Sphere(new THREE.Vector3(o.x, suelo(o.x, o.z), o.z), Math.hypot(ancho, fondo) / 2 + 8)
    const color = new THREE.Color()
    for (const [i, v] of rebano.entries()) {
      const [pelo, mancha] = PINTAS[v.pinta % PINTAS.length]
      color.set(pelo)
      mCuerpo.setColorAt(i, color)
      mCabeza.setColorAt(i, color)
      for (let k = 0; k < 4; k++) mPatas.setColorAt(i * 4 + k, color)
      mManchas.setColorAt(i, color.set(mancha || pelo))
    }
    for (const m of [mCuerpo, mManchas, mCabeza, mPatas]) {
      m.boundingSphere = esfera
      escena.add(m)
    }
    const φ = o.rot || 0
    const largo = 0.7 * escala
    let t = 0
    function dibujar() {
      for (const [i, v] of rebano.entries()) {
        const [x, z] = local(o, v.u, v.w)
        // El rumbo se lleva en los ejes del potrero; en el mundo, girado con él.
        const rumbo = v.rumbo - φ
        const cx = Math.cos(rumbo), cz = Math.sin(rumbo)
        // En la ladera el cuerpo se inclina con el terreno: si no, las patas de
        // adelante quedan enterradas y las de atrás en el aire.
        // Solo en parte: con toda la pendiente de una ladera fuerte parece que
        // se fuera de bruces (las patas de una vaca de verdad siguen a plomo).
        const adelante = suelo(x + cx * largo, z + cz * largo), atras = suelo(x - cx * largo, z - cz * largo)
        e.set(0, -rumbo, THREE.MathUtils.clamp(Math.atan2(adelante - atras, 2 * largo) * 0.6, -0.22, 0.22))
        q.setFromEuler(e)
        m4.compose(p.set(x, (adelante + atras) / 2, z), q, s.setScalar(escala))
        mCuerpo.setMatrixAt(i, m4)
        if (PINTAS[v.pinta % PINTAS.length][1]) mManchas.setMatrixAt(i, m4)
        else mManchas.setMatrixAt(i, NADA)
        // La cabeza baja al pasto y, mientras come, se mece un poco.
        const mascar = v.cabeza > 0.9 ? Math.sin(t * 5 + i * 1.7) * 0.05 : 0
        mLocal.makeRotationZ(M.VACA.cabezaArriba + (M.VACA.cabezaAbajo - M.VACA.cabezaArriba) * v.cabeza + mascar).setPosition(...M.VACA.cuello)
        mCabeza.setMatrixAt(i, mHijo.multiplyMatrices(m4, mLocal))
        // Las patas van por parejas cruzadas, como camina una vaca.
        for (let k = 0; k < 4; k++) {
          const fase = k === 0 || k === 3 ? 0 : Math.PI
          mLocal.makeRotationZ(Math.sin(v.paso + fase) * 0.42 * v.marcha).setPosition(...M.VACA.caderas[k])
          mPatas.setMatrixAt(i * 4 + k, mHijo.multiplyMatrices(m4, mLocal))
        }
      }
      for (const m of [mCuerpo, mManchas, mCabeza, mPatas]) m.instanceMatrix.needsUpdate = true
    }
    dibujar()
    animables.push((dt) => {
      t += dt
      avanzarRebano(rebano, dt, { ancho, fondo, azar })
      dibujar()
    })
  }

  // ---------- Garzas ----------
  // Una bandada pequeña cruza cada tanto sobre lo que se está mirando. El resto
  // del tiempo no se dibuja ni se calcula nada.
  function pajaros() {
    const MAXIMO = 7, VELOCIDAD = 13, MEDIO = 240 // m/s y metros a cada lado del punto de cruce
    const g = M.geomPajaro()
    const mCuerpo = new THREE.InstancedMesh(g.cuerpo, mat, MAXIMO)
    const mAlas = new THREE.InstancedMesh(g.ala, mat, MAXIMO * 2)
    // Recorren medio kilómetro: no tiene sentido una esfera fija para saber si se ven.
    mCuerpo.frustumCulled = mAlas.frustumCulled = false
    mCuerpo.visible = mAlas.visible = false
    // Su sombra corriendo por el potrero es lo que más las delata desde arriba.
    mCuerpo.castShadow = mAlas.castShadow = true
    escena.add(mCuerpo, mAlas)
    const azar = crearAzar(20261122)
    const escala = estilo.escalaAnimales * 1.25
    const media = new THREE.Matrix4().makeRotationY(Math.PI) // el ala derecha es la izquierda dada vuelta
    let espera = 6 + azar() * 6 // la primera pasa pronto, para que se sepa que existen
    let vuelo = null
    animables.push((dt) => {
      if (!vuelo) {
        espera -= dt
        if (espera > 0) return
        const c = objetivo()
        const n = 3 + Math.floor(azar() * (MAXIMO - 2))
        // Vuelan a un tercio de la distancia a la que se mira: con la finca
        // entera en pantalla, a ras del suelo serían un punto que nadie ve.
        const altura = THREE.MathUtils.clamp(distancia() * (0.28 + azar() * 0.12), 14, 90)
        vuelo = { t: 0, n, rumbo: azar() * 6.283, cx: c.x + (azar() - 0.5) * 50, cz: c.z + (azar() - 0.5) * 50, altura, y: null, puestos: formacionEnV(n) }
        mCuerpo.count = n
        mAlas.count = n * 2
        mCuerpo.visible = mAlas.visible = true
      }
      vuelo.t += dt
      const avance = -MEDIO + vuelo.t * VELOCIDAD
      if (avance > MEDIO) {
        vuelo = null
        mCuerpo.visible = mAlas.visible = false
        espera = 35 + azar() * 55
        return
      }
      const dx = Math.cos(vuelo.rumbo), dz = Math.sin(vuelo.rumbo)
      // Siguen la ladera a su altura, sin saltos: la altura del guía se suaviza.
      const yGuia = suelo(vuelo.cx + dx * avance, vuelo.cz + dz * avance) + vuelo.altura
      vuelo.y = vuelo.y == null ? yGuia : vuelo.y + (yGuia - vuelo.y) * Math.min(1, dt * 0.8)
      e.set(0, -vuelo.rumbo, 0)
      q.setFromEuler(e)
      s.setScalar(escala)
      for (const [k, puesto] of vuelo.puestos.entries()) {
        const a = avance - puesto.atras
        const aleteo = Math.sin(vuelo.t * 15 + k * 1.3) * 0.7
        // El cuerpo baja cuando las alas suben y al revés, como en un pájaro de verdad.
        p.set(vuelo.cx + dx * a - dz * puesto.lado, vuelo.y + Math.sin(vuelo.t * 1.1 + k * 1.7) * 0.5 - aleteo * 0.12, vuelo.cz + dz * a + dx * puesto.lado)
        m4.compose(p, q, s)
        mCuerpo.setMatrixAt(k, m4)
        mGiro.makeRotationX(-aleteo)
        mAlas.setMatrixAt(k * 2, mHijo.multiplyMatrices(m4, mGiro))
        mAlas.setMatrixAt(k * 2 + 1, mHijo.multiplyMatrices(m4, media).multiply(mGiro))
      }
      mCuerpo.instanceMatrix.needsUpdate = mAlas.instanceMatrix.needsUpdate = true
    })
  }

  // ---------- Lombricultivo ----------
  // Al acercar la cámara el techo de paja se desvanece y en el lecho se ven las
  // lombrices saliendo, arrastrándose y volviendo a enterrarse. Devuelve dónde
  // debe pararse la cámara para verlas (lo usa «Acercarme» en la ficha).
  function lombricultivo(o, comun) {
    const piezas = M.geomLombricultivoPartes()
    const grupo = poner(piezas.lecho, o.x, o.z, o.rot, { ...comun, alto: 2.8, edificio: true })
    // Material propio: su transparencia cambia y no debe arrastrar a todo lo demás.
    const matTecho = mat.clone()
    matTecho.transparent = true
    const techo = new THREE.Mesh(piezas.techo, matTecho)
    techo.castShadow = true
    techo.userData = grupo.children[0].userData
    grupo.add(techo)
    tocables.push(techo)

    // Nueve anillos pegados: con menos, o más separados, se ven como cuentas sueltas.
    const CUANTAS = 24, ANILLOS = 9, RADIO = 0.016, PASO = 0.019
    const L = M.LECHO_LOMBRIZ
    const limX = L.ancho / 2 - 0.07, limZ = L.largo / 2 - 0.09
    const anillos = new THREE.InstancedMesh(M.geomAnilloLombriz(), mat, CUANTAS * ANILLOS)
    anillos.frustumCulled = false
    anillos.visible = false
    const color = new THREE.Color()
    for (let i = 0; i < CUANTAS; i++)
      // Cabeza más oscura y, cerca de ella, el anillo claro (el clitelo) de la roja californiana.
      for (let k = 0; k < ANILLOS; k++) anillos.setColorAt(i * ANILLOS + k, color.set(k === 0 ? '#8f3a35' : k === 2 || k === 3 ? '#d98274' : '#b4483f'))
    grupo.add(anillos)
    const azar = crearAzar(semillaDe(o.id || 'lombriz'))
    const reubicar = (w) => {
      w.x = (azar() * 2 - 1) * limX
      w.z = (azar() * 2 - 1) * limZ
      w.rumbo = azar() * 6.283
    }
    const gusanos = []
    for (let i = 0; i < CUANTAS; i++) {
      const w = { fase: azar() * 6.283, etapa: 'anda', reloj: azar() * 12, hondo: 0 }
      reubicar(w)
      gusanos.push(w)
    }
    const escalaGrupo = grupo.scale.x
    const centro = new THREE.Vector3(o.x, grupo.position.y + L.y * escalaGrupo, o.z)
    let t = 0, opacidad = 1
    animables.push((dt) => {
      const d = camara.position.distanceTo(centro)
      const nueva = THREE.MathUtils.clamp((d - 10) / 10, 0, 1)
      if (nueva !== opacidad) {
        opacidad = matTecho.opacity = nueva
        techo.visible = nueva > 0.01
        // Sin techo no hay sombra de techo: el lecho queda a plena luz.
        techo.castShadow = nueva > 0.6
      }
      anillos.visible = d < 26
      if (!anillos.visible) return
      t += dt
      for (const [i, w] of gusanos.entries()) {
        w.reloj -= dt
        if (w.reloj <= 0) {
          if (w.etapa === 'anda') { w.etapa = 'entra'; w.reloj = 1.2 }
          else if (w.etapa === 'entra') { w.etapa = 'abajo'; w.reloj = 0.5 + azar() * 3 }
          else if (w.etapa === 'abajo') { reubicar(w); w.etapa = 'sale'; w.reloj = 1.2 }
          else { w.etapa = 'anda'; w.reloj = 5 + azar() * 9 }
        }
        w.hondo = w.etapa === 'abajo' ? 1 : w.etapa === 'entra' ? 1 - w.reloj / 1.2 : w.etapa === 'sale' ? w.reloj / 1.2 : 0
        if (w.etapa !== 'abajo') {
          w.rumbo += Math.sin(t * 0.7 + w.fase) * 0.5 * dt
          const nx = w.x + Math.cos(w.rumbo) * 0.03 * dt, nz = w.z + Math.sin(w.rumbo) * 0.03 * dt
          if (Math.abs(nx) < limX && Math.abs(nz) < limZ) { w.x = nx; w.z = nz } else w.rumbo += 2
        }
        const cx = Math.cos(w.rumbo), cz = Math.sin(w.rumbo)
        for (let k = 0; k < ANILLOS; k++) {
          // Se estira y se encoge por tramos (así avanza una lombriz) y culebrea.
          const a = -(k - (ANILLOS - 1) / 2) * PASO * (1 + 0.2 * Math.sin(t * 3 - k * 0.7 + w.fase))
          const lado = 0.014 * Math.sin(k * 0.8 - t * 4 + w.fase)
          const r = RADIO * (k === 0 || k === ANILLOS - 1 ? 0.75 : 1)
          m4.makeScale(r * 1.3, r * 0.85, r * 1.3).setPosition(w.x + cx * a - cz * lado, L.y + r * 0.5 - w.hondo * 0.06, w.z + cz * a + cx * lado)
          anillos.setMatrixAt(i * ANILLOS + k, m4)
        }
      }
      anillos.instanceMatrix.needsUpdate = true
    })
    // `largo`: hacia dónde corre el lecho. La cámara se pone a lo largo, para
    // que quepa entero en la pantalla parada del celular.
    return { objetivo: [centro.x, centro.y, centro.z], dist: 4.6, elev: 0.95, largo: o.rot || 0 }
  }

  // ---------- Detalle del suelo (gráficos nuevos) ----------
  // Matas de pasto, flores y piedras dentro del lindero: de lejos le dan grano
  // al verde y de cerca se ven una por una. `ocupado` es lo que no se pisa
  // ([x, z, radio] de cada construcción, cama o árbol) y `camino`, la entrada.
  function pasto({ lindero, enFinca, ocupado, camino = [] }) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
    for (const [x, z] of lindero) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
    // Tope de unas 9.000 matas: una finca grande las reparte más ralas en vez de pesar más.
    const paso = Math.max(1.7, Math.sqrt(((x1 - x0) * (z1 - z0)) / 9000))
    const azar = crearAzar(77)
    const enCamino = (x, z) => {
      for (let i = 0; i < camino.length - 1; i++) {
        const [ax, az] = camino[i], [bx, bz] = camino[i + 1]
        const l2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1
        const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2))
        if (Math.hypot(x - (ax + k * (bx - ax)), z - (az + k * (bz - az))) < 2) return true
      }
      return false
    }
    const matas = [], flores = [], piedras = []
    for (let x = x0; x < x1; x += paso)
      for (let z = z0; z < z1; z += paso) {
        const px = x + azar() * paso, pz = z + azar() * paso, r = azar()
        if (!enFinca(px, pz, -1.2) || enCamino(px, pz) || ocupado.some(([ox, oz, or]) => (px - ox) ** 2 + (pz - oz) ** 2 < or * or)) continue
        // Las flores salen por manchones, como en un potrero de verdad.
        const manchon = Math.sin(px * 0.13 + 1.7) * Math.sin(pz * 0.11 + 0.4) > 0.3
        if (r < 0.01) piedras.push([px, pz])
        else if (r < (manchon ? 0.3 : 0.03)) flores.push([px, pz])
        else if (r < 0.86) matas.push([px, pz])
      }
    const matSuelto = mat.clone()
    matSuelto.flatShading = false // usa las normales del modelo, que miran hacia arriba (ver modelos.js)
    const color = new THREE.Color()
    const sembrados = []
    const sembrar = (geom, lista, material, { minimo, maximo, tinte }) => {
      if (!lista.length) return
      const im = new THREE.InstancedMesh(geom, material, lista.length)
      sembrados.push(im)
      lista.forEach(([x, z], i) => {
        q.setFromAxisAngle(p.set(0, 1, 0), azar() * 6.283)
        m4.compose(p.set(x, suelo(x, z) - 0.02, z), q, s.setScalar(minimo + azar() * (maximo - minimo)))
        im.setMatrixAt(i, m4)
        im.setColorAt(i, tinte(color, azar()))
      })
      im.receiveShadow = true
      escena.add(im)
    }
    sembrar(M.geomMata(), matas, matSuelto, { minimo: 0.8, maximo: 1.5, tinte: (c, a) => c.setRGB(0.8 + a * 0.2, 0.86 + a * 0.14, 0.7 + a * 0.25) })
    sembrar(M.geomFlor(), flores, matSuelto, { minimo: 1.2, maximo: 2, tinte: (c, a) => c.set(a < 0.55 ? '#ffffff' : a < 0.9 ? '#ffe04d' : '#d9b3ff') })
    sembrar(M.geomPiedra(), piedras, mat, { minimo: 0.6, maximo: 1.6, tinte: (c, a) => c.setScalar(0.85 + a * 0.25) })
    // Con la finca entera en pantalla cada mata mide menos de un punto: solo
    // ensucia el verde y le cuesta al teléfono. Se dibujan al acercarse.
    let visible = true
    animables.push(() => {
      const ver = distancia() < 130
      if (ver === visible) return
      visible = ver
      for (const im of sembrados) im.visible = ver
    })
  }

  // Un parche de tierra pegado al suelo, de bordes difusos: el parque que las
  // gallinas pelan a punta de escarbar, la tierra trabajada de la huerta.
  function parche(o, ancho, fondo, tono, fuerza = 0.75) {
    const celda = 2
    const nu = Math.max(2, Math.ceil(ancho / celda)), nw = Math.max(2, Math.ceil(fondo / celda))
    const azar = crearAzar(semillaDe((o.id || 'parche') + tono))
    const c = new THREE.Color(tono)
    const pos = [], col = [], indices = []
    for (let j = 0; j <= nw; j++)
      for (let i = 0; i <= nu; i++) {
        const [x, z] = local(o, (i / nu - 0.5) * ancho, (j / nw - 0.5) * fondo)
        pos.push(x, suelo(x, z) + 0.1, z)
        const borde = i === 0 || j === 0 || i === nu || j === nw
        col.push(c.r, c.g, c.b, borde ? 0 : fuerza * (0.6 + azar() * 0.4))
      }
    for (let j = 0; j < nw; j++)
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, d = a + nu + 1
        indices.push(a, d, b, b, d, d + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
    g.setIndex(indices)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }))
    m.receiveShadow = true
    escena.add(m)
  }

  return { vacas, pajaros, lombricultivo, pasto, parche }
}
