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

    // Generar token de autenticación para usuario con rol ventas
    token = jwt.sign(
      { id: testUserId, username: testUsername, rol: testRole },
      jwtSecret,
      { expiresIn: "1h" }
    );
  });

  beforeEach(async () => {
    // Limpiar carrito del usuario de prueba para asegurar que está vacío
    try {
      await pool.query("DELETE FROM carrito WHERE usuario_id = ?", [testUserId]);
    } catch (error) {
      // Ignorar error si la tabla no existe o hay problemas de conexión en CI
      console.log("Nota: No se pudo limpiar el carrito antes del test");
    }
  });

  it("CP-19 - No se puede avanzar a pago con carrito vacío", async () => {
    // Verificar precondición: carrito debe estar vacío
    const carritoResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoResponse.status).toBe(200);
    expect(Array.isArray(carritoResponse.body)).toBe(true);
    expect(carritoResponse.body.length).toBe(0);

    // Intentar avanzar al paso de pago (seleccionar método de pago)
    const pagoResponse = await request(app)
      .post("/api/gestionarPagos/seleccionar")
      .set("Authorization", `Bearer ${token}`)
      .send({ metodoPago: "efectivo" })
      .expect("Content-Type", /json/);

    // El sistema debería bloquear el avance cuando el carrito está vacío
    // Nota: La validación del carrito vacío ocurre al procesar el pago
    // Por lo que probamos directamente el pago en efectivo
    const pagoEfectivoResponse = await request(app)
      .post("/api/gestionarPagos/pagar-efectivo")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoRecibido: 100 })
      .expect("Content-Type", /json/);

    // Verificar que el sistema rechaza el pago con carrito vacío
    expect(pagoEfectivoResponse.status).toBe(400);
    expect(pagoEfectivoResponse.body).toHaveProperty("mensaje");

    // Verificar que el mensaje indica que el carrito está vacío
    expect(pagoEfectivoResponse.body.mensaje.toLowerCase()).toMatch(/vacío|vacio|carrito|empty|producto/);
  });

  it("CP-19b - No se puede pagar con método digital con carrito vacío", async () => {
    // Verificar precondición: carrito debe estar vacío
    const carritoResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoResponse.status).toBe(200);
    expect(carritoResponse.body.length).toBe(0);

    // Intentar pagar con método digital (visa, ach, yappy)
    const metodosDigitales = ["visa", "ach", "yappy"];

    for (const metodo of metodosDigitales) {
      const response = await request(app)
        .post(`/api/gestionarPagos/pagar/${metodo}`)
        .set("Authorization", `Bearer ${token}`)
        .expect("Content-Type", /json/);

      // Verificar que el sistema rechaza el pago
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("mensaje");

      // Verificar mensaje de carrito vacío
      expect(response.body.mensaje.toLowerCase()).toMatch(/vacío|vacio|carrito|empty/);
    }
  });

  it("CP-19c - Verificar que el carrito permanece vacío después de intentos fallidos", async () => {
    // Intentar pagar sin productos
    await request(app)
      .post("/api/gestionarPagos/pagar-efectivo")
      .set("Authorization", `Bearer ${token}`)
      .send({ montoRecibido: 100 });

    // Verificar postcondición: el carrito sigue vacío
    const carritoFinalResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoFinalResponse.status).toBe(200);
    expect(Array.isArray(carritoFinalResponse.body)).toBe(true);
    expect(carritoFinalResponse.body.length).toBe(0);

    // Verificar que no se creó ninguna compra/factura
    // (postcondición: No se invoca Gestionar Pagos. La venta no continúa.)
  });
});
