const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");
const pool = require("../../db/db");

describe("CU05 - Facturar", () => {
  /**
   * CASO DE PRUEBA CP-17 — Iniciar venta y agregar producto al carrito
   * 
   * Objeto: Módulo de ventas-Facturar
   * Objetivo: Verificar que el sistema permita iniciar una venta, ingresar un producto 
   *           existente y agregarlo al carrito mostrando subtotal y total.
   * Precondiciones: Usuario autenticado como Administrador de Ventas. 
   *                 Existe al menos 1 producto registrado con stock suficiente.
   * Valores de entrada: Producto: Pan de Masa Madre, Cantidad: 1
   * Resultado esperado: El producto se agrega al carrito, se muestra en la tabla 
   *                     y el Total se actualiza correctamente.
   * Postcondiciones: Carrito queda activo con 1 ítem agregado.
   */

  let token;
  let testUserId;
  const productoNombre = "Pan de Masa Madre";

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

    // Precondición: Asegurar que existe la categoría y el producto de prueba
    try {
      await pool.query(
        "INSERT IGNORE INTO categorias (id, nombre) VALUES (2, 'Pan')"
      );
      await pool.query(
        `INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado)
         VALUES (?, 2, 3.50, 100, 'disponible')
         ON DUPLICATE KEY UPDATE stock = 100, estado = 'disponible'`,
        [productoNombre]
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

  it("CP-17 - Agregar producto al carrito exitosamente", async () => {
    // Datos de entrada según CP-17
    const cantidad = 1;

    const requestBody = {
      nombre: productoNombre,
      cantidad: cantidad
    };

    // Paso 1: Agregar producto al carrito (equivalente a iniciar venta y agregar producto)
    const response = await request(app)
      .post("/api/ventas/agregar")
      .set("Authorization", `Bearer ${token}`)
      .send(requestBody)
      .expect("Content-Type", /json/);

    // Verificar respuesta exitosa
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("mensaje");
    expect(response.body).toHaveProperty("producto");

    // Verificar que el mensaje indica éxito
    expect(["Producto agregado al carrito", "Cantidad del producto actualizada en el carrito"]).toContain(response.body.mensaje);

    // Verificar estructura del producto retornado
    expect(response.body.producto).toHaveProperty("nombre");
    expect(response.body.producto).toHaveProperty("cantidad");
    expect(response.body.producto).toHaveProperty("total");

    // Verificar tipos de datos
    expect(typeof response.body.producto.nombre).toBe("string");
    expect(typeof response.body.producto.cantidad).toBe("number");
    expect(typeof response.body.producto.total).toBe("number");

    // Verificar que la cantidad es la solicitada o mayor (si ya existía en carrito)
    expect(response.body.producto.cantidad).toBeGreaterThanOrEqual(cantidad);

    // Verificar que el total es positivo
    expect(response.body.producto.total).toBeGreaterThan(0);

    // Paso 2: Verificar que el producto aparece en el listado del carrito
    const carritoResponse = await request(app)
      .get("/api/ventas/")
      .set("Authorization", `Bearer ${token}`)
      .expect("Content-Type", /json/);

    expect(carritoResponse.status).toBe(200);
    expect(Array.isArray(carritoResponse.body)).toBe(true);
    expect(carritoResponse.body.length).toBeGreaterThan(0);

    // Verificar que el producto agregado está en el carrito
    const productoEnCarrito = carritoResponse.body.find(
      item => item.nombre === productoNombre
    );
    expect(productoEnCarrito).toBeDefined();

    // Verificar estructura del item en carrito (precio unitario, total, etc.)
    expect(productoEnCarrito).toHaveProperty("id"); // Para botón eliminar
    expect(productoEnCarrito).toHaveProperty("nombre");
    expect(productoEnCarrito).toHaveProperty("cantidad");
    expect(productoEnCarrito).toHaveProperty("precio_unitario");
    expect(productoEnCarrito).toHaveProperty("total");

    // Verificar cálculo correcto del total
    const totalEsperado = productoEnCarrito.cantidad * productoEnCarrito.precio_unitario;
    expect(parseFloat(productoEnCarrito.total)).toBeCloseTo(totalEsperado, 2);
  });
});
