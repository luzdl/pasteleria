const request = require("supertest");
const app = require("../../app");
const pool = require("../../db/db");

describe("CU6 - Gestionar Pagos", () => {
  it("CU6-CP21 Selección de método: Efectivo - Confirmación", async () => {
    const username = process.env.TEST_LOGIN_USER || "testuser";
    const password = process.env.TEST_LOGIN_PASSWORD || "testpass";

    let productoId;
    let compraId;

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

      // 2) Preparar producto con precio 4.00 y stock suficiente
      const uniqueName = `Producto CI Efectivo 4.00 ${Date.now()}`;
      const [insertProducto] = await pool.query(
        "INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado) VALUES (?, ?, ?, ?, ?)",
        [uniqueName, 1, 4.0, 10, "disponible"]
      );

      productoId = insertProducto.insertId;

      // 3) Agregar al carrito cantidad 1 => total esperado 4.00
      const addRes = await request(app)
        .post("/api/ventas/agregar")
        .set(authHeader)
        .send({ nombre: uniqueName, cantidad: 1 })
        .expect("Content-Type", /json/);

      expect(addRes.status).toBe(200);

      // 4) Seleccionar método efectivo
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
        "[EVIDENCE][CU6-CP21][seleccionar] EXPECTED status=200 mensaje='Método efectivo seleccionado, falta monto recibido' requiereMonto=true | ACTUAL status=%s body=%s",
        seleccionarRes.status,
        JSON.stringify(seleccionarRes.body)
      );

      // 5) Confirmar pago en efectivo (monto recibido = 4.00)
      const pagarRes = await request(app)
        .post("/api/gestionarPagos/pagar-efectivo")
        .set(authHeader)
        .send({ montoRecibido: 4.0 })
        .expect("Content-Type", /json/);

      expect(pagarRes.status).toBe(200);
      expect(pagarRes.body).toHaveProperty("mensaje", "Pago en efectivo confirmado");

      console.log(
        "[EVIDENCE][CU6-CP21][pagar-efectivo] EXPECTED status=200 mensaje='Pago en efectivo confirmado' compra.metodo_pago='efectivo' total=4.00 montoRecibido=4.00 cambio=0.00 | ACTUAL status=%s body=%s",
        pagarRes.status,
        JSON.stringify(pagarRes.body)
      );

      expect(pagarRes.body).toHaveProperty("compra");
      expect(pagarRes.body.compra).toHaveProperty("id");
      compraId = pagarRes.body.compra.id;

      expect(pagarRes.body.compra).toHaveProperty("metodo_pago", "efectivo");
      expect(Number(pagarRes.body.compra.total)).toBeCloseTo(4.0, 2);
      expect(Number(pagarRes.body.compra.montoRecibido)).toBeCloseTo(4.0, 2);
      expect(Number(pagarRes.body.compra.cambio)).toBeCloseTo(0.0, 2);
    } finally {
      // Limpieza idempotente
      if (compraId) {
        await pool.query("DELETE FROM detalle_compra WHERE compra_id = ?", [compraId]);
        await pool.query("DELETE FROM compras WHERE id = ?", [compraId]);
      }

      if (productoId) {
        await pool.query("DELETE FROM carrito WHERE producto_id = ?", [productoId]);
        await pool.query("DELETE FROM productos WHERE id = ?", [productoId]);
      }
    }
  });
});
