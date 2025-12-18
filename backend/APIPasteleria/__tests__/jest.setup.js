const pool = require("../db/db");

afterAll(async () => {
  try {
    await pool.end();
  } catch (e) {
    // ignore
  }
});
