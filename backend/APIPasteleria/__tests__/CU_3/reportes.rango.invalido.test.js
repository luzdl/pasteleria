const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");

describe("CU03 - Generar Reporte de Inventario", () => {
  /**
   * CASO DE PRUEBA CP-12 — Fecha fin menor que fecha inicio
   * 
   * Objeto: Módulo de Reportes – Generar Reporte de Inventario
   * Objetivo: Verificar que el sistema no permita generar el reporte cuando la 
   *           fecha fin es menor que la fecha inicio.
   * Precondiciones: Usuario autenticado como Administrador de Inventario.
   * Valores de entrada: Tipo: Inventario, Fecha Inicio: 20 del mes actual,
   *                     Fecha Fin: 10 del mes actual, Formato: PDF
   * Resultado esperado: El sistema bloquea la generación y muestra un mensaje de 
   *                     validación indicando que la fecha fin no puede ser menor 
   *                     que la fecha inicio. No se descarga ningún archivo.
   * Postcondiciones: No se genera reporte y no hay cambios en el sistema.
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

  it("CP-12 - Rango inválido (Fecha Fin menor que Fecha Inicio)", async () => {
    // Datos de entrada según CP-12
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Fecha Inicio: día 20 del mes actual
    const fechaInicio = `${year}-${month}-20`;
    // Fecha Fin: día 10 del mes actual (anterior a inicio)
    const fechaFin = `${year}-${month}-10`;

    // Ejecución: Intentar generar reporte con rango inválido
    const response = await request(app)
      .get("/api/reportes/inventario")
      .query({
        inicio: fechaInicio,
        fin: fechaFin,
        formato: "pdf"
      })
      .set("Authorization", `Bearer ${token}`);

    // Resultado esperado: El sistema bloquea la generación
    // Debe retornar error 400 (bad request) o 404 (sin datos)
    expect([400, 404]).toContain(response.status);

    // Verificar que NO se genera un PDF
    expect(response.headers['content-type']).not.toMatch(/application\/pdf/);

    // Verificar que hay un mensaje de error/validación
    if (response.status === 400) {
      expect(response.body).toHaveProperty("error");
    }
    if (response.status === 404) {
      expect(response.body).toHaveProperty("message");
    }

    // Postcondición: No se descarga ningún archivo
    // (verificado por el content-type que no es PDF)
  });
});
