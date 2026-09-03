# Numerical Methods Simulator (RK4 & Midpoint)

A numerical simulation web application for solving and visualizing ordinary differential equations (ODE) using 4th-Order Runge-Kutta and Midpoint methods.

**Live Demo:** [https://metode-numerik-nine.vercel.app](https://metode-numerik-nine.vercel.app)

## About

This project simulates arrival-rate differential equations based on discrete sensor interval data and mapped PWM values. It computes numerical solutions using the 4th-Order Runge-Kutta (RK4) method (reduced via Simpson's 1/3 Rule) and compares the output with the 2nd-Order Runge-Kutta (Midpoint) method.

## Features

- Runge-Kutta 4th Order (RK4) ODE numerical solver
- 2nd-Order Midpoint (RK2) comparative simulation
- PWM lookup with Zero-Order Hold (ZOH) and Linear Interpolation
- In-memory real-time computation for instant slider updates
- Shared mathematical simulation engine with input hardening and DoS limits
- Chart visualization using Chart.js and react-chartjs-2
- Next.js App Router API route (`/api/simulate/rk4`) for programmatic access

## Project Structure

```
MetodeNumerik/
├── app/
│   ├── api/simulate/rk4/
│   │   └── route.js          # Hardened API route for RK4 and Midpoint computation
│   ├── layout.js             # Root layout with metadata
│   ├── page.js               # Dashboard page with input controls and charts
│   └── globals.css           # Clean CSS styling
├── components/
│   ├── ParamInput.js         # Slider and numerical input component
│   └── StatCard.js           # Metric summary card component
├── data/
│   └── experiments.js        # Static sensor experiment datasets
├── lib/
│   └── simulation.js         # Core ODE solvers and Arduino mapping engine
├── public/                   # Static assets
├── next.config.mjs           # Next.js configuration
└── package.json              # Dependencies (Next.js 16, React 19, Chart.js)
```

## Requirements

- [Node.js](https://nodejs.org/) (version >= 18.17.0)
- [Git](https://git-scm.com/)
- npm, pnpm, or yarn

## Setup

```bash
git clone https://github.com/WindraNatan/MetodeNumerik.git
cd MetodeNumerik
npm install
```

## Usage

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm run start
```

## Concepts Covered

- ODE numerical approximation
- RK4 reduction to Simpson's 1/3 Rule
- Zero-Order Hold vs Linear Interpolation
- Next.js App Router and API route handlers
- Client-side chart rendering with Chart.js

## License

MIT
