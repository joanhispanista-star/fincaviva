// Dónde vive la finca dentro del teléfono.
//
// IndexedDB y no localStorage: localStorage tiene un techo de unos 5 MB y
// congela la pantalla al guardar. Un año de registros diarios cabe de sobra aquí.
//
// Trampa de Safari (la app se usa sobre todo en iPhone): si la app NO está instalada en la pantalla
// de inicio, Safari borra lo guardado por un sitio que no se abre en 7 días. Por
// eso la app hace tres cosas, y ninguna sobra: pide almacenamiento persistente,
// insiste en instalarse y ofrece el respaldo en archivo.
//
// Se guarda el estado entero como un solo documento. Para una finca son pocos
// cientos de KB al año, y guardarlo todo de una vez hace imposible quedar a
// medias (una venta guardada sin su inventario, por ejemplo).

import { estadoVacio, COLECCIONES, AJUSTES_INICIALES } from './modelo.js'

const BASE = 'finca-viva'
const ALMACEN = 'documentos'
const CLAVE = 'estado'
export const VERSION_RESPALDO = 1

let db = null
// Si el navegador no deja usar IndexedDB (modo privado viejo, permisos), la
// finca vive en memoria y la interfaz lo dice: al cerrar se pierde.
let memoria = null

function abrir() {
  if (db) return Promise.resolve(db)
  return new Promise((ok, mal) => {
    if (typeof indexedDB === 'undefined') return mal(new Error('Este navegador no tiene IndexedDB'))
    const pet = indexedDB.open(BASE, 1)
    pet.onupgradeneeded = () => pet.result.createObjectStore(ALMACEN)
    pet.onsuccess = () => {
      db = pet.result
      // Si otra pestaña actualiza la base, esta suelta la conexión en vez de bloquearla.
      db.onversionchange = () => { db.close(); db = null }
      ok(db)
    }
    pet.onerror = () => mal(pet.error)
    pet.onblocked = () => mal(new Error('La finca está abierta en otra pestaña'))
  })
}

// Completa lo que le falte a un estado viejo o importado: colecciones nuevas,
// ajustes nuevos. Así una versión nueva de la app abre datos de la anterior.
export function normalizar(e) {
  const base = estadoVacio()
  const out = { ...base, ...(e || {}) }
  out.ajustes = { ...AJUSTES_INICIALES, ...((e && e.ajustes) || {}) }
  for (const c of COLECCIONES) if (!Array.isArray(out[c])) out[c] = []
  return out
}

export async function cargar() {
  try {
    const base = await abrir()
    const valor = await new Promise((ok, mal) => {
      const pet = base.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(CLAVE)
      pet.onsuccess = () => ok(pet.result)
      pet.onerror = () => mal(pet.error)
    })
    return { estado: valor ? normalizar(valor) : null, persistente: true }
  } catch {
    return { estado: memoria, persistente: false }
  }
}

export async function guardar(estado) {
  try {
    const base = await abrir()
    await new Promise((ok, mal) => {
      const tx = base.transaction(ALMACEN, 'readwrite')
      tx.objectStore(ALMACEN).put(estado, CLAVE)
      tx.oncomplete = () => ok()
      tx.onerror = () => mal(tx.error)
      tx.onabort = () => mal(tx.error || new Error('Guardado cancelado'))
    })
    return true
  } catch {
    memoria = estado
    return false
  }
}

export async function borrarTodo() {
  memoria = null
  aparte.clear()
  try {
    const base = await abrir()
    await new Promise((ok, mal) => {
      const tx = base.transaction(ALMACEN, 'readwrite')
      // Todo el almacén, no solo el estado: «borrar todos los datos» incluye las
      // fotos del escáner y el relieve bajado.
      tx.objectStore(ALMACEN).clear()
      tx.oncomplete = () => ok()
      tx.onerror = () => mal(tx.error)
    })
  } catch {
    // Sin base no hay nada que borrar.
  }
}

// ---------- Documentos aparte: las fotos del escáner y el relieve de la finca ----------
// Van fuera del estado porque pesan (una panorámica son unos 2 MB) y el estado se
// reescribe entero en cada guardado. NO viajan en el respaldo JSON, y Ajustes lo
// dice. Las fotos se guardan como bytes (ArrayBuffer) y no como Blob: Safari ha
// tenido versiones que perdían los Blob guardados en IndexedDB.
const aparte = new Map() // respaldo en memoria si el navegador no deja usar IndexedDB

async function conAlmacen(modo, fn) {
  const base = await abrir()
  return new Promise((ok, mal) => {
    const tx = base.transaction(ALMACEN, modo)
    const pet = fn(tx.objectStore(ALMACEN))
    tx.oncomplete = () => ok(pet?.result)
    tx.onerror = () => mal(tx.error)
    tx.onabort = () => mal(tx.error || new Error('Guardado cancelado'))
  })
}

export async function guardarAparte(clave, valor) {
  if (clave === CLAVE) throw new Error('Esa clave es la del estado')
  try {
    await conAlmacen('readwrite', (a) => a.put(valor, clave))
    return true
  } catch {
    aparte.set(clave, valor)
    return false
  }
}

export async function leerAparte(clave) {
  try {
    return (await conAlmacen('readonly', (a) => a.get(clave))) ?? aparte.get(clave) ?? null
  } catch {
    return aparte.get(clave) ?? null
  }
}

export async function borrarAparte(clave) {
  aparte.delete(clave)
  if (clave === CLAVE) return
  try { await conAlmacen('readwrite', (a) => a.delete(clave)) } catch { /* sin base no hay nada que borrar */ }
}

// Las claves que empiezan por un prefijo («foto:»), para borrar lo que quedó suelto.
export async function clavesAparte(prefijo = '') {
  let claves = [...aparte.keys()]
  try { claves = [...new Set([...claves, ...(await conAlmacen('readonly', (a) => a.getAllKeys()))])] } catch { /* solo las de memoria */ }
  return claves.filter((k) => typeof k === 'string' && k !== CLAVE && k.startsWith(prefijo))
}

// Pide que el navegador no borre la finca para hacer espacio. Safari lo concede
// cuando la app está instalada; Chrome, según el uso. Devuelve si quedó persistente.
export async function pedirPersistencia() {
  try {
    if (!globalThis.navigator?.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

// ---------- Respaldo en archivo ----------
// El archivo dice qué es y de qué versión: un JSON cualquiera no se importa.
export function aRespaldo(estado, ahora = new Date()) {
  return JSON.stringify({ app: 'finca-viva', version: VERSION_RESPALDO, exportado: ahora.toISOString(), estado })
}

export function deRespaldo(texto) {
  let datos
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new Error('Ese archivo no es un respaldo de Finca Viva: no se puede leer.')
  }
  if (!datos || datos.app !== 'finca-viva' || typeof datos.estado !== 'object' || !datos.estado) {
    throw new Error('Ese archivo no es un respaldo de Finca Viva.')
  }
  if (datos.version > VERSION_RESPALDO) {
    throw new Error('El respaldo viene de una versión más nueva de la app. Actualiza la app y vuelve a intentarlo.')
  }
  return normalizar(datos.estado)
}
