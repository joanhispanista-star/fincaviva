// Cámara de juego alrededor de la finca, pensada para el dedo.
//
// Un dedo gira, dos dedos acercan y mueven, la rueda del ratón acerca y el
// botón derecho mueve. Se escribió aquí en vez de usar OrbitControls para
// poder ponerle lo que un juego necesita: inercia, no salirse de la finca, no
// meterse bajo la montaña y distinguir un toque (seleccionar algo) de un arrastre.

import * as THREE from '../vendor/three/three.module.js'

export class Controles {
  constructor(camara, elemento, op = {}) {
    this.camara = camara
    this.el = elemento
    this.objetivo = new THREE.Vector3(...(op.objetivo || [0, 0, 0]))
    this.dist = op.distancia ?? 160
    this.azimut = op.azimut ?? 0.8
    this.elev = op.elevacion ?? 0.55
    this.minDist = op.minDist ?? 12
    this.maxDist = op.maxDist ?? 900
    this.minElev = op.minElev ?? 0.12
    this.maxElev = op.maxElev ?? 1.45
    this.radioMax = op.radioMax ?? 400 // el objetivo no se aleja más que esto del centro de la finca
    this.suelo = op.suelo || (() => 0)
    this.alTocar = op.alTocar || null
    this.vel = { az: 0, el: 0 }
    this.punteros = new Map()
    this.movido = 0
    this._enlazar()
    this.actualizar(0)
  }

  _enlazar() {
    const el = this.el
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId)
      this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY, boton: e.button })
      this.movido = 0
      this.vel.az = this.vel.el = 0
      this._vuelo = null // el dedo manda: tocar el mapa corta el vuelo
    })
    el.addEventListener('pointermove', (e) => {
      const p = this.punteros.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      this.movido += Math.abs(dx) + Math.abs(dy)
      if (this.punteros.size === 1) {
        if (p.boton === 2 || e.shiftKey) this._mover(dx, dy)
        else {
          const k = 0.005
          this.azimut -= dx * k
          this.elev = THREE.MathUtils.clamp(this.elev + dy * k, this.minElev, this.maxElev)
          this.vel.az = -dx * k
          this.vel.el = dy * k
        }
      } else if (this.punteros.size === 2) {
        const [a, b] = [...this.punteros.values()]
        const antes = Math.hypot(a.x - b.x, a.y - b.y)
        p.x = e.clientX
        p.y = e.clientY
        const ahora = Math.hypot(a.x - b.x, a.y - b.y)
        if (antes > 0 && ahora > 0) this._acercar(antes / ahora)
        this._mover(dx / 2, dy / 2)
        return
      }
      p.x = e.clientX
      p.y = e.clientY
    })
    const soltar = (e) => {
      const p = this.punteros.get(e.pointerId)
      if (p && this.punteros.size === 1 && this.movido < 8 && this.alTocar) {
        const r = this.el.getBoundingClientRect()
        this.alTocar(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      }
      this.punteros.delete(e.pointerId)
    }
    el.addEventListener('pointerup', soltar)
    el.addEventListener('pointercancel', (e) => this.punteros.delete(e.pointerId))
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        this._vuelo = null
        this._acercar(Math.exp(e.deltaY * 0.0012))
      },
      { passive: false }
    )
  }

  _acercar(factor) {
    this.dist = THREE.MathUtils.clamp(this.dist * factor, this.minDist, this.maxDist)
  }

  // Mover el objetivo sobre el plano del suelo, en la dirección en que mira la cámara.
  _mover(dx, dy) {
    const k = this.dist * 0.0016
    const adelante = new THREE.Vector3(-Math.sin(this.azimut), 0, -Math.cos(this.azimut))
    const derecha = new THREE.Vector3(Math.cos(this.azimut), 0, -Math.sin(this.azimut))
    this.objetivo.addScaledVector(derecha, -dx * k).addScaledVector(adelante, dy * k)
    const r = Math.hypot(this.objetivo.x, this.objetivo.z)
    if (r > this.radioMax) this.objetivo.multiplyScalar(this.radioMax / r)
    this.objetivo.y = this.suelo(this.objetivo.x, this.objetivo.z)
  }

  ir(objetivo, dist) {
    this.objetivo.set(objetivo[0], objetivo[1], objetivo[2])
    if (dist) this.dist = dist
  }

  // Lo mismo que `ir`, pero volando: un salto en seco desorienta (no se sabe
  // dónde quedó uno en la finca); un vuelo corto deja ver el camino.
  volar(objetivo, { dist = this.dist, elev = this.elev, azimut = this.azimut } = {}, segundos = 1.6) {
    this.vel.az = this.vel.el = 0
    // El giro va por el lado corto: de 350° a 10° son 20°, no 340°.
    const giro = Math.atan2(Math.sin(azimut - this.azimut), Math.cos(azimut - this.azimut))
    this._vuelo = {
      t: 0, segundos,
      de: { objetivo: this.objetivo.clone(), dist: this.dist, elev: this.elev, azimut: this.azimut },
      a: { objetivo: new THREE.Vector3(objetivo[0], objetivo[1], objetivo[2]), dist: THREE.MathUtils.clamp(dist, this.minDist, this.maxDist), elev: THREE.MathUtils.clamp(elev, this.minElev, this.maxElev), azimut: this.azimut + giro },
    }
  }

  actualizar(dt) {
    if (this._vuelo) {
      const v = this._vuelo
      v.t = Math.min(1, v.t + dt / v.segundos)
      const k = v.t * v.t * (3 - 2 * v.t) // arranca y frena suave
      this.objetivo.lerpVectors(v.de.objetivo, v.a.objetivo, k)
      // La distancia se interpola por proporción: de 100 m a 4 m, un vuelo
      // parejo en metros pasaría casi todo el tiempo lejos y caería de golpe.
      this.dist = v.de.dist * Math.pow(v.a.dist / v.de.dist, k)
      this.elev = v.de.elev + (v.a.elev - v.de.elev) * k
      this.azimut = v.de.azimut + (v.a.azimut - v.de.azimut) * k
      if (v.t >= 1) this._vuelo = null
    }
    if (this.punteros.size === 0 && (this.vel.az || this.vel.el)) {
      // Inercia: el giro sigue un momento después de soltar, como en los juegos.
      this.azimut += this.vel.az
      this.elev = THREE.MathUtils.clamp(this.elev + this.vel.el, this.minElev, this.maxElev)
      const amort = Math.pow(0.0025, dt)
      this.vel.az *= amort
      this.vel.el *= amort
      if (Math.abs(this.vel.az) < 1e-5) this.vel.az = 0
      if (Math.abs(this.vel.el) < 1e-5) this.vel.el = 0
    }
    const c = this.camara
    const ce = Math.cos(this.elev)
    c.position.set(
      this.objetivo.x + this.dist * ce * Math.sin(this.azimut),
      this.objetivo.y + this.dist * Math.sin(this.elev),
      this.objetivo.z + this.dist * ce * Math.cos(this.azimut)
    )
    // Nunca bajo la montaña: en una ladera, girar hacia arriba metería la cámara en el cerro.
    // De lejos se guardan 4 m; de cerca menos, o al acercarse al lombricultivo
    // la cámara quedaría mirando recto hacia abajo.
    const piso = this.suelo(c.position.x, c.position.z) + Math.min(4, Math.max(0.7, this.dist * 0.33))
    if (c.position.y < piso) c.position.y = piso
    c.lookAt(this.objetivo)
  }
}
