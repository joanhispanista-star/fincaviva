// Trabajador de fondo: que la app abra en la montaña sin señal.
//
// Primero la red (con 4 s de paciencia) y si no hay, lo guardado. Al revés
// (primero lo guardado) la app abriría más rápido pero mezclaría archivos de
// versiones distintas después de cada publicación, y eso rompe los módulos.
// Las fotos satelitales y el relieve (de otro dominio) no se guardan aquí: el
// relieve de la finca lo guarda la app en el teléfono (mapa/relieve-vivo.js).
//
// Al instalarse guarda TODA la app de una vez (la lista y la versión las
// escribe herramientas/publicar.mjs al publicar). Antes cada pantalla quedaba
// guardada solo después de abrirla con señal, y Escanear se usa justo donde no
// la hay: en la finca.

const ARCHIVOS = ["./","./app/app.js","./app/estilos.css","./app/fotos.js","./app/panorama.js","./app/pantallas/ajustes.js","./app/pantallas/anotar.js","./app/pantallas/aprende.js","./app/pantallas/calendario.js","./app/pantallas/construir.js","./app/pantallas/cuentas.js","./app/pantallas/escanear.js","./app/pantallas/finca.js","./app/pantallas/logros.js","./app/pantallas/niveles.js","./app/pantallas/precios.js","./app/pantallas/sistemas.js","./app/ui.js","./datos/clima-zona.json","./datos/energia.json","./datos/gallinas.json","./datos/legal-mercado.json","./datos/niveles.json","./datos/tecnicas-alimento.json","./datos/tecnicas-bosque.json","./datos/tecnicas-cultivo.json","./datos/tecnicas-energia.json","./datos/tecnicas-gallinas.json","./datos/tecnicas-suelo.json","./datos/terreno-ejemplo-paisaje.bin","./datos/terreno-ejemplo-paisaje.json","./datos/terreno-ejemplo.bin","./datos/terreno-ejemplo.json","./iconos/icono-180.png","./iconos/icono-192.png","./iconos/icono-512.png","./iconos/icono.svg","./index.html","./lib/almacen.js","./lib/demo.js","./lib/fechas.js","./lib/graficos.js","./lib/imagenes-guardadas.js","./lib/juego.js","./lib/libro.js","./lib/luna.js","./lib/modelo.js","./lib/niveles.js","./lib/precios.js","./lib/rebano.js","./lib/relieve-descarga.js","./lib/topografia.js","./manifest.webmanifest","./mapa/controles.js","./mapa/modelos.js","./mapa/modelos3d.js","./mapa/mundo.js","./mapa/realista.js","./mapa/relieve-vivo.js","./mapa/relieve.js","./mapa/vida.js","./vendor/three/three.module.js"]
const CACHE = 'finca-viva-20261124-1658'

// Las imágenes del mapa con gráficos realistas (mapa/texturas/ y los modelos de
// mapa/modelos3d/, unos 3 MB) son
// la excepción a las dos reglas de arriba, y van en su propia caja:
//  · No entran en la instalación. Es todo o nada (addAll): con 3 MB más, una
//    señal floja la haría fallar entera y se perdería lo que de verdad hace
//    falta en la finca, que Escanear abra sin internet. Las fotos son un
//    adorno: bajan cuando se abre el mapa (desde el 24-nov los realistas son
//    lo normal) y, si no alcanzan a llegar, el mapa se dibuja sin ellas.
//  · Primero lo guardado. Se bajan la primera vez que el mapa las pide y de
//    ahí en adelante salen del teléfono sin tocar la red: son 3 MB de datos
//    que no se gastan en cada visita. No mezclan versiones, porque la caja se
//    llama como la huella de las fotos (la escribe publicar.mjs): sobrevive a
//    cada publicación y solo se vuelven a bajar si las fotos cambian.
const FOTOS = 'finca-viva-fotos-5479655024b0'
// Cuáles son (la escribe publicar.mjs). Solo se usa cuando la página avisa que
// el mapa las necesita: ver `guardarImagenes`.
const IMAGENES = ["./mapa/modelos3d/casa.bin","./mapa/modelos3d/gallina.bin","./mapa/modelos3d/galpon.bin","./mapa/modelos3d/modelos3d.json","./mapa/modelos3d/vaca.bin","./mapa/texturas/camino.webp","./mapa/texturas/concreto.webp","./mapa/texturas/ia_aliso.webp","./mapa/texturas/ia_arado.webp","./mapa/texturas/ia_arrayan.webp","./mapa/texturas/ia_arveja.webp","./mapa/texturas/ia_cielo.webp","./mapa/texturas/ia_diente_leon.webp","./mapa/texturas/ia_encenillo.webp","./mapa/texturas/ia_eucalipto.webp","./mapa/texturas/ia_frutal.webp","./mapa/texturas/ia_helecho.webp","./mapa/texturas/ia_kikuyo.webp","./mapa/texturas/ia_lechuga.webp","./mapa/texturas/ia_lupino.webp","./mapa/texturas/ia_m_casa.webp","./mapa/texturas/ia_m_gallina.webp","./mapa/texturas/ia_m_galpon.webp","./mapa/texturas/ia_m_vaca.webp","./mapa/texturas/ia_maiz.webp","./mapa/texturas/ia_monte.webp","./mapa/texturas/ia_pasto.webp","./mapa/texturas/ia_pasto_alto.webp","./mapa/texturas/ia_pino.webp","./mapa/texturas/ia_potrero.webp","./mapa/texturas/ia_repollo.webp","./mapa/texturas/ia_roble.webp","./mapa/texturas/ia_seco.webp","./mapa/texturas/ia_sietecueros.webp","./mapa/texturas/ia_trebol.webp","./mapa/texturas/madera.webp","./mapa/texturas/paja.webp","./mapa/texturas/pared.webp","./mapa/texturas/texturas.json","./mapa/texturas/tierra.webp","./mapa/texturas/zinc.webp"]
const esFoto = (url) => /\/mapa\/(texturas|modelos3d)\//.test(url.pathname)

