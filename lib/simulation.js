/**
 * Core mathematical engine for conveyor numerical simulation.
 * Includes Arduino map replication, rate evaluation, ZOH/Linear interpolation,
 * and Runge-Kutta Orde 4 (Simpson 1/3 reduction) & Midpoint ODE solvers.
 */

export function arduinoMap(x, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return ((x - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

export function dNdt(u) {
  const denominator = 20 * u - 1000;
  // Guard against division by zero and non-physical negative rates when u <= 50
  if (denominator <= 0) {
    return 0;
  }
  return 1000 / denominator;
}

export function getPWMZOH(t, timeData, intervalData, params) {
  if (!timeData || timeData.length === 0) return params.pwmMin;
  let idx = 0;
  for (let i = 0; i < timeData.length; i++) {
    if (timeData[i] <= t) {
      idx = i;
    } else {
      break;
    }
  }
  const interval = intervalData[idx] ?? params.intervalMin;
  return arduinoMap(
    interval,
    params.intervalMin,
    params.intervalMax,
    params.pwmMin,
    params.pwmMax
  );
}

export function getPWMLinear(t, timeData, intervalData, params) {
  const n = timeData.length;
  if (n === 0) return params.pwmMin;
  if (t <= timeData[0]) return getPWMZOH(timeData[0], timeData, intervalData, params);
  if (t >= timeData[n - 1]) return getPWMZOH(timeData[n - 1], timeData, intervalData, params);

  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
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

export function simulateRK4(timeData, intervalData, params, initialN = 0, interpMode = "linear") {
  const n = timeData.length;
  if (n === 0) {
    return { time: [], n_rk4: [], pwm_computed: [], dndt_values: [] };
  }

  const N = new Array(n);
  const dndtValues = new Array(n);
  const pwmValues = new Array(n);
  const getU = interpMode === "linear" ? getPWMLinear : getPWMZOH;

  N[0] = initialN;

  for (let i = 0; i < n; i++) {
    pwmValues[i] = getPWMZOH(timeData[i], timeData, intervalData, params);
    dndtValues[i] = dNdt(pwmValues[i]);
  }

  for (let i = 0; i < n - 1; i++) {
    const h = timeData[i + 1] - timeData[i];
    const tStart = timeData[i];

    const uStart = getU(tStart, timeData, intervalData, params);
    const uMid = getU(tStart + h / 2, timeData, intervalData, params);
    const uEnd = getU(tStart + h, timeData, intervalData, params);

    const k1 = dNdt(uStart);
    const k2 = dNdt(uMid);
    const k4 = dNdt(uEnd);

    N[i + 1] = N[i] + (h / 6) * (k1 + 4 * k2 + k4);
  }

  return {
    time: timeData,
    n_rk4: N.map((val) => parseFloat(val.toFixed(6))),
    pwm_computed: pwmValues.map((val) => parseFloat(val.toFixed(2))),
    dndt_values: dndtValues.map((val) => parseFloat(val.toFixed(6))),
  };
}

export function simulateMidpoint(timeData, intervalData, params, initialN = 0, interpMode = "linear") {
  const n = timeData.length;
  if (n === 0) {
    return { n_midpoint: [] };
  }

  const N = new Array(n);
  const getU = interpMode === "linear" ? getPWMLinear : getPWMZOH;

  N[0] = initialN;

  for (let i = 0; i < n - 1; i++) {
    const h = timeData[i + 1] - timeData[i];
    const tStart = timeData[i];

    const uMid = getU(tStart + h / 2, timeData, intervalData, params);
    const k2 = dNdt(uMid);

    N[i + 1] = N[i] + h * k2;
  }

  return {
    n_midpoint: N.map((val) => parseFloat(val.toFixed(6))),
  };
}
