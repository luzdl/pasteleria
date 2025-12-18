const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");
const pool = require("../../db/db");

describe("CU05 - Facturar", () => {
  /**
   * CASO DE PRUEBA CP-18 — Stock insuficiente al facturar
   * 
   * Objeto: Módulo de ventas-Facturar
   * Objetivo: Verificar que el sistema impida continuar cuando el producto seleccionado 
   *           no tiene stock suficiente y obligue a corregir la cantidad (flujo alternativo).
   * Precondiciones: Usuario autenticado como Administrador de Ventas. 
   *                 Existe un producto con stock menor a la cantidad solicitada.
   * Valores de entrada: Producto: cualquiera con stock bajo, Cantidad: Mayor al stock disponible
   * Resultado esperado: El sistema muestra un mensaje indicando que no hay suficiente 
   *                     cantidad disponible, no permite avanzar a pagos y retorna al 
   *                     ajuste del carrito/cantidad.
   * Postcondiciones: No se inicia el flujo de pago. El carrito queda sin confirmar 
   *                  hasta corregir cantidades.
   */

  let token;
  let testUserId;
  const productoNombre = "Producto Stock Bajo";
  const stockDisponible = 5;

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

    // Precondición: Crear producto con stock bajo para la prueba
    try {
      await pool.query(
        "INSERT IGNORE INTO categorias (id, nombre) VALUES (2, 'Pan')"
      );
      await pool.query(
        `INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado)
         VALUES (?, 2, 2.50, ?, 'disponible')
         ON DUPLICATE KEY UPDATE stock = ?, estado = 'disponible'`,
        [productoNombre, stockDisponible, stockDisponible]
      );
    } catch (error) {
      // Ignorar si falla
    }
  });

  beforeEach(async () => {
    try {
      await pool.query("DELETE FROM carrito WHERE usuario_id = ?", [testUserId]);
    } catch (error) {
      // Ignorar si falla
    }
  });

  it("CP-18 - Stock insuficiente al intentar agregar producto", async () => {
    // Datos de entrada: Cantidad mayor al stock disponible
    const cantidadSolicitada = stockDisponible + 10; // Mayor al stock

    const requestBody = {
      nombre: productoNombre,
      cantidad: cantidadSolicitada
    };

    // Ejecución pasos 1-2: Iniciar venta y agregar producto con cantidad excesiva
    const response = await request(app)
      .post("/api/ventas/agregar")
      .set("Authorization", `Bearer ${token}`)
      .send(requestBody)
      .expect("Content-Type", /json/);

    // Resultado esperado: El sistema rechaza la operación (status 400)
    expect(response.status).toBe(400);

    // Verificar que existe mensaje de error
    expect(response.body).toHaveProperty("mensaje");

    // Verificar que el mensaje indica problema de stock
    expect(response.body.mensaje.toLowerCase()).toMatch(/stock|cantidad|excede|disponible/);

    // Postcondición: El producto NO debe estar en el carrito
    expect(response.body.producto).toBeUndefined();

    // Verificar postcondición: El carrito no tiene el producto con cantidad excesiva
    const carritoResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoResponse.status).toBe(200);

    // Si hay items, ninguno debe tener la cantidad excesiva
    if (carritoResponse.body.length > 0) {
      const productoConExceso = carritoResponse.body.find(
        item => item.nombre === productoNombre && item.cantidad === cantidadSolicitada
      );
      expect(productoConExceso).toBeUndefined();
    }
  });
});
