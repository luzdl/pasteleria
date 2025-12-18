const request = require("supertest");
const app = require("../../app");
const pool = require("../../db/db");
const jwt = require("jsonwebtoken");

describe("CU6 - Gestionar Pagos", () => {
  it("CU6-CP22 Efectivo - Monto recibido menor al total", async () => {
    const username = process.env.TEST_LOGIN_USER || "testuser";
    const password = process.env.TEST_LOGIN_PASSWORD || "testpass";
    const jwtSecret = process.env.JWT_SECRET || "secret";

    let productoId;

    try {
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

      const [comprasBefore] = await pool.query(
        "SELECT id FROM compras WHERE usuario_id = ? ORDER BY id ASC",
        [usuarioId]
      );
      const comprasBeforeIds = comprasBefore.map((c) => c.id);

      const uniqueName = `Producto CI Efectivo 4.00 ${Date.now()}`;
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

      const seleccionarRes = await request(app)
        .post("/api/gestionarPagos/seleccionar")
        .set(authHeader)
        .send({ metodoPago: "efectivo" })
        .expect("Content-Type", /json/);

      expect(seleccionarRes.status).toBe(200);
      expect(seleccionarRes.body).toHaveProperty(
        "mensaje",
        "Método efectivo seleccionado, falta monto recibido"
      );
      expect(seleccionarRes.body).toHaveProperty("requiereMonto", true);

      console.log(
        "[EVIDENCE][CU6-CP22][seleccionar] EXPECTED status=200 mensaje='Método efectivo seleccionado, falta monto recibido' requiereMonto=true | ACTUAL status=%s body=%s",
        seleccionarRes.status,
        JSON.stringify(seleccionarRes.body)
      );

      const pagarRes = await request(app)
        .post("/api/gestionarPagos/pagar-efectivo")
        .set(authHeader)
        .send({ montoRecibido: 3.0 })
        .expect("Content-Type", /json/);

      expect(pagarRes.status).toBe(400);
      expect(pagarRes.body).toEqual({
        mensaje: "El monto recibido es menor que el total",
      });

      console.log(
        "[EVIDENCE][CU6-CP22][pagar-efectivo] EXPECTED status=400 mensaje='El monto recibido es menor que el total' total=4.00 montoRecibido=3.00 | ACTUAL status=%s body=%s",
        pagarRes.status,
        JSON.stringify(pagarRes.body)
      );

      const [carritoRows] = await pool.query(
        "SELECT cantidad, total FROM carrito WHERE usuario_id = ? AND producto_id = ?",
        [usuarioId, productoId]
      );

      expect(carritoRows.length).toBe(1);
      expect(Number(carritoRows[0].cantidad)).toBe(1);
      expect(Number(carritoRows[0].total)).toBeCloseTo(4.0, 2);

      console.log(
        "[EVIDENCE][CU6-CP22][postcondiciones] EXPECTED carrito intacto (cantidad=1 total=4.00) y compras sin cambios | ACTUAL carrito=%s",
        JSON.stringify(carritoRows[0])
      );

      const [comprasAfter] = await pool.query(
        "SELECT id FROM compras WHERE usuario_id = ? ORDER BY id ASC",
        [usuarioId]
      );
      const comprasAfterIds = comprasAfter.map((c) => c.id);

      expect(comprasAfterIds).toEqual(comprasBeforeIds);
    } finally {
      if (productoId) {
        await pool.query("DELETE FROM carrito WHERE producto_id = ?", [productoId]);
        await pool.query("DELETE FROM productos WHERE id = ?", [productoId]);
      }
    }
  });
});
