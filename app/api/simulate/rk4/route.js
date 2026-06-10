/**
 * API Route Handler: Simulasi Konveyor Adaptif
 * Metode Midpoint (RK2) & Runge-Kutta Orde 4 (Reduksi Simpson 1/3)
 *
 * ═══════════════════════════════════════════════════════════════
 * MODEL MATEMATIKA
 * ═══════════════════════════════════════════════════════════════
 *
 * Laju kedatangan barang kumulatif (N) pada konveyor:
 *
 *   dN/dt = 1000 / (20·u(t) − 1000)
 *
 * Di mana u(t) adalah sinyal PWM yang dihitung dari pemetaan
 * mikrokontroler Arduino:
 *
 *   u(t) = map(interval(t), Interval_Min, Interval_Max, PWM_Min, PWM_Max)
 *
 * Fungsi map Arduino:
 *   map(x, in_min, in_max, out_min, out_max)
 *     = (x − in_min) × (out_max − out_min) / (in_max − in_min) + out_min
 *
 * ═══════════════════════════════════════════════════════════════
 * CATATAN PENTING — Reduksi RK4
 * ═══════════════════════════════════════════════════════════════
 *
 * Karena dN/dt TIDAK bergantung pada variabel keadaan N
 * (hanya bergantung pada u(t)), maka pada RK4:
 *
 *   k1 = f(u(t_i))
 *   k2 = f(u(t_i + h/2))   ← dievaluasi di titik tengah
 *   k3 = f(u(t_i + h/2))   ← SAMA dengan k2
 *   k4 = f(u(t_{i+1}))
 *
 * Sehingga:
 *   N_{i+1} = N_i + h/6 · (k1 + 2·k2 + 2·k3 + k4)
 *           = N_i + h/6 · (k1 + 4·k2 + k4)
 *
 * Ini identik dengan **Aturan Simpson 1/3** untuk integrasi numerik.
 *
 * ═══════════════════════════════════════════════════════════════
 * ENDPOINT
 * ═══════════════════════════════════════════════════════════════
 *
 * POST /api/simulate/rk4
 *
 * Request JSON:
 *   {
 *     pwm_min, pwm_max, interval_min, interval_max,
 *     time_data, interval_data
 *   }
 *
 * Response JSON:
 *   {
 *     success: true,
 *     data: {
 *       time: [...],
 *       n_rk4: [...],
 *       n_midpoint: [...],
 *       pwm_computed: [...],
 *       dndt_values: [...]
 *     },
 *     parameters: { pwm_min, pwm_max, interval_min, interval_max }
 *   }
 */

import { NextResponse } from "next/server";

// ─── Fungsi map() Arduino ────────────────────────────────────
/**
 * Mereplikasi fungsi map() bawaan Arduino/mikrokontroler.
 * @param {number} x        - Nilai input
 * @param {number} inMin    - Batas bawah input
 * @param {number} inMax    - Batas atas input
 * @param {number} outMin   - Batas bawah output
 * @param {number} outMax   - Batas atas output
 * @returns {number} Nilai output terpetakan
 */
