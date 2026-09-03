import "./globals.css";

export const metadata = {
  title: "Simulasi Konveyor Adaptif: RK4 & Midpoint | Metode Numerik",
  description:
    "Dashboard interaktif untuk memvisualisasikan simulasi Metode Numerik (Runge-Kutta Orde 4 & Midpoint) pada sistem konveyor adaptif motor DC. Ubah parameter K dan T secara real-time.",
  keywords: [
    "Runge-Kutta",
    "RK4",
    "Midpoint",
    "Metode Numerik",
    "Konveyor Adaptif",
    "Motor DC",
    "Simulasi",
    "ODE",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
