"use client";

import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { EXPERIMENTS, DEFAULTS } from "@/data/experiments";
import { simulateRK4, simulateMidpoint } from "@/lib/simulation";
import StatCard from "@/components/StatCard";
import ParamInput from "@/components/ParamInput";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, Legend);

export default function Home() {
  const [pwmMin, setPwmMin] = useState(DEFAULTS.pwmMin);
  const [pwmMax, setPwmMax] = useState(DEFAULTS.pwmMax);
  const [intervalMin, setIntervalMin] = useState(DEFAULTS.intervalMin);
  const [intervalMax, setIntervalMax] = useState(DEFAULTS.intervalMax);

  const [selectedExp, setSelectedExp] = useState(0);
  const [interpMode, setInterpMode] = useState("linear");

  const currentExp = EXPERIMENTS[selectedExp];

  const simData = useMemo(() => {
    const params = { pwmMin, pwmMax, intervalMin, intervalMax };
    const initialN = currentExp.count.length > 0 ? currentExp.count[0] : 0;
    const rk4 = simulateRK4(currentExp.time, currentExp.interval, params, initialN, interpMode);
    const mid = simulateMidpoint(currentExp.time, currentExp.interval, params, initialN, interpMode);

    return {
      time: rk4.time,
      n_rk4: rk4.n_rk4,
      n_midpoint: mid.n_midpoint,
      pwm_computed: rk4.pwm_computed,
      dndt_values: rk4.dndt_values,
    };
  }, [currentExp, pwmMin, pwmMax, intervalMin, intervalMax, interpMode]);

  const stats = useMemo(() => {
    if (!simData || simData.n_rk4.length === 0) return null;

    const nRk4Final = simData.n_rk4[simData.n_rk4.length - 1];
    const nMidFinal = simData.n_midpoint[simData.n_midpoint.length - 1];
    const nActual = currentExp.count.length > 0 ? currentExp.count[currentExp.count.length - 1] : "-";
    const maxDndt = Math.max(...simData.dndt_values);

    let maxDiff = 0;
    let sumErrRk4 = 0;
    let sumErrMid = 0;
    let countErr = 0;

    for (let i = 0; i < simData.n_rk4.length; i++) {
      const diff = Math.abs(simData.n_rk4[i] - simData.n_midpoint[i]);
      if (diff > maxDiff) maxDiff = diff;

      if (currentExp.count[i] !== undefined) {
        sumErrRk4 += Math.abs(simData.n_rk4[i] - currentExp.count[i]);
        sumErrMid += Math.abs(simData.n_midpoint[i] - currentExp.count[i]);
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
  }, [simData, currentExp]);

  const chartDataN = useMemo(() => {
    if (!simData) return null;
    return {
      labels: simData.time.map((t) => t.toFixed(1)),
      datasets: [
        {
          label: "N(t) Aktual (Eksperimen)",
          data: currentExp.count,
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
          label: "N(t): RK4",
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
          label: "N(t): Midpoint",
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
  }, [simData, currentExp]);

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
      animation: { duration: 400, easing: "easeInOutQuart" },
    }),
    []
  );

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
      animation: { duration: 400, easing: "easeInOutQuart" },
    }),
    []
  );

  const resetParams = () => {
    setPwmMin(DEFAULTS.pwmMin);
    setPwmMax(DEFAULTS.pwmMax);
    setIntervalMin(DEFAULTS.intervalMin);
    setIntervalMax(DEFAULTS.intervalMax);
  };

  const hasActualData = currentExp.count.length > 0;

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div className="header__content">
          <div className="header__badge">Metode Numerik</div>
          <h1 className="header__title">
            Simulasi Konveyor Adaptif
            <span className="header__title-accent">: RK4 & Midpoint</span>
          </h1>
          <p className="header__subtitle">Visualisasi laju kedatangan barang dengan kendali sinyal PWM</p>
        </div>
      </header>

      <div className="dashboard__body">
        <aside className="control-panel" id="control-panel">
          <div className="control-panel__header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            <h2>Kalibrasi Konveyor</h2>
          </div>

          <div className="section-label">Data Eksperimen</div>
          <div className="control-group">
            <select
              aria-label="Pilih data percobaan"
              className="select-input"
              value={selectedExp}
              onChange={(e) => setSelectedExp(parseInt(e.target.value, 10))}
            >
              {EXPERIMENTS.map((exp, idx) => (
                <option key={idx} value={idx}>
                  {exp.name} {exp.count.length > 0 ? `(1-${exp.count.length} barang)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="section-label">Sinyal PWM</div>
          <ParamInput id="pwm-min" label="PWM Minimum" symbol="PWM_Min" value={pwmMin} onChange={setPwmMin} min={51} max={255} step={1} />
          <ParamInput id="pwm-max" label="PWM Maksimum" symbol="PWM_Max" value={pwmMax} onChange={setPwmMax} min={60} max={255} step={1} />

          <div className="section-label">Interpolasi PWM (Titik Tengah)</div>
          <div className="control-group">
            <select
              aria-label="Mode interpolasi PWM"
              className="select-input"
              value={interpMode}
              onChange={(e) => setInterpMode(e.target.value)}
            >
              <option value="linear">Linear</option>
              <option value="zoh">Zero-Order Hold</option>
            </select>
          </div>

          <div className="section-label">Interval Sensor</div>
          <ParamInput id="interval-min" label="Interval Minimum" symbol="I_Min" value={intervalMin} onChange={setIntervalMin} min={50} max={5000} step={10} />
          <ParamInput id="interval-max" label="Interval Maksimum" symbol="I_Max" value={intervalMax} onChange={setIntervalMax} min={500} max={10000} step={50} />

          <div className="btn-group">
            <button className="btn-reset" onClick={resetParams} id="btn-reset" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Reset Default
            </button>
          </div>

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
              <li><strong>N(t)</strong>: Jumlah kumulatif barang yang terdeteksi</li>
              <li><strong>dN/dt</strong>: Laju kedatangan barang per detik</li>
              <li><strong>PWM (u(t))</strong>: Sinyal kendali kecepatan motor (51–255)</li>
              <li><strong>Interval</strong>: Jarak waktu antar deteksi sensor (ms)</li>
              <li><strong>RK4</strong>: Runge-Kutta Orde 4 (reduksi Simpson 1/3)</li>
              <li><strong>Midpoint</strong>: Evaluasi numerik Titik Tengah (RK2)</li>
              <li><strong>|ΔN|</strong>: Selisih absolut hasil RK4 dan Midpoint</li>
            </ul>
          </div>
        </aside>

        <section className="main-content">
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
                label="Maks |RK4 - Mid|"
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

          <div className="chart-container" id="chart-n">
            <div className="chart-container__header">
              <h2>Kurva Keseluruhan Barang yang Lewat ( N(t) )</h2>
              <div className="chart-container__params">
                <span className="param-badge param-badge--k">PWM: {pwmMin}–{pwmMax}</span>
                <span className="param-badge param-badge--t">Int: {intervalMin}–{intervalMax} ms</span>
              </div>
            </div>
            <div className="chart-wrapper">
              <Line data={chartDataN} options={chartOptionsN} />
            </div>
          </div>

          <div className="chart-container" id="chart-aux">
            <div className="chart-container__header">
              <h2>Sinyal PWM u(t) & Laju dN/dt</h2>
              <div className="chart-container__params">
                <span className="param-badge">{currentExp.time.length} titik data</span>
              </div>
            </div>
            <div className="chart-wrapper chart-wrapper--sm">
              <Line data={chartDataAux} options={chartOptionsAux} />
            </div>
          </div>

          <div className="data-preview" id="data-preview">
            <h3>Tabel Komparasi Hasil Simulasi</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>n</th>
                    <th>t (s)</th>
                    <th>Interval (ms)</th>
                    <th>PWM u(t)</th>
                    <th>dN/dt</th>
                    <th>N (RK4)</th>
                    {hasActualData && <th>N Aktual</th>}
                    {hasActualData && <th>Error RK4</th>}
                    <th>N (Midpoint)</th>
                    {hasActualData ? <th>Error Midpoint</th> : <><th>|ΔN|</th><th>Galat (%)</th></>}
                  </tr>
                </thead>
                <tbody>
                  {simData.time.map((t, i) => {
                    const nAktual = currentExp.count[i];
                    const errRk4 = nAktual !== undefined ? Math.abs(simData.n_rk4[i] - nAktual).toFixed(6) : "-";
                    const errMid = nAktual !== undefined ? Math.abs(simData.n_midpoint[i] - nAktual).toFixed(6) : "-";
                    const deltaN = Math.abs(simData.n_rk4[i] - simData.n_midpoint[i]).toFixed(6);
                    const denominator = Math.abs(simData.n_rk4[i]) || 1;
                    const galat = ((Math.abs(simData.n_rk4[i] - simData.n_midpoint[i]) / denominator) * 100).toFixed(4);

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
                            <td className="td-aktual">{nAktual}</td>
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
                      <td colSpan="7" className="table-tfoot-label">MEAN ABSOLUTE ERROR (RK4)</td>
                      <td className="table-tfoot-val">{stats.maeRk4}</td>
                      <td className="table-tfoot-label">MAE (MIDPOINT)</td>
                      <td className="table-tfoot-val">{stats.maeMid}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>
      </div>

      <footer className="dashboard__footer">
        <p>Simulasi Metode Numerik: Runge-Kutta Orde 4 & Midpoint</p>
        <p className="footer__sub">Konveyor Adaptif · Pemetaan PWM · Zero-Order Hold & Linear</p>
      </footer>
    </main>
  );
}
