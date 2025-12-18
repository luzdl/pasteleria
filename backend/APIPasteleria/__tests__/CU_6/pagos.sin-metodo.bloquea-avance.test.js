const request = require("supertest");
const app = require("../../app");
const pool = require("../../db/db");
const jwt = require("jsonwebtoken");

describe("CU6 - Gestionar Pagos", () => {
  it("CU6-CP23 Intentar continuar sin seleccionar método de pago", async () => {
    const username = process.env.TEST_LOGIN_USER || "testuser";
    const password = process.env.TEST_LOGIN_PASSWORD || "testpass";
    const jwtSecret = process.env.JWT_SECRET || "secret";

    let productoId;

    try {
      // 1) Login (rol ventas)
      const loginRes = await request(app)
        .post("/api/usuarios/login")
        .send({ username, password })
        .expect("Content-Type", /json/);

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty("token");

      const token = loginRes.body.token;
      const authHeader = { Authorization: `Bearer ${token}` };
      const payload = jwt.verify(token, jwtSecret);

      expect(payload).toHaveProperty("id");
      const usuarioId = payload.id;

      // 2) Snapshot de compras antes
      const [comprasBefore] = await pool.query(
        "SELECT id FROM compras WHERE usuario_id = ? ORDER BY id ASC",
        [usuarioId]
      );
      const comprasBeforeIds = comprasBefore.map((c) => c.id);

      // 3) Preparar carrito (total esperado 4.00)
      const uniqueName = `Producto CI Sin Metodo 4.00 ${Date.now()}`;
      const [insertProducto] = await pool.query(
        "INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado) VALUES (?, ?, ?, ?, ?)",
        [uniqueName, 1, 4.0, 10, "disponible"]
      );
      productoId = insertProducto.insertId;

      const addRes = await request(app)
        .post("/api/ventas/agregar")
        .set(authHeader)
        .send({ nombre: uniqueName, cantidad: 1 })
        .expect("Content-Type", /json/);

      expect(addRes.status).toBe(200);

      // 4) Intentar continuar sin seleccionar método: llamar seleccionar sin metodoPago
      const seleccionarRes = await request(app)
        .post("/api/gestionarPagos/seleccionar")
        .set(authHeader)
        .send({})
        .expect("Content-Type", /json/);

      expect(seleccionarRes.status).toBe(400);
      expect(seleccionarRes.body).toEqual({ mensaje: "Método de pago no válido" });

      console.log(
        "[EVIDENCE][CU6-CP23] EXPECTED status=400 body={mensaje:'Método de pago no válido'} (bloquea avance sin método) | ACTUAL status=%s body=%s",
        seleccionarRes.status,
        JSON.stringify(seleccionarRes.body)
      );

      // 5) Postcondiciones: no debe crearse compra
      const [comprasAfter] = await pool.query(
        "SELECT id FROM compras WHERE usuario_id = ? ORDER BY id ASC",
        [usuarioId]
      );
      const comprasAfterIds = comprasAfter.map((c) => c.id);

      expect(comprasAfterIds).toEqual(comprasBeforeIds);

      // 6) Postcondiciones: carrito permanece (no se confirma pago)
      const [carritoRows] = await pool.query(
        "SELECT cantidad, total FROM carrito WHERE usuario_id = ? AND producto_id = ?",
        [usuarioId, productoId]
      );

      expect(carritoRows.length).toBe(1);
      expect(Number(carritoRows[0].cantidad)).toBe(1);
      expect(Number(carritoRows[0].total)).toBeCloseTo(4.0, 2);

      console.log(
        "[EVIDENCE][CU6-CP23][postcondiciones] EXPECTED carrito intacto (cantidad=1 total=4.00) y compras sin cambios | ACTUAL carrito=%s comprasBefore=%s comprasAfter=%s",
        JSON.stringify(carritoRows[0]),
        JSON.stringify(comprasBeforeIds),
        JSON.stringify(comprasAfterIds)
      );
    } finally {
      if (productoId) {
        await pool.query("DELETE FROM carrito WHERE producto_id = ?", [productoId]);
        await pool.query("DELETE FROM productos WHERE id = ?", [productoId]);
      }
    }
  });
});
