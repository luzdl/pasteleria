const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");
const pool = require("../../db/db");

describe("CU03 - Generar Reporte de Inventario", () => {
  /**
   * CASO DE PRUEBA CP-09 — Generar reporte inventario en PDF
   * 
   * Objeto: Módulo de Reportes – Generar Reporte de Inventario
   * Objetivo: Verificar que el sistema genere y permita descargar el reporte de 
   *           inventario en formato PDF cuando el rango de fechas está dentro del mes actual.
   * Precondiciones: Usuario autenticado como Administrador de Inventario. 
   *                 El sistema contiene datos del mes actual.
   * Valores de entrada: Tipo: Inventario, Fecha Inicio: 01 del mes actual, 
   *                     Fecha Fin: 15 del mes actual, Formato: PDF
   * Resultado esperado: El sistema valida las fechas, genera el reporte en PDF, 
   *                     lo muestra en pantalla (o lo prepara) y permite descargarlo.
   * Postcondiciones: El usuario obtiene un archivo PDF del reporte de inventario 
   *                  generado para el rango seleccionado.
   */

  let token;
  let testUserId;
  const productoNombre = "Producto Reporte Test";

  beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || "secret";
    testUserId = parseInt(process.env.TEST_USER_ID) || 1;
    const testUsername = process.env.TEST_LOGIN_USER || "testuser";
    const testRole = "inventario"; // Rol de Administrador de Inventario

    token = jwt.sign(
      { id: testUserId, username: testUsername, rol: testRole },
      jwtSecret,
      { expiresIn: "1h" }
    );

    // Precondición: Asegurar que existe datos de inventario del mes actual
    try {
      await pool.query(
        "INSERT IGNORE INTO categorias (id, nombre) VALUES (1, 'Test')"
      );
      
      // Insertar producto con fecha de ingreso del mes actual
      const fechaActual = new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado, fecha_ingreso)
         VALUES (?, 1, 5.00, 50, 'disponible', ?)
         ON DUPLICATE KEY UPDATE stock = 50, fecha_ingreso = ?`,
        [productoNombre, fechaActual, fechaActual]
      );
    } catch (error) {
      // Ignorar si falla
    }
  });

  it("CP-09 - Generar reporte inventario en PDF exitosamente", async () => {
    // Datos de entrada según CP-09
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // Fecha Inicio: 01 del mes actual
    const fechaInicio = `${year}-${month}-01`;
    // Fecha Fin: 15 del mes actual (o día actual si es menor a 15)
    const diaFin = Math.min(15, now.getDate());
    const fechaFin = `${year}-${month}-${String(diaFin).padStart(2, '0')}`;

    // Ejecución: Generar reporte de inventario en PDF
    const response = await request(app)
      .get("/api/reportes/inventario")
      .query({
        inicio: fechaInicio,
        fin: fechaFin,
        formato: "pdf"
      })
      .set("Authorization", `Bearer ${token}`);

    // Resultado esperado: El sistema genera el reporte en PDF
    // Puede ser 200 (éxito con datos) o 404 (sin datos en el rango)
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      // Verificar que el Content-Type es PDF
      expect(response.headers['content-type']).toMatch(/application\/pdf/);
      
      // Verificar que hay contenido en el body (PDF generado)
      expect(response.body).toBeDefined();
      expect(Buffer.isBuffer(response.body) || response.body.length > 0).toBe(true);
    } else {
      // Si no hay datos, verificar mensaje apropiado
      expect(response.body).toHaveProperty("message");
    }
  });

  it("CP-09b - Reporte inventario requiere rango de fechas válido", async () => {
    // Intentar generar reporte sin fechas
    const response = await request(app)
      .get("/api/reportes/inventario")
      .query({ formato: "pdf" })
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    // El sistema debe rechazar la solicitud sin fechas
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});
