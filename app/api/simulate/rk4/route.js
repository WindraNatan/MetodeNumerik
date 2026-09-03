import { NextResponse } from "next/server";
import { simulateRK4, simulateMidpoint } from "@/lib/simulation";

const MAX_POINTS = 5000;

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      pwm_min = 60,
      pwm_max = 200,
      interval_min = 200,
      interval_max = 3000,
      initial_n = 0,
      interp_mode = "linear",
      time_data,
      interval_data,
    } = body;

    if (!Array.isArray(time_data) || !Array.isArray(interval_data) || time_data.length === 0) {
      return NextResponse.json(
        { error: "time_data dan interval_data harus berupa array non-kosong." },
        { status: 400 }
      );
    }

    if (time_data.length > MAX_POINTS || interval_data.length > MAX_POINTS) {
      return NextResponse.json(
        { error: `Jumlah titik data tidak boleh melebihi batas ${MAX_POINTS}.` },
        { status: 400 }
      );
    }

    if (time_data.length !== interval_data.length) {
      return NextResponse.json(
        { error: "Panjang time_data dan interval_data harus sama." },
        { status: 400 }
      );
    }

    const pwmMin = parseFloat(pwm_min);
    const pwmMax = parseFloat(pwm_max);
    const intervalMin = parseFloat(interval_min);
    const intervalMax = parseFloat(interval_max);
    const initialN = parseFloat(initial_n);

    if (
      !Number.isFinite(pwmMin) ||
      !Number.isFinite(pwmMax) ||
      !Number.isFinite(intervalMin) ||
      !Number.isFinite(intervalMax) ||
      !Number.isFinite(initialN)
    ) {
      return NextResponse.json(
        { error: "Semua parameter kalibrasi harus berupa angka valid." },
        { status: 400 }
      );
    }

    if (intervalMax <= intervalMin) {
      return NextResponse.json(
        { error: "Interval_Max harus lebih besar dari Interval_Min." },
        { status: 400 }
      );
    }

    if (pwmMax <= pwmMin) {
      return NextResponse.json(
        { error: "PWM_Max harus lebih besar dari PWM_Min." },
        { status: 400 }
      );
    }

    const params = { pwmMin, pwmMax, intervalMin, intervalMax };
    const tData = time_data.map(Number);
    const iData = interval_data.map(Number);

    if (tData.some((v) => !Number.isFinite(v)) || iData.some((v) => !Number.isFinite(v))) {
      return NextResponse.json(
        { error: "Array data waktu dan interval mengandung elemen non-numerik." },
        { status: 400 }
      );
    }

    const mode = interp_mode === "zoh" ? "zoh" : "linear";
    const rk4Result = simulateRK4(tData, iData, params, initialN, mode);
    const midpointResult = simulateMidpoint(tData, iData, params, initialN, mode);

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
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses simulasi: " + err.message },
      { status: 500 }
    );
  }
}
