import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true
});

const template = process.env.MONGODB_URI;
const password = process.env.MONGODB_PASSWORD;

if (!template || !password) {
  throw new Error("Faltan los datos de MongoDB en backend/.env");
}

if (!template.includes("<db_password>") && !template.includes("<password>")) {
  throw new Error(
    "La dirección debe conservar <db_password> o <password>."
  );
}

const uri = template
  .replace("<db_password>", encodeURIComponent(password))
  .replace("<password>", encodeURIComponent(password));

export const mongoClient = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000
});

export const db = mongoClient.db(
  process.env.MONGODB_DB || "hobbiz"
);

export async function connectDatabase() {
  await mongoClient.connect();
  await db.command({ ping: 1 });
}