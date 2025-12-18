const request = require("supertest");
const app = require("../../app");

describe("CU1 - Autenticación de Usuarios", () => {
  it("CU1-CP3 Campo vacío - Falta contraseña", async () => {
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

    console.log(
      "[EVIDENCE][CU3-CP3] EXPECTED status=400 body={mensaje:'Debe ingresar usuario y contraseña'} | ACTUAL status=%s body=%s",
      response.status,
      JSON.stringify(response.body)
    );
  });
});
