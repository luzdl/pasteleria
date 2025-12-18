const request = require("supertest");
const app = require("../../app");
const jwt = require("jsonwebtoken");

describe("CU01 - Autenticación de Usuarios", () => {
  it("CU01-CP01 Login exitoso con credenciales válidas", async () => {
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

    const payload = jwt.verify(response.body.token, jwtSecret);
    expect(payload).toHaveProperty("id");
    expect(typeof payload.id).toBe("number");
    expect(payload).toHaveProperty("username", username);
    expect(payload).toHaveProperty("rol", expectedRole);
    expect(payload).toHaveProperty("iat");
    expect(payload).toHaveProperty("exp");
  });
});
