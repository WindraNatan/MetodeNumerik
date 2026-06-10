"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend } from "chart.js";
import { Line } from "react-chartjs-2";

// ── Register Chart.js modules ──────────────────────────────
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

// ════════════════════════════════════════════════════════════
// DATA EKSPERIMEN RIIL — Sensor Konveyor Adaptif (Arduino)
// ════════════════════════════════════════════════════════════
// Data diambil langsung dari Serial Monitor Arduino.
// Setiap percobaan mencatat: waktu deteksi (s), nilai PWM
// dari fungsi map(), dan jumlah barang kumulatif.
//
// Interval sensor di-reverse dari PWM menggunakan rumus invers:
//   interval = (PWM - PWM_Min) * (I_Max - I_Min) / (PWM_Max - PWM_Min) + I_Min
//            = (PWM - 60) * 20 + 200
// ════════════════════════════════════════════════════════════

/**
 * Helper: hitung interval dari PWM (inverse Arduino map)
 * map(interval, 200, 3000, 60, 200) → inverse:
 * interval = (pwm - 60) * (3000 - 200) / (200 - 60) + 200
 */
function pwmToInterval(pwm, pMin = 60, pMax = 200, iMin = 200, iMax = 3000) {
  return ((pwm - pMin) * (iMax - iMin)) / (pMax - pMin) + iMin;
}

/** Normalisasi waktu agar mulai dari t=0 */
function normalizeTime(timeArr) {
  const t0 = timeArr[0];
  return timeArr.map((t) => parseFloat((t - t0).toFixed(3)));
}

