const request = require("supertest");
const app = require("../../app");

describe("CU1 - Autenticación de Usuarios", () => {
  it("CU1-CP4 Contraseña inválida - Contraseña incorrecta", async () => {
    const requestBody = {
      username: "diegoventas",
      password: "contrasenamala123",
    };

    const response = await request(app)
      .post("/api/usuarios/login")
      .send(requestBody)
      .expect("Content-Type", /json/);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ mensaje: "Contraseña incorrecta" });
  });
});
