// Fases de la luna calculadas en el teléfono, sin internet.
//
// Por qué calcularlas y no bajarlas de una página: la finca está en una ladera
// a 2.600 m donde la señal va y viene, y el calendario lunar es justo lo que el
// campesino consulta en el potrero. El algoritmo es el del capítulo 49 de
// Jean Meeus, «Astronomical Algorithms» (2.ª ed., 1998): error de menos de un
// minuto para cualquier año cercano, que sobra para sembrar.
//
// Honestidad: la app muestra la fase EXACTA (astronomía, comprobable) y aparte
// la TRADICIÓN campesina sobre qué sembrar en cada fase. Lo segundo no está
// demostrado por la ciencia; por eso la app propone comprobarlo en la propia
// finca con dos camas iguales sembradas en fases distintas.

const RAD = Math.PI / 180
const SINODICO = 29.530588861 // días entre dos lunas nuevas, en promedio

// ΔT = tiempo dinámico − tiempo universal. Meeus da los resultados en tiempo
// dinámico; la diferencia ronda 69 s en 2020-2030. Un error de segundos aquí
// no cambia ninguna decisión de siembra, por eso basta un valor fijo.
const DELTA_T_DIAS = 69 / 86400

export const FASES = ['nueva', 'creciente', 'llena', 'menguante']

export function aDiaJuliano(fecha) {
  return fecha.getTime() / 86400000 + 2440587.5
}

export function deDiaJuliano(jd) {
  return new Date(Math.round((jd - 2440587.5) * 86400000))
}

// JDE (tiempo dinámico) de la fase k. k entero = luna nueva; +0,25 cuarto
// creciente; +0,5 llena; +0,75 cuarto menguante. k = 0 es la luna nueva del
// 6 de enero de 2000.
export function jdeFase(k) {
  const T = k / 1236.85
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T
  const jde0 = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4
  const E = 1 - 0.002516 * T - 0.0000074 * T2
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD
  const s = Math.sin, c = Math.cos

  // La parte fraccionaria de k dice qué fase es; con k negativo, % da negativo.
  const fase = ((k % 1) + 1) % 1
  let corr
  if (fase < 0.01 || fase > 0.99 || Math.abs(fase - 0.5) < 0.01) {
    // Luna nueva y luna llena comparten términos; cambian los primeros coeficientes.
    const llena = Math.abs(fase - 0.5) < 0.01
    corr =
      (llena ? -0.40614 : -0.4072) * s(Mp) +
      (llena ? 0.17302 : 0.17241) * E * s(M) +
      (llena ? 0.01614 : 0.01608) * s(2 * Mp) +
      (llena ? 0.01043 : 0.01039) * s(2 * F) +
      (llena ? 0.00734 : 0.00739) * E * s(Mp - M) +
      (llena ? -0.00515 : -0.00514) * E * s(Mp + M) +
      (llena ? 0.00209 : 0.00208) * E * E * s(2 * M) -
      0.00111 * s(Mp - 2 * F) -
      0.00057 * s(Mp + 2 * F) +
      0.00056 * E * s(2 * Mp + M) -
      0.00042 * s(3 * Mp) +
      0.00042 * E * s(M + 2 * F) +
      0.00038 * E * s(M - 2 * F) -
      0.00024 * E * s(2 * Mp - M) -
      0.00017 * s(Om) -
      0.00007 * s(Mp + 2 * M) +
      0.00004 * s(2 * Mp - 2 * F) +
      0.00004 * s(3 * M) +
      0.00003 * s(Mp + M - 2 * F) +
      0.00003 * s(2 * Mp + 2 * F) -
      0.00003 * s(Mp + M + 2 * F) +
      0.00003 * s(Mp - M + 2 * F) -
      0.00002 * s(Mp - M - 2 * F) -
      0.00002 * s(3 * Mp + M) +
      0.00002 * s(4 * Mp)
  } else {
    corr =
      -0.62801 * s(Mp) +
      0.17172 * E * s(M) -
      0.01183 * E * s(Mp + M) +
      0.00862 * s(2 * Mp) +
      0.00804 * s(2 * F) +
      0.00454 * E * s(Mp - M) +
      0.00204 * E * E * s(2 * M) -
      0.0018 * s(Mp - 2 * F) -
      0.0007 * s(Mp + 2 * F) -
      0.0004 * s(3 * Mp) -
      0.00034 * E * s(2 * Mp - M) +
      0.00032 * E * s(M + 2 * F) +
      0.00032 * E * s(M - 2 * F) -
      0.00028 * E * E * s(Mp + 2 * M) +
      0.00027 * E * s(2 * Mp + M) -
      0.00017 * s(Om) -
      0.00005 * s(Mp - M - 2 * F) +
      0.00004 * s(2 * Mp + 2 * F) -
      0.00004 * s(Mp + M + 2 * F) +
      0.00004 * s(Mp - 2 * M) +
      0.00003 * s(Mp + M - 2 * F) +
      0.00003 * s(3 * M) +
      0.00002 * s(2 * Mp - 2 * F) +
      0.00002 * s(Mp - M + 2 * F) -
      0.00002 * s(3 * Mp + M)
    const W =
      0.00306 - 0.00038 * E * c(M) + 0.00026 * c(Mp) - 0.00002 * c(Mp - M) + 0.00002 * c(Mp + M) + 0.00002 * c(2 * F)
    corr += fase < 0.5 ? W : -W
  }

  // Correcciones planetarias, comunes a las cuatro fases.
  const A = [
    299.77 + 0.107408 * k - 0.009173 * T2,
    251.88 + 0.016321 * k,
    251.83 + 26.651886 * k,
    349.42 + 36.412478 * k,
    84.66 + 18.206239 * k,
    141.74 + 53.303771 * k,
    207.14 + 2.453732 * k,
    154.84 + 7.30686 * k,
    34.52 + 27.261239 * k,
    207.19 + 0.121824 * k,
    291.34 + 1.844379 * k,
    161.72 + 24.198154 * k,
    239.56 + 25.513099 * k,
    331.55 + 3.592518 * k,
  ]
  const COEF = [0.000325, 0.000165, 0.000164, 0.000126, 0.00011, 0.000062, 0.00006, 0.000056, 0.000047, 0.000042, 0.00004, 0.000037, 0.000035, 0.000023]
  let planetas = 0
  for (let i = 0; i < A.length; i++) planetas += COEF[i] * s(A[i] * RAD)

  return jde0 + corr + planetas
}

