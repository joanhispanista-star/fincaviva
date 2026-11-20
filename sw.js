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

const ARCHIVOS = ["./","./app/app.js","./app/estilos.css","./app/fotos.js","./app/panorama.js","./app/pantallas/ajustes.js","./app/pantallas/anotar.js","./app/pantallas/aprende.js","./app/pantallas/calendario.js","./app/pantallas/construir.js","./app/pantallas/cuentas.js","./app/pantallas/escanear.js","./app/pantallas/finca.js","./app/pantallas/logros.js","./app/pantallas/precios.js","./app/pantallas/sistemas.js","./app/ui.js","./datos/clima-zona.json","./datos/energia.json","./datos/gallinas.json","./datos/legal-mercado.json","./datos/tecnicas-alimento.json","./datos/tecnicas-bosque.json","./datos/tecnicas-cultivo.json","./datos/tecnicas-energia.json","./datos/tecnicas-gallinas.json","./datos/tecnicas-suelo.json","./datos/terreno-ejemplo-paisaje.bin","./datos/terreno-ejemplo-paisaje.json","./datos/terreno-ejemplo.bin","./datos/terreno-ejemplo.json","./iconos/icono-180.png","./iconos/icono-192.png","./iconos/icono-512.png","./iconos/icono.svg","./index.html","./lib/almacen.js","./lib/demo.js","./lib/fechas.js","./lib/juego.js","./lib/libro.js","./lib/luna.js","./lib/modelo.js","./lib/precios.js","./lib/rebano.js","./lib/relieve-descarga.js","./lib/topografia.js","./manifest.webmanifest","./mapa/controles.js","./mapa/modelos.js","./mapa/mundo.js","./mapa/relieve-vivo.js","./mapa/relieve.js","./mapa/vida.js","./vendor/three/three.module.js"]
const CACHE = 'finca-viva-20261120-1638'

self.addEventListener('install', (e) => {
  self.skipWaiting()
  // addAll es todo o nada: si un archivo falla (se cayó la señal), no queda una
  // copia a medias y el navegador lo vuelve a intentar en la próxima visita.
  if (ARCHIVOS.length) e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const pet = e.request
  if (pet.method !== 'GET' || new URL(pet.url).origin !== self.location.origin) return
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
