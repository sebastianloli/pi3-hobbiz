import { createApp } from "./app.js";
import { connectDatabase, mongoClient } from "./db.js";

const port = Number(process.env.PORT || 3001);

try {
  await connectDatabase();
  console.log("MongoDB conectado correctamente");

  const app = createApp();

  app.listen(port, "127.0.0.1", () => {
    console.log(`Hobbiz: http://127.0.0.1:${port}`);
    console.log("Guardado de perfiles preparado.");
    console.log("Los demás datos siguen en modo de demostración.");
  });
} catch (error) {
  console.error("No se pudo iniciar:", error.message);
  await mongoClient.close();
  process.exitCode = 1;
}