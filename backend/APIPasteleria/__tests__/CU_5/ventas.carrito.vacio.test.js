const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");
const pool = require("../../db/db");

describe("CU05 - Facturar", () => {
  /**
   * CASO DE PRUEBA CP-19 — Intentar avanzar con carrito vacío
   * 
   * Objeto: Módulo de ventas-Facturar
   * Objetivo: Validar que el sistema no permita avanzar al paso de pago si no hay 
   *           productos agregados al carrito.
   * Precondiciones: Usuario autenticado como Administrador de Ventas. 
   *                 Venta iniciada. Carrito sin productos.
   * Valores de entrada: Carrito: vacío
   * Resultado esperado: El sistema bloquea el avance y muestra un mensaje tipo: 
   *                     "Debe agregar al menos un producto para continuar" 
   *                     (o mantiene "Siguiente" deshabilitado).
   * Postcondiciones: No se invoca Gestionar Pagos. La venta no continúa.
   */

  let token;
  let testUserId;

  beforeAll(async () => {
    const jwtSecret = process.env.JWT_SECRET || "secret";
    testUserId = parseInt(process.env.TEST_USER_ID) || 1;
    const testUsername = process.env.TEST_LOGIN_USER || "testuser";
    const testRole = process.env.TEST_LOGIN_ROLE || "ventas";

    token = jwt.sign(
      { id: testUserId, username: testUsername, rol: testRole },
      jwtSecret,
      { expiresIn: "1h" }
    );
  });

  beforeEach(async () => {
    // Precondición: Asegurar que el carrito está vacío
    try {
      await pool.query("DELETE FROM carrito WHERE usuario_id = ?", [testUserId]);
    } catch (error) {
      // Ignorar si falla
    }
  });

  it("CP-19 - No se puede avanzar a pago con carrito vacío", async () => {
    // Verificar precondición: carrito vacío
    const carritoResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoResponse.status).toBe(200);
    expect(Array.isArray(carritoResponse.body)).toBe(true);
    expect(carritoResponse.body.length).toBe(0);

    // Ejecución paso 3: Intentar avanzar al pago (clic en Siguiente)
    // Probar con pago en efectivo
    const pagoEfectivoResponse = await request(app)
      .post("/api/gestionarPagos/pagar-efectivo")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoRecibido: 100 })
      .expect("Content-Type", /json/);

    // Resultado esperado: El sistema bloquea el avance (status 400)
    expect(pagoEfectivoResponse.status).toBe(400);

    // Verificar mensaje de error
    expect(pagoEfectivoResponse.body).toHaveProperty("mensaje");
    expect(pagoEfectivoResponse.body.mensaje.toLowerCase()).toMatch(/vacío|vacio|carrito|empty/);

    // Probar también con método digital
    const pagoDigitalResponse = await request(app)
      .post("/api/gestionarPagos/pagar/visa")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    // Resultado esperado: También rechaza el pago
    expect(pagoDigitalResponse.status).toBe(400);
    expect(pagoDigitalResponse.body).toHaveProperty("mensaje");
    expect(pagoDigitalResponse.body.mensaje.toLowerCase()).toMatch(/vacío|vacio|carrito|empty/);

    // Postcondición: Verificar que el carrito sigue vacío (no se procesó nada)
    const carritoFinalResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoFinalResponse.status).toBe(200);
    expect(carritoFinalResponse.body.length).toBe(0);
  });
});