const EXPERIMENTS = [
  {
    name: "Percobaan 1",
    rawTime: [5.721, 6.721, 7.721, 9.281, 10.334, 11.834, 13.334, 14.334, 16.834, 19.335, 21.335, 23.335, 25.335],
    pwm: [109, 122, 122, 99, 105, 113, 118, 106, 167, 159, 145, 145, 145],
    count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  },
  {
    name: "Percobaan 2",
    rawTime: [5.221, 6.221, 7.221, 8.229, 9.729, 10.729, 12.229, 13.229, 14.729, 16.729, 18.729, 20.729, 22.73, 24.73],
    pwm: [200, 101, 120, 109, 105, 113, 116, 107, 116, 156, 154, 142, 141, 154],
    count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  {
    name: "Percobaan 3",
    rawTime: [5.221, 6.221, 7.221, 8.721, 9.734, 11.234, 12.234, 13.734, 14.734, 15.734, 17.234, 19.253, 21.307, 23.808, 25.808],
    pwm: [113, 110, 109, 105, 114, 107, 115, 126, 95, 95, 167, 115, 124, 151, 151],
    count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  },
  {
    name: "Percobaan 4",
    rawTime: [5.221, 6.721, 8.221, 9.721, 10.721, 11.722, 12.722, 13.722, 14.722, 15.722, 18.222, 20.222, 22.222, 24.223],
    pwm: [106, 105, 103, 118, 89, 109, 115, 115, 115, 200, 156, 149, 150, 146],
    count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  {
    name: "Percobaan 5",
    rawTime: [4.721, 5.721, 6.721, 7.721, 8.721, 9.721, 10.721, 12.222, 13.722, 16.222, 18.222, 20.222, 22.722, 24.723],
    pwm: [103, 104, 104, 104, 104, 184, 109, 124, 110, 177, 154, 146, 147, 139],
    count: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  {
    name: "Tanpa Data Percobaan",
    rawTime: Array.from({ length: 61 }, (_, i) => i * 0.5),
    pwm: Array.from({ length: 61 }, (_, i) => Math.round(60 + (i / 60) * 140)), // 60 -> 200
    count: [],
  },
];

// Pre-compute: hitung interval untuk setiap percobaan
EXPERIMENTS.forEach((exp) => {
  exp.time = exp.rawTime; // Menggunakan waktu asli tanpa dinormalisasi ke 0
  exp.interval = exp.pwm.map((p) => pwmToInterval(p));
});

// ── Default parameter kalibrasi Arduino ─────────────────────
const DEFAULTS = {
  pwmMin: 60,
  pwmMax: 200,
  intervalMin: 200,
  intervalMax: 3000,
};

// ════════════════════════════════════════════════════════════
// Komponen StatCard
// ════════════════════════════════════════════════════════════
function StatCard({ label, value, unit, icon, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__content">
        <span className="stat-card__value">
          {value}
          <small>{unit}</small>
        </span>
        <span className="stat-card__label">{label}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Komponen InputField (slider + number)
// ════════════════════════════════════════════════════════════
function ParamInput({ id, label, symbol, value, onChange, min, max, step }) {
  return (
    <div className="control-group" id={`control-${id}`}>
      <label className="control-label" htmlFor={`slider-${id}`}>
        <span>{label}</span>
        <code className="control-symbol">{symbol}</code>
      </label>
      <div className="slider-row">
        <input id={`slider-${id}`} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="slider" />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || min)} className="number-input" id={`input-${id}`} />
      </div>
      <div className="slider-range">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Halaman Dashboard Utama
// ════════════════════════════════════════════════════════════
export default function Home() {
  // ── State: parameter kalibrasi Arduino ──────────────────
  const [pwmMin, setPwmMin] = useState(DEFAULTS.pwmMin);
  const [pwmMax, setPwmMax] = useState(DEFAULTS.pwmMax);
  const [intervalMin, setIntervalMin] = useState(DEFAULTS.intervalMin);
  const [intervalMax, setIntervalMax] = useState(DEFAULTS.intervalMax);

  // ── State: percobaan yang dipilih ──────────────────────
  const [selectedExp, setSelectedExp] = useState(0);
  const currentExp = EXPERIMENTS[selectedExp];
  const [interpMode, setInterpMode] = useState("linear");

  // ── State: hasil simulasi ───────────────────────────────
  const [simData, setSimData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fungsi fetch simulasi ke API ────────────────────────
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);

    const exp = EXPERIMENTS[selectedExp];

    try {
      const res = await fetch("/api/simulate/rk4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pwm_min: pwmMin,
          pwm_max: pwmMax,
          interval_min: intervalMin,
          interval_max: intervalMax,
          initial_n: exp.count.length > 0 ? exp.count[0] : 0,
          interp_mode: interpMode,
          time_data: exp.time,
          interval_data: exp.interval,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menjalankan simulasi");

      setSimData(json.data);
    } catch (err) {
      setError(err.message);
      console.error("Simulation error:", err);
    } finally {
      setLoading(false);
    }
  }, [pwmMin, pwmMax, intervalMin, intervalMax, selectedExp, interpMode]);

  // ── Auto-run simulasi saat dropdown data / mode berubah ───
  useEffect(() => {
    runSimulation();
  }, [selectedExp, interpMode]); // Hapus 'runSimulation' dari deps agar tidak rerender saat ngetik manual di input angka

  // ── Hitung statistik dari hasil simulasi ────────────────
  const stats = useMemo(() => {
    if (!simData) return null;

    const exp = EXPERIMENTS[selectedExp];
    const nRk4Final = simData.n_rk4[simData.n_rk4.length - 1];
    const nMidFinal = simData.n_midpoint[simData.n_midpoint.length - 1];
    const nActual = exp.count.length > 0 ? exp.count[exp.count.length - 1] : "-";
    const maxDndt = Math.max(...simData.dndt_values);

    // Selisih absolut maks antara RK4 dan Midpoint
    let maxDiff = 0;
    let sumErrRk4 = 0;
    let sumErrMid = 0;
    let countErr = 0;

    for (let i = 0; i < simData.n_rk4.length; i++) {
      const diff = Math.abs(simData.n_rk4[i] - simData.n_midpoint[i]);
      if (diff > maxDiff) maxDiff = diff;

      if (exp.count[i] !== undefined) {
        sumErrRk4 += Math.abs(simData.n_rk4[i] - exp.count[i]);
        sumErrMid += Math.abs(simData.n_midpoint[i] - exp.count[i]);
        countErr++;
      }
    }

    const maeRk4 = countErr > 0 ? (sumErrRk4 / countErr).toFixed(6) : "-";
    const maeMid = countErr > 0 ? (sumErrMid / countErr).toFixed(6) : "-";

    return {
      nRk4Final: nRk4Final.toFixed(3),
      nMidFinal: nMidFinal.toFixed(3),
      nActual,
      maxDndt: maxDndt.toFixed(4),
      maxDiff: maxDiff.toFixed(6),
      maeRk4,
      maeMid,
    };
  }, [simData, selectedExp]);

  // ── Konfigurasi Chart.js: Kurva N(t) ───────────────────
  const chartDataN = useMemo(() => {
    if (!simData) return null;
    const exp = EXPERIMENTS[selectedExp];
    return {
      labels: simData.time.map((t) => t.toFixed(1)),
      datasets: [
        {
          label: "N(t) Aktual (Eksperimen)",
          data: exp.count,
          borderColor: "#34d399",
          backgroundColor: "rgba(52, 211, 153, 0.08)",
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: "#34d399",
          pointBorderColor: "#0b0f1a",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          fill: false,
          tension: 0,
          stepped: "after",
        },
        {
          label: "N(t) — RK4",
          data: simData.n_rk4,
          borderColor: "#818cf8",
          backgroundColor: "rgba(129, 140, 248, 0.1)",
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#818cf8",
          fill: true,
          tension: 0.35,
        },
        {
          label: "N(t) — Midpoint",
          data: simData.n_midpoint,
          borderColor: "#fbbf24",
          backgroundColor: "rgba(251, 191, 36, 0.05)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: "#fbbf24",
          borderDash: [6, 3],
          fill: false,
          tension: 0.35,
        },
      ],
    };
  }, [simData, selectedExp]);

  const chartOptionsN = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#e2e8f0",
            font: { family: "'Inter', sans-serif", size: 12 },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(99, 102, 241, 0.3)",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Inter', sans-serif", weight: "600" },
          bodyFont: { family: "'Inter', sans-serif" },
          callbacks: {
            title: (items) => `t = ${items[0].label} s`,
            label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(4)}`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Waktu t (detik)",
            color: "#94a3b8",
            font: { family: "'Inter', sans-serif", size: 13, weight: "500" },
          },
          ticks: { color: "#64748b", maxTicksLimit: 16, font: { size: 11 } },
          grid: { color: "rgba(51, 65, 85, 0.4)" },
          border: { color: "rgba(51, 65, 85, 0.6)" },
        },
        y: {
          title: {
            display: true,
            text: "Jumlah Keseluruhan Barang N(t)",
            color: "#818cf8",
            font: { family: "'Inter', sans-serif", size: 13, weight: "500" },
          },
          ticks: { color: "#818cf8", font: { size: 11 } },
          grid: { color: "rgba(51, 65, 85, 0.3)" },
          border: { color: "rgba(99, 102, 241, 0.3)" },
        },
      },
      animation: { duration: 700, easing: "easeInOutQuart" },
    }),
    [],
  );

  // ── Konfigurasi Chart.js: Kurva PWM & dN/dt ────────────
  const chartDataAux = useMemo(() => {
    if (!simData) return null;
    return {
      labels: simData.time.map((t) => t.toFixed(1)),
      datasets: [
        {
          label: "PWM u(t)",
          data: simData.pwm_computed,
          borderColor: "#34d399",
          backgroundColor: "rgba(52, 211, 153, 0.08)",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          stepped: "before",
          yAxisID: "y",
        },
        {
          label: "dN/dt (laju kedatangan)",
          data: simData.dndt_values,
          borderColor: "#fb7185",
          backgroundColor: "rgba(251, 113, 133, 0.05)",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    };
  }, [simData]);

  const chartOptionsAux = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#e2e8f0",
            font: { family: "'Inter', sans-serif", size: 12 },
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#cbd5e1",
          borderColor: "rgba(16, 185, 129, 0.3)",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Inter', sans-serif", weight: "600" },
          bodyFont: { family: "'Inter', sans-serif" },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Waktu t (detik)",
            color: "#94a3b8",
            font: { family: "'Inter', sans-serif", size: 13, weight: "500" },
          },
          ticks: { color: "#64748b", maxTicksLimit: 16, font: { size: 11 } },
          grid: { color: "rgba(51, 65, 85, 0.4)" },
          border: { color: "rgba(51, 65, 85, 0.6)" },
        },
        y: {
          position: "left",
          title: {
            display: true,
            text: "PWM u(t)",
            color: "#34d399",
            font: { family: "'Inter', sans-serif", size: 13, weight: "500" },
          },
          ticks: { color: "#34d399", font: { size: 11 } },
          grid: { color: "rgba(51, 65, 85, 0.3)" },
          border: { color: "rgba(52, 211, 153, 0.3)" },
        },
        y1: {
          position: "right",
          title: {
            display: true,
            text: "dN/dt (item/s)",
            color: "#fb7185",
            font: { family: "'Inter', sans-serif", size: 13, weight: "500" },
          },
          ticks: { color: "#fb7185", font: { size: 11 } },
          grid: { drawOnChartArea: false },
          border: { color: "rgba(251, 113, 133, 0.3)" },
        },
      },
      animation: { duration: 700, easing: "easeInOutQuart" },
    }),
    [],
  );

  // ── Reset ke default ────────────────────────────────────
  const resetParams = () => {
    setPwmMin(DEFAULTS.pwmMin);
    setPwmMax(DEFAULTS.pwmMax);
    setIntervalMin(DEFAULTS.intervalMin);
    setIntervalMax(DEFAULTS.intervalMax);
  };

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <main className="dashboard">
      {/* ──── Header ──── */}
      <header className="dashboard__header">
        <div className="header__glow" aria-hidden="true"></div>
        <div className="header__content">
          <div className="header__badge">Metode Numerik</div>
          <h1 className="header__title">
            Simulasi Konveyor Adaptif
            <span className="header__title-accent"> — RK4 & Midpoint</span>
          </h1>
          <p className="header__subtitle">Visualisasi laju barang yang lewat dengan pemetaan PWM</p>
        </div>
      </header>

      <div className="dashboard__body">
        {/* ──── Panel Kontrol (Sidebar) ──── */}
        <aside className="control-panel" id="control-panel">
          <div className="control-panel__header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            <h2>Kalibrasi Conveyour</h2>
          </div>

          <div className="section-label">Data Eksperimen</div>
          <div className="control-group" style={{ padding: "0.5rem 1rem" }}>
            <select
              value={selectedExp}
              onChange={(e) => setSelectedExp(parseInt(e.target.value))}
              style={{
                width: "100%",
                padding: "0.4rem",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                outline: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {EXPERIMENTS.map((exp, idx) => (
                <option key={idx} value={idx}>
                  {exp.name} {exp.count.length > 0 ? `(1-${exp.count.length} barang)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="section-label">Sinyal PWM</div>

          <ParamInput id="pwm-min" label="PWM Minimum" symbol="PWM_Min" value={pwmMin} onChange={setPwmMin} min={0} max={255} step={1} />

          <ParamInput id="pwm-max" label="PWM Maksimum" symbol="PWM_Max" value={pwmMax} onChange={setPwmMax} min={0} max={255} step={1} />

          <div className="section-label">Interpolasi PWM (Titik Tengah)</div>
          <div className="control-group" style={{ padding: "0.5rem 1rem" }}>
            <select
              value={interpMode}
              onChange={(e) => setInterpMode(e.target.value)}
              style={{
                width: "100%",
                padding: "0.4rem",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                outline: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              <option value="linear">Linear </option>
              <option value="zoh">Zero-Order Hold</option>
            </select>
          </div>

          <div className="section-label">Interval Sensor</div>

          <ParamInput id="interval-min" label="Interval Minimum" symbol="I_Min" value={intervalMin} onChange={setIntervalMin} min={50} max={5000} step={10} />

          <ParamInput id="interval-max" label="Interval Maksimum" symbol="I_Max" value={intervalMax} onChange={setIntervalMax} min={500} max={10000} step={50} />

          {/* Tombol Simulasi & Reset */}
          <div className="btn-group">
            <button className={`btn-simulate ${loading ? "btn-simulate--loading" : ""}`} onClick={runSimulation} disabled={loading} id="btn-simulate">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Menghitung...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Jalankan Simulasi
                </>
              )}
            </button>

            <button className="btn-reset" onClick={resetParams} id="btn-reset">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Reset Default
            </button>
          </div>

          {error && (
            <div className="error-msg" id="error-message">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Info Panel */}
          <div className="info-panel">
            <h3>Model Matematika</h3>
            <div className="info-equation">
              <code>dN/dt = 1000 / (20·u(t) − 1000)</code>
            </div>
            <p>Pemetaan PWM mikrokontroler:</p>
            <div className="info-equation info-equation--sm">
              <code>u(t) = map(interval, I_Min, I_Max, PWM_Min, PWM_Max)</code>
            </div>
            <ul className="info-list">
              <li>
                <strong>N(t)</strong> — Jumlah keseluruhan (kumulatif) barang yang terdeteksi hingga waktu ke-t
              </li>
              <li>
                <strong>dN/dt</strong> — Laju kedatangan barang (turunan dari N(t))
              </li>
              <li>
                <strong>PWM (u(t))</strong> — Pulse Width Modulation, sinyal kendali kecepatan motor
              </li>
              <li>
                <strong>Interval</strong> — Jarak waktu antar deteksi barang oleh sensor inframerah (ms)
              </li>
              <li>
                <strong>RK4</strong> — Runge-Kutta Orde 4 (tereduksi ke Simpson 1/3, k₂=k₃)
              </li>
              <li>
                <strong>Midpoint</strong> — Evaluasi numerik Titik Tengah
              </li>
              <li>
                <strong>|ΔN|</strong> — Selisih absolut (Galat Absolut) hasil RK4 dan Midpoint
              </li>
              <li>
                <strong>Galat (%)</strong> — Persentase selisih relatif antara RK4 dan Midpoint
              </li>
            </ul>
          </div>
        </aside>

        {/* ──── Konten Utama ──── */}
        <section className="main-content">
          {/* Stat Cards */}
          {stats && (
            <div className="stats-grid" id="stats-grid">
              <StatCard
                label="N Akhir (RK4)"
                value={stats.nRk4Final}
                unit=" item"
                color="indigo"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                }
              />
              <StatCard
                label="N Akhir (Midpoint)"
                value={stats.nMidFinal}
                unit=" item"
                color="amber"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                }
              />
              <StatCard
                label="dN/dt Maks"
                value={stats.maxDndt}
                unit=" /s"
                color="rose"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                }
              />
              <StatCard
                label="Maks |RK4 − Mid|"
                value={stats.maxDiff}
                unit=""
                color="emerald"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 20V10M12 20V4M6 20v-6" />
                  </svg>
                }
              />
            </div>
          )}

          {/* Grafik 1: Kurva N(t) */}
          <div className="chart-container" id="chart-n">
            <div className="chart-container__header">
              <h2>Kurva Keseluruhan Barang yang Lewat ( N(t) )</h2>
              <div className="chart-container__params">
                <span className="param-badge param-badge--k">
                  PWM: {pwmMin}–{pwmMax}
                </span>
                <span className="param-badge param-badge--t">
                  Int: {intervalMin}–{intervalMax} ms
                </span>
              </div>
            </div>
            <div className="chart-wrapper">
              {chartDataN ? (
                <Line data={chartDataN} options={chartOptionsN} />
              ) : (
                <div className="chart-placeholder">
                  <span className="spinner spinner--lg"></span>
                  <p>Memuat simulasi...</p>
                </div>
              )}
            </div>
          </div>

          {/* Grafik 2: PWM & dN/dt */}
          <div className="chart-container" id="chart-aux">
            <div className="chart-container__header">
              <h2>Sinyal PWM u(t) & Laju dN/dt</h2>
              <div className="chart-container__params">
                <span className="param-badge param-badge--n">{currentExp.time.length} titik data</span>
              </div>
            </div>
            <div className="chart-wrapper chart-wrapper--sm">
              {chartDataAux ? (
                <Line data={chartDataAux} options={chartOptionsAux} />
              ) : (
                <div className="chart-placeholder">
                  <span className="spinner spinner--lg"></span>
                  <p>Memuat data...</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabel Data */}
          {simData && (
            <div className="data-preview" id="data-preview">
              <h3>Tabel Komparasi Hasil Simulasi</h3>
              <div className="table-scroll">
                <table className="data-table">
                  {(() => {
                    const hasActualData = currentExp.count.length > 0;
                    return (
                      <>
                        <thead>
                          <tr>
                            <th>n</th>
                            <th>t (s)</th>
                            <th>Interval (ms)</th>
                            <th>PWM u(t)</th>
                            <th>dN/dt</th>
                            <th>N — RK4</th>
                            {hasActualData && <th>N Aktual</th>}
                            {hasActualData && <th>Error RK4</th>}
                            <th>N — Midpoint</th>
                            {hasActualData ? <th>Error Midpoint</th> : <><th>|ΔN|</th><th>Galat (%)</th></>}
                          </tr>
                        </thead>
                        <tbody>
                          {simData.time
                            .filter((_, i) => i % 1 === 0)
                            .map((t, rowIdx) => {
                              const i = rowIdx * 1;
                              const nAktual = currentExp.count[i] !== undefined ? currentExp.count[i] : undefined;
                              
                              const errRk4 = nAktual !== undefined ? Math.abs(simData.n_rk4[i] - nAktual).toFixed(6) : "-";
                              const errMid = nAktual !== undefined ? Math.abs(simData.n_midpoint[i] - nAktual).toFixed(6) : "-";
                              const deltaN = Math.abs(simData.n_rk4[i] - simData.n_midpoint[i]).toFixed(6);
                              const galat = ((Math.abs(simData.n_rk4[i] - simData.n_midpoint[i]) / Math.abs(simData.n_rk4[i] || 1)) * 100).toFixed(4);

                              return (
                                <tr key={i}>
                                  <td className="td-num">{i + 1}</td>
                                  <td>{t.toFixed(3)}</td>
                                  <td>{currentExp.interval[i] !== undefined ? Math.round(currentExp.interval[i]) : "-"}</td>
                                  <td className="td-pwm">{simData.pwm_computed[i]}</td>
                                  <td className="td-dndt">{simData.dndt_values[i].toFixed(4)}</td>
                                  <td className="td-rk4">{simData.n_rk4[i].toFixed(6)}</td>
                                  
                                  {hasActualData && (
                                    <>
                                      <td className="td-aktual" style={{fontWeight: "bold", color: "var(--text-primary)"}}>{nAktual}</td>
                                      <td className="td-diff">{errRk4}</td>
                                    </>
                                  )}
                                  
                                  <td className="td-mid">{simData.n_midpoint[i].toFixed(6)}</td>
                                  
                                  {hasActualData ? (
                                    <td className="td-diff">{errMid}</td>
                                  ) : (
                                    <>
                                      <td className="td-diff">{deltaN}</td>
                                      <td className="td-diff">{galat}</td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                        </tbody>
                        {hasActualData && (
                          <tfoot>
                            <tr>
                              <td colSpan="7" style={{textAlign: "right", fontWeight: "bold", paddingRight: "1rem"}}>MEAN ABSOLUTE ERROR (RK4)</td>
                              <td className="td-diff" style={{fontWeight: "bold"}}>{stats.maeRk4}</td>
                              <td style={{textAlign: "right", fontWeight: "bold", paddingRight: "1rem"}}>MAE (MIDPOINT)</td>
                              <td className="td-diff" style={{fontWeight: "bold"}}>{stats.maeMid}</td>
                            </tr>
                          </tfoot>
                        )}
                      </>
                    );
                  })()}
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ──── Footer ──── */}
      <footer className="dashboard__footer">
        <p>Simulasi Metode Numerik — Runge-Kutta Orde 4 & Midpoint</p>
        <p className="footer__sub">Konveyor Adaptif · Pemetaan PWM · Zero-Order Hold · Data Eksperimen</p>
      </footer>
    </main>
  );
}
