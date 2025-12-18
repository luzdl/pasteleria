const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");

describe("CU1 - Autenticación de Usuarios", () => {
  it("CU1-CP1 Login exitoso con credenciales válidas", async () => {
    const username = process.env.TEST_LOGIN_USER || "testuser";
    const password = process.env.TEST_LOGIN_PASSWORD || "testpass";
    const expectedRole = process.env.TEST_LOGIN_ROLE || "ventas";
    const jwtSecret = process.env.JWT_SECRET || "secret";

    expect(typeof username).toBe("string");
    expect(username.length).toBeGreaterThan(0);
    expect(typeof password).toBe("string");
    expect(password.length).toBeGreaterThan(0);

    const requestBody = { username, password };

    const response = await request(app)
      .post("/api/usuarios/login")
      .send(requestBody)
      .expect("Content-Type", /json/);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
    expect(Object.keys(response.body)).toEqual(["token"]);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.length).toBeGreaterThan(0);

    console.log(
      "[EVIDENCE][CU3-CP1] EXPECTED status=200 body has token (only token) | ACTUAL status=%s body=%s",
      response.status,
      JSON.stringify(response.body)
    );

    const payload = jwt.verify(response.body.token, jwtSecret);
    expect(payload).toHaveProperty("id");
    expect(typeof payload.id).toBe("number");
    expect(payload).toHaveProperty("username", username);
    expect(payload).toHaveProperty("rol", expectedRole);
    expect(payload).toHaveProperty("iat");
    expect(payload).toHaveProperty("exp");

    console.log(
      "[EVIDENCE][CU3-CP1] EXPECTED jwt.username=%s jwt.rol=%s | ACTUAL jwt.username=%s jwt.rol=%s",
      username,
      expectedRole,
      payload.username,
      payload.rol
    );
  });
});
