const request = require("supertest");
const app = require("../../app");

describe("CU4 - Reportes", () => {
  it("CU4-CP-RV-06 Fechas no seleccionadas - Debe bloquear generación", async () => {
    const res = await request(app)
      .get("/api/reportes/ventas")
      .query({ formato: "pdf" })
      .expect("Content-Type", /json/);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Debe enviar fecha o rango válido." });

    console.log(
      "[EVIDENCE][CU4-CP-RV-06] EXPECTED status=400 error='Debe enviar fecha o rango válido.' (no PDF) | ACTUAL status=%s body=%s",
      res.status,
      JSON.stringify(res.body)
    );
  });
});
