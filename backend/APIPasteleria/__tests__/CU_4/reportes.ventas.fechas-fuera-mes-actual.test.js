const request = require("supertest");
const app = require("../../app");

describe("CU4 - Reportes", () => {
  it("CU4-CP15 Fechas fuera del mes actual - No se genera reporte", async () => {
    // Rango deliberadamente fuera del mes actual (muy futuro) para evitar que existan ventas.
    const inicio = "2099-01-01";
    const fin = "2099-01-15";

    const res = await request(app)
      .get("/api/reportes/ventas")
      .query({ inicio, fin, formato: "pdf" })
      .expect("Content-Type", /json/);

    // Comportamiento actual del backend: si no hay ventas en el rango -> 404 con JSON.
    // Esto prueba que NO se genera PDF (no avanza el flujo de descarga).
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Sin ventas en ese periodo" });

    console.log(
      "[EVIDENCE][CU4-CP15] EXPECTED no PDF (JSON error) status=404 message='Sin ventas en ese periodo' inicio=%s fin=%s | ACTUAL status=%s body=%s",
      inicio,
      fin,
      res.status,
      JSON.stringify(res.body)
    );
  });
});