// Momento (Date, en UTC) de la fase k.
export function momentoFase(k) {
  return deDiaJuliano(jdeFase(k) - DELTA_T_DIAS)
}

function kAproximado(fecha) {
  // Año decimal → número de lunaciones desde enero de 2000 (Meeus 49.2).
  const anio = 2000 + (aDiaJuliano(fecha) - 2451545.0) / 365.25
  return (anio - 2000) * 12.3685
}

// Todas las fases exactas entre dos fechas (incluidas), en orden.
export function fasesEntre(desde, hasta) {
  const lista = []
  let k = Math.floor(kAproximado(desde)) - 1
  for (let guarda = 0; guarda < 2000; guarda++, k += 0.25) {
    const momento = momentoFase(k)
    if (momento > hasta) break
    if (momento >= desde) lista.push({ tipo: FASES[Math.round((((k % 1) + 1) % 1) * 4) % 4], fecha: momento })
  }
  return lista
}

// Luna nueva inmediatamente anterior (o igual) a la fecha.
function nuevaAnterior(fecha) {
  let k = Math.floor(kAproximado(fecha)) + 1
  while (momentoFase(k) > fecha) k -= 1
  return k
}

const EMOJIS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘']

// Estado de la luna en un momento: edad, iluminación, periodo y próxima fase.
export function estadoLuna(fecha = new Date()) {
  const k = nuevaAnterior(fecha)
  const nueva = momentoFase(k)
  const siguiente = momentoFase(k + 1)
  const edad = (fecha - nueva) / 86400000
  const fraccion = (fecha - nueva) / (siguiente - nueva) // 0 = nueva, 0,5 = llena
  // Aproximación por la fracción del ciclo: ±5 % por la excentricidad de la
  // órbita, suficiente para el dibujo; la fase exacta sale de las fechas de arriba.
  const iluminacion = (1 - Math.cos(2 * Math.PI * fraccion)) / 2

  // Fase con nombre: dentro de ±1 día de una fase exacta se nombra esa fase.
  const exactas = [0, 0.25, 0.5, 0.75, 1].map((d) => ({ d, momento: momentoFase(k + d) }))
  const cercana = exactas.find((e) => Math.abs(fecha - e.momento) <= 86400000)
  let nombre
  if (cercana) {
    nombre = ['Luna nueva', 'Cuarto creciente', 'Luna llena', 'Cuarto menguante', 'Luna nueva'][cercana.d * 4]
  } else {
    nombre = fraccion < 0.5 ? 'Creciente' : 'Menguante'
  }
  const proxima = exactas.find((e) => e.momento > fecha)

  return {
    edad_dias: edad,
    fraccion,
    iluminacion,
    // La tradición campesina divide el mes en dos: de nueva a llena «crece», de llena a nueva «mengua».
    periodo: fraccion < 0.5 ? 'creciente' : 'menguante',
    nombre,
    emoji: EMOJIS[Math.round(fraccion * 8) % 8],
    proxima: { tipo: FASES[(proxima.d * 4) % 4], fecha: proxima.momento },
    ciclo_dias: (siguiente - nueva) / 86400000,
  }
}

export { SINODICO }
