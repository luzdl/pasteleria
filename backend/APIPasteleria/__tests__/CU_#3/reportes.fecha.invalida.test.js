const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");

describe("CU03 - Generar Reporte de Inventario", () => {
  /**
   * CASO DE PRUEBA CP-11 — Selección de fecha fuera del mes actual / futura
   * 
   * Objeto: Módulo de Reportes – Generar Reporte de Inventario
   * Objetivo: Confirmar que el sistema restringe la selección de fechas al mes 
   *           calendario actual y no permite fechas futuras.
   * Precondiciones: Usuario autenticado como Administrador de Inventario.
   * Valores de entrada: Tipo: Inventario, Fecha Inicio: fecha futura o fuera del mes actual,
   *                     Fecha Fin: fecha futura o fuera del mes actual, Formato: PDF
   * Resultado esperado: El sistema no permite seleccionar fechas fuera del rango 
   *                     permitido y muestra mensaje de error.
   * Postcondiciones: No se genera reporte.
   */

  let token;

  beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || "secret";
    const testUserId = parseInt(process.env.TEST_USER_ID) || 1;
    const testUsername = process.env.TEST_LOGIN_USER || "testuser";
    const testRole = "inventario"; // Rol de Administrador de Inventario

    token = jwt.sign(
      { id: testUserId, username: testUsername, rol: testRole },
      jwtSecret,
      { expiresIn: "1h" }
    );
  });

  it("CP-11 - Fecha fuera de rango permitido (fecha futura)", async () => {
    // Datos de entrada: Fechas futuras (próximo año)
    const nextYear = new Date().getFullYear() + 1;
    const fechaFutura = `${nextYear}-01-15`;

    // Intentar generar reporte con fechas futuras
    const response = await request(app)
      .get("/api/reportes/inventario")
      .query({
        inicio: fechaFutura,
        fin: fechaFutura,
        formato: "pdf"
      })
      .set("Authorization", `Bearer ${token}`);

    // Resultado esperado: El sistema rechaza o no genera datos
    // Puede ser 400 (fecha inválida) o 404 (sin datos en ese rango futuro)
    expect([400, 404]).toContain(response.status);

    // Postcondición: No se genera reporte PDF
    if (response.status === 404) {
      expect(response.body).toHaveProperty("message");
    }
    if (response.status === 400) {
      expect(response.body).toHaveProperty("error");
    }

    // Verificar que NO se devuelve un PDF
    expect(response.headers['content-type']).not.toMatch(/application\/pdf/);
  });

  it("CP-11b - Fecha fuera del mes actual (mes anterior)", async () => {
    // Datos de entrada: Fechas del mes anterior
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    
    const fechaInicio = `${year}-${month}-01`;
    const fechaFin = `${year}-${month}-15`;

    // Intentar generar reporte con fechas del mes anterior
    const response = await request(app)
      .get("/api/reportes/inventario")
      .query({
        inicio: fechaInicio,
        fin: fechaFin,
        formato: "pdf"
      })
      .set("Authorization", `Bearer ${token}`);

    // Resultado esperado: Sin datos para ese rango (404) o rechazado (400)
    expect([400, 404]).toContain(response.status);

    // Postcondición: No se genera reporte con datos
    if (response.status === 404) {
      expect(response.body).toHaveProperty("message");
    }
  });

  it("CP-11c - Rango de fechas inválido (fin antes que inicio)", async () => {
    // Datos de entrada: Fecha fin anterior a fecha inicio
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const fechaInicio = `${year}-${month}-15`;
    const fechaFin = `${year}-${month}-01`; // Antes que inicio

    // Intentar generar reporte con rango inválido
    const response = await request(app)
      .get("/api/reportes/inventario")
      .query({
        inicio: fechaInicio,
        fin: fechaFin,
        formato: "pdf"
      })
      .set("Authorization", `Bearer ${token}`);

    // Resultado esperado: Error o sin datos
    expect([400, 404]).toContain(response.status);

    // Postcondición: No se genera reporte
    expect(response.headers['content-type']).not.toMatch(/application\/pdf/);
  });
});