function arduinoMap(x, inMin, inMax, outMin, outMax) {
  return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// ─── Fungsi Turunan dN/dt ────────────────────────────────────
/**
 * Menghitung laju kedatangan barang: dN/dt = 1000 / (20·u − 1000)
 * @param {number} u - Nilai PWM pada waktu t
 * @returns {number} Laju perubahan N
 */
function dNdt(u) {
  const denominator = 20 * u - 1000;
  // Guard: hindari pembagian nol atau denominator negatif
  if (Math.abs(denominator) < 1e-10) {
    return 0;
  }
  return 1000 / denominator;
}

// ─── PWM Lookup (Zero-Order Hold) ────────────────────────────
/**
 * Menghitung nilai PWM pada waktu t menggunakan Zero-Order Hold.
 * 1. Cari interval sensor terakhir yang berlaku pada waktu t
 * 2. Petakan interval → PWM menggunakan fungsi map Arduino
 *
 * @param {number} t             - Waktu saat ini
 * @param {number[]} timeData    - Array titik waktu eksperimen
 * @param {number[]} intervalData - Array interval sensor (ms)
 * @param {object} params        - Parameter kalibrasi
 * @returns {number} Nilai PWM pada waktu t
 */
function getPWMZOH(t, timeData, intervalData, params) {
  let idx = 0;
  for (let i = 0; i < timeData.length; i++) {
    if (timeData[i] <= t) {
      idx = i;
    } else {
      break;
    }
  }
  const interval = intervalData[idx];
  return arduinoMap(
    interval,
    params.intervalMin,
    params.intervalMax,
    params.pwmMin,
    params.pwmMax
  );
}

// ─── PWM Lookup (Linear Interpolation) ────────────────────────
function getPWMLinear(t, timeData, intervalData, params) {
  if (t <= timeData[0]) return getPWMZOH(timeData[0], timeData, intervalData, params);
  if (t >= timeData[timeData.length - 1]) return getPWMZOH(timeData[timeData.length - 1], timeData, intervalData, params);

  let idx = 0;
  for (let i = 0; i < timeData.length - 1; i++) {
    if (t >= timeData[i] && t <= timeData[i + 1]) {
      idx = i;
      break;
    }
  }
  
  const t1 = timeData[idx];
  const t2 = timeData[idx + 1];
  const u1 = getPWMZOH(t1, timeData, intervalData, params);
  const u2 = getPWMZOH(t2, timeData, intervalData, params);

  if (t2 === t1) return u1;
  return u1 + ((u2 - u1) * (t - t1)) / (t2 - t1);
}

// ─── Simulasi RK4 (Reduksi Simpson 1/3) ─────────────────────
/**
 * Karena dN/dt tidak bergantung pada N, RK4 tereduksi menjadi
 * Aturan Simpson 1/3:
 *
 *   k1 = f(u(t_i))
 *   k2 = k3 = f(u(t_i + h/2))    ← gradien di titik tengah
 *   k4 = f(u(t_{i+1}))
 *
 *   N_{i+1} = N_i + h/6 · (k1 + 4·k2 + k4)
 */
function simulateRK4(timeData, intervalData, params, initial_n = 0, interpMode = "zoh") {
  const n = timeData.length;
  const N = new Array(n);
  const dndtValues = new Array(n);
  const pwmValues = new Array(n);
  const getU = interpMode === "linear" ? getPWMLinear : getPWMZOH;

  N[0] = initial_n; // Kondisi awal: N(t0) = initial_n

  // Hitung PWM dan dN/dt pada setiap titik waktu
  for (let i = 0; i < n; i++) {
    pwmValues[i] = getPWMZOH(timeData[i], timeData, intervalData, params); // Output utama tetap raw ZOH di tabel
    dndtValues[i] = dNdt(pwmValues[i]);
  }

  for (let i = 0; i < n - 1; i++) {
    const h = timeData[i + 1] - timeData[i];
    const t_i = timeData[i];

    // Evaluasi u(t) di tiga titik: awal, tengah, akhir
    const u_start = getU(t_i, timeData, intervalData, params);
    const u_mid = getU(t_i + h / 2, timeData, intervalData, params);
    const u_end = getU(t_i + h, timeData, intervalData, params);

    // Gradien RK4 (k2 = k3 karena f tidak bergantung pada N)
    const k1 = dNdt(u_start);
    const k2 = dNdt(u_mid); // = k3 (Simpson 1/3)
    const k4 = dNdt(u_end);

    // Aturan Simpson 1/3
    N[i + 1] = N[i] + (h / 6) * (k1 + 4 * k2 + k4);
  }

  return {
    time: timeData,
    n_rk4: N.map((val) => parseFloat(val.toFixed(6))),
    pwm_computed: pwmValues.map((val) => parseFloat(val.toFixed(2))),
    dndt_values: dndtValues.map((val) => parseFloat(val.toFixed(6))),
  };
}

// ─── Simulasi Midpoint (RK2) ─────────────────────────────────
/**
 * Metode Midpoint:
 *   k1 = f(u(t_i))           ← (opsional, untuk referensi)
 *   k2 = f(u(t_i + h/2))     ← gradien di titik tengah
 *
 *   N_{i+1} = N_i + h · k2
 */
function simulateMidpoint(timeData, intervalData, params, initial_n = 0, interpMode = "zoh") {
  const n = timeData.length;
  const N = new Array(n);
  const getU = interpMode === "linear" ? getPWMLinear : getPWMZOH;

  N[0] = initial_n;

  for (let i = 0; i < n - 1; i++) {
    const h = timeData[i + 1] - timeData[i];
    const t_i = timeData[i];

    const u_mid = getU(t_i + h / 2, timeData, intervalData, params);
    const k2 = dNdt(u_mid);

    N[i + 1] = N[i] + h * k2;
  }

  return {
    n_midpoint: N.map((val) => parseFloat(val.toFixed(6))),
  };
}

// ═══════════════════════════════════════════════════════════════
// POST Handler
// ═══════════════════════════════════════════════════════════════
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      pwm_min = 60,
      pwm_max = 200,
      interval_min = 200,
      interval_max = 3000,
      initial_n = 0,
      interp_mode = "zoh",
      time_data,
      interval_data,
    } = body;

    // ── Validasi Input ──────────────────────────────────────
    if (
      !Array.isArray(time_data) ||
      !Array.isArray(interval_data) ||
      time_data.length === 0
    ) {
      return NextResponse.json(
        { error: "time_data dan interval_data harus berupa array non-kosong." },
        { status: 400 }
      );
    }

    if (time_data.length !== interval_data.length) {
      return NextResponse.json(
        { error: "Panjang time_data dan interval_data harus sama." },
        { status: 400 }
      );
    }

    if (interval_max <= interval_min) {
      return NextResponse.json(
        { error: "Interval_Max harus lebih besar dari Interval_Min." },
        { status: 400 }
      );
    }

    if (pwm_max <= pwm_min) {
      return NextResponse.json(
        { error: "PWM_Max harus lebih besar dari PWM_Min." },
        { status: 400 }
      );
    }

    // ── Siapkan Parameter ───────────────────────────────────
    const params = {
      pwmMin: parseFloat(pwm_min),
      pwmMax: parseFloat(pwm_max),
      intervalMin: parseFloat(interval_min),
      intervalMax: parseFloat(interval_max),
    };

    const tData = time_data.map(Number);
    const iData = interval_data.map(Number);

    // ── Jalankan Kedua Simulasi ─────────────────────────────
    const rk4Result = simulateRK4(tData, iData, params, initial_n, interp_mode);
    const midpointResult = simulateMidpoint(tData, iData, params, initial_n, interp_mode);

    return NextResponse.json({
      success: true,
      data: {
        time: rk4Result.time,
        n_rk4: rk4Result.n_rk4,
        n_midpoint: midpointResult.n_midpoint,
        pwm_computed: rk4Result.pwm_computed,
        dndt_values: rk4Result.dndt_values,
      },
      parameters: params,
    });
  } catch (err) {
    console.error("Simulation error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat komputasi: " + err.message },
      { status: 500 }
    );
  }
}
