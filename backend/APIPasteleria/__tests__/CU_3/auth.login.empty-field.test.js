const request = require("supertest");
const app = require("../../app");

describe("CU3 - Autenticación de Usuarios", () => {
  it("CU3-CP2 Campo vacío - Debe ingresar usuario y contraseña", async () => {
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

    console.log(
      "[EVIDENCE][CU3-CP2] EXPECTED status=400 body={mensaje:'Debe ingresar usuario y contraseña'} | ACTUAL status=%s body=%s",
      response.status,
      JSON.stringify(response.body)
    );
  });
});
