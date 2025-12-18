const request = require("supertest");
const app = require("../../app");

describe("CU01 - Autenticación de Usuarios", () => {
  it("CU01-CP05 Campo vacío - Falta contraseña", async () => {
    const requestBody = {
      username: "admin",
      password: "",
    };

    const response = await request(app)
      .post("/api/usuarios/login")
      .send(requestBody)
      .expect("Content-Type", /json/);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: "Debe ingresar usuario y contraseña" });
  });
});
