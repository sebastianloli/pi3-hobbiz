import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDmI9l82ZTdbR8NYuS67n3yTU7IGgZhXZM",
  authDomain: "hobbiz-597c5.firebaseapp.com",
  projectId: "hobbiz-597c5",
  storageBucket: "hobbiz-597c5.firebasestorage.app",
  messagingSenderId: "738422237274",
  appId: "1:738422237274:web:3cc3484bb2c97a5bf95063"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };