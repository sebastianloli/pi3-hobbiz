import { Router } from "express";
import { firebaseAuth } from "./firebase-admin.js";
import { db } from "./db.js";

export const accountsRouter = Router();

accountsRouter.use(async (req, res, next) => {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Inicia sesión para continuar."
    });
  }

  try {
    req.firebaseUser = await firebaseAuth.verifyIdToken(
      header.slice(7)
    );
    next();
  } catch {
    res.status(401).json({
      error: "Tu sesión no es válida. Vuelve a ingresar."
    });
  }
});

accountsRouter.post("/", async (req, res) => {
  const { name, role } = req.body || {};

  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({
      error: "Escribe un nombre de al menos dos caracteres."
    });
  }

  if (!["client", "instructor"].includes(role)) {
    return res.status(400).json({
      error: "Selecciona cliente o tallerista."
    });
  }

  const { uid, email } = req.firebaseUser;

  if (!email) {
    return res.status(400).json({
      error: "La cuenta necesita un correo electrónico."
    });
  }

  try {
    await db.collection("users").updateOne(
      { _id: uid },
      {
        $setOnInsert: {
          id: uid,
          email,
          name: name.trim(),
          role,
          preferences: {
            interests: [],
            budget: 100,
            district: "Miraflores",
            day: ""
          },
          favorites: [],
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    const user = await db.collection("users").findOne(
      { _id: uid },
      { projection: { _id: 0 } }
    );

    res.json({ user });
  } catch {
    res.status(500).json({
      error: "No se pudo guardar el perfil. Inténtalo nuevamente."
    });
  }
});

accountsRouter.get("/", async (req, res) => {
  try {
    const user = await db.collection("users").findOne(
      { _id: req.firebaseUser.uid },
      { projection: { _id: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        error: "Todavía falta crear el perfil."
      });
    }

    res.json({ user });
  } catch {
    res.status(500).json({
      error: "No se pudo consultar el perfil."
    });
  }
});

accountsRouter.patch("/", async (req, res) => {
  const { name, budget, district } = req.body || {};

  const districts = [
    "Miraflores",
    "Barranco",
    "San Isidro",
    "Pueblo Libre",
    "Santiago de Surco",
    "Jesús María",
    "Magdalena del Mar",
    "San Miguel"
  ];

  if (typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({
      error: "Escribe un nombre de al menos dos caracteres."
    });
  }

  if (
    typeof budget !== "number" ||
    !Number.isFinite(budget) ||
    budget < 0 ||
    budget > 9999
  ) {
    return res.status(400).json({
      error: "El presupuesto debe estar entre 0 y 9999."
    });
  }

  if (!districts.includes(district)) {
    return res.status(400).json({
      error: "Selecciona un distrito de la lista."
    });
  }

  try {
    const result = await db.collection("users").updateOne(
      { _id: req.firebaseUser.uid },
      {
        $set: {
          name: name.trim(),
          "preferences.budget": budget,
          "preferences.district": district
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: "No se encontró tu perfil."
      });
    }

    const user = await db.collection("users").findOne(
      { _id: req.firebaseUser.uid },
      { projection: { _id: 0 } }
    );

    res.json({ user });
  } catch {
    res.status(500).json({
      error: "No se pudieron guardar los cambios."
    });
  }
});