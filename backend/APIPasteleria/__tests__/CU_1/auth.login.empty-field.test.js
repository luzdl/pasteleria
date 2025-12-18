const request = require("supertest");
const app = require("../../app");

describe("CU1 - Autenticación de Usuarios", () => {
  it("CU1-CP2 Campo vacío - Debe ingresar usuario y contraseña", async () => {
    const requestBody = {
      username: "",
      password: "admin12345678",
    };

    const response = await request(app)
      .post("/api/usuarios/login")
      .send(requestBody)
      .expect("Content-Type", /json/);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ mensaje: "Debe ingresar usuario y contraseña" });
  });
});
