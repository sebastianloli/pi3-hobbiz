import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      projectId: "hobbiz-597c5"
    });

export const firebaseAuth = getAuth(app);