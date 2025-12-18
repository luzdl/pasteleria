const request = require("supertest");
const app = require("../../app");
const pool = require("../../db/db");
const jwt = require("jsonwebtoken");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function binaryParser(res, callback) {
  res.setEncoding("binary");
  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });
  res.on("end", () => {
    callback(null, Buffer.from(data, "binary"));
  });
}

describe("CU4 - Reportes", () => {
  it("CU4-CP13 Generar reporte de ventas en PDF dentro del mes actual", async () => {
    const username = process.env.TEST_LOGIN_USER || "testuser";
    const password = process.env.TEST_LOGIN_PASSWORD || "testpass";
    const jwtSecret = process.env.JWT_SECRET || "secret";

    const now = new Date();
    const year = now.getFullYear();
    const month = pad2(now.getMonth() + 1);

    const inicio = `${year}-${month}-01`;
    const fin = `${year}-${month}-15`;
    const ventaFecha = `${year}-${month}-02 10:00:00`;

    let compraId;

    try {
      const loginRes = await request(app)
        .post("/api/usuarios/login")
        .send({ username, password })
        .expect("Content-Type", /json/);

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty("token");

      const token = loginRes.body.token;
      const payload = jwt.verify(token, jwtSecret);
      expect(payload).toHaveProperty("id");

      const usuarioId = payload.id;
      const transactionId = `ci-pdf-ventas-${Date.now()}`;

      const [insertCompra] = await pool.query(
        "INSERT INTO compras (usuario_id, fecha, total, metodo_pago, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?)",
        [usuarioId, ventaFecha, 4.0, "visa", "success", transactionId]
      );

      compraId = insertCompra.insertId;

      const res = await request(app)
        .get("/api/reportes/ventas")
        .query({ inicio, fin, formato: "pdf" })
        .buffer(true)
        .parse(binaryParser);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.slice(0, 4).toString()).toBe("%PDF");
      expect(res.body.length).toBeGreaterThan(100);

      console.log(
        "[EVIDENCE][CU4-CP13] EXPECTED status=200 Content-Type=application/pdf body startsWith='%PDF' inicio=%s fin=%s | ACTUAL status=%s Content-Type=%s firstBytes=%s length=%s",
        inicio,
        fin,
        res.status,
        res.headers["content-type"],
        res.body.slice(0, 10).toString(),
        res.body.length
      );
    } finally {
      if (compraId) {
        await pool.query("DELETE FROM compras WHERE id = ?", [compraId]);
      }
    }
  });
});
