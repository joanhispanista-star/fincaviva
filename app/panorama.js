// El visor de una panorámica: las fotos tomadas alrededor de un punto (una cada
// 30°, con el rumbo que marcaba la brújula) se miran girando con el dedo o con
// las flechas. No es una sola foto cosida, y el visor no lo finge: dice cuántas
// fotos son y hacia dónde mira cada una.

import { nombreRumbo } from '../lib/topografia.js'
import { urlFoto } from './fotos.js'
import { esc } from './ui.js'

export async function abrirPanorama(sitio) {
  // Ordenadas por rumbo, como al girar hacia la derecha; las que no tienen rumbo
  // (se tomaron sin brújula) quedan en el orden en que se tomaron.
  const cuadros = [...(sitio.cuadros || [])].sort((a, b) => (a.rumbo ?? 1e9) - (b.rumbo ?? 1e9))
  const urls = await Promise.all(cuadros.map((c) => urlFoto(c.foto)))
  const velo = document.createElement('div')
  velo.className = 'velo pano'
  const cerrar = () => {
    urls.forEach((u) => u && URL.revokeObjectURL(u))
    removeEventListener('keydown', tecla)
    velo.remove()
  }
  if (!urls.some(Boolean)) {
    velo.innerHTML = `<div class="celebra"><div class="grande">📷</div><h2>${esc(sitio.nombre || 'Panorámica')}</h2><p class="suave">Las fotos de esta panorámica no están en este teléfono: las fotos no viajan en el respaldo.</p><button class="btn ancho" data-cerrar>Cerrar</button></div>`
    velo.querySelector('[data-cerrar]').addEventListener('click', cerrar)
    document.body.appendChild(velo)
    return
  }
  let i = Math.max(0, urls.findIndex(Boolean))
  velo.innerHTML = `<div class="pano-caja">
    <img alt="">
    <div class="pano-arriba"><b>${esc(sitio.nombre || 'Panorámica')}</b><button class="icono-btn" data-cerrar aria-label="Cerrar">✕</button></div>
    <button class="pano-flecha izq" data-paso="-1" aria-label="Girar a la izquierda">‹</button>
    <button class="pano-flecha der" data-paso="1" aria-label="Girar a la derecha">›</button>
    <div class="pano-abajo"><span data-rumbo></span><span class="suave" data-cuenta></span></div>
  </div>`
  const img = velo.querySelector('img')
  const pintar = () => {
    const c = cuadros[i]
    img.src = urls[i] || ''
    img.style.visibility = urls[i] ? '' : 'hidden'
    velo.querySelector('[data-rumbo]').textContent = c.rumbo == null ? 'Sin rumbo (tomada sin brújula)' : `Mirando al ${nombreRumbo(c.rumbo)} · ${Math.round(c.rumbo)}°`
    velo.querySelector('[data-cuenta]').textContent = `Foto ${i + 1} de ${cuadros.length}`
  }
  const girar = (paso) => { i = (i + paso + cuadros.length) % cuadros.length; pintar() }
  const tecla = (e) => { if (e.key === 'ArrowLeft') girar(-1); else if (e.key === 'ArrowRight') girar(1); else if (e.key === 'Escape') cerrar() }
  velo.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) return cerrar()
    const b = e.target.closest('[data-paso]')
    if (b) girar(Number(b.dataset.paso))
  })
  // Arrastrar con el dedo: hacia la izquierda se gira a la derecha, como al mirar alrededor.
  let x0 = null
  img.addEventListener('pointerdown', (e) => { x0 = e.clientX })
  img.addEventListener('pointerup', (e) => {
    if (x0 == null) return
    const dx = e.clientX - x0
    x0 = null
    if (Math.abs(dx) > 35) girar(dx < 0 ? 1 : -1)
  })
  addEventListener('keydown', tecla)
  document.body.appendChild(velo)
  pintar()
}