self.addEventListener('install', (e) => {
  self.skipWaiting()
  // addAll es todo o nada: si un archivo falla (se cayó la señal), no queda una
  // copia a medias y el navegador lo vuelve a intentar en la próxima visita.
  if (ARCHIVOS.length) e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== FOTOS).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

// La página avisa (lib/imagenes-guardadas.js) que el mapa usa las imágenes: se
// bajan las que falten. Hace falta porque en la primera visita el mapa las pide
// antes de que este trabajador tome el mando, y esas descargas no pasan por aquí.
// De a una y sin afán: casi todas salen de la copia que el navegador acaba de
// bajar, y con mala señal no le quitan ancho a lo que la persona está haciendo.
let guardando = null
function guardarImagenes() {
  guardando ||= (async () => {
    const caja = await caches.open(FOTOS)
    for (const ruta of IMAGENES) {
      const url = new URL(ruta, self.location.href).href
      if (await caja.match(url)) continue
      const resp = await fetch(url)
      if (resp.ok) await caja.put(url, resp)
    }
  })()
    // Sin señal se corta ahí: lo que alcanzó a bajar queda, y la próxima vez que
    // se abra el mapa sigue con lo que falte.
    .catch(() => {})
    .finally(() => { guardando = null })
  return guardando
}
self.addEventListener('message', (e) => {
  if (e.data?.tipo === 'guardar-imagenes') e.waitUntil(guardarImagenes())
})

self.addEventListener('fetch', (e) => {
  const pet = e.request
  const url = new URL(pet.url)
  if (pet.method !== 'GET' || url.origin !== self.location.origin) return
  if (esFoto(url)) {
    e.respondWith(
      (async () => {
        const caja = await caches.open(FOTOS)
        const guardada = await caja.match(pet)
        if (guardada) return guardada
        // Sin los 4 s de paciencia: con mala señal una foto de 300 KB tarda
        // más, y cortarla sería no llegar a guardarla nunca. El mapa no se
        // queda esperando (mapa/realista.js se dibuja sin fotos a los 7 s);
        // la descarga termina aquí y queda lista para la próxima vez.
        const resp = await fetch(pet)
        if (resp.ok) await caja.put(pet, resp.clone())
        return resp
      })(),
    )
    return
  }
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const resp = await Promise.race([fetch(pet), new Promise((_, mal) => setTimeout(() => mal(new Error('lento')), 4000))])
        if (resp.ok) cache.put(pet, resp.clone())
        return resp
      } catch {
        const guardada = await cache.match(pet, { ignoreSearch: true })
        if (guardada) return guardada
        if (pet.mode === 'navigate') {
          const inicio = await cache.match('./index.html') || await cache.match('./')
          if (inicio) return inicio
        }
        return new Response('Sin conexión y sin copia guardada de este archivo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    })(),
  )
})
