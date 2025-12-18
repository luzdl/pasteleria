const request = require("supertest");
const app = require("../../app");

describe("CU01 - Autenticación de Usuarios", () => {
  it("CU01-CP01 Login exitoso con credenciales válidas", async () => {
    const username = process.env.TEST_LOGIN_USER || "testuser";
    const password = process.env.TEST_LOGIN_PASSWORD || "testpass";

    const response = await request(app)
      .post("/api/usuarios/login")
      .send({ username, password })
      .expect("Content-Type", /json/);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
  });
});
