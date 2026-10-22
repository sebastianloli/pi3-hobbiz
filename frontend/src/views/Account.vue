<script setup>
import { ref, onMounted } from "vue";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { request } from "../lib/api";

const name = ref("");
const email = ref("");
const password = ref("");
const role = ref("client");
const signup = ref(true);
const busy = ref(true);
const message = ref("");
const profile = ref(null);
const editing = ref(false);
const editName = ref("");
const editBudget = ref(100);
const editDistrict = ref("Miraflores");

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

function startEditing() {
  editName.value = profile.value.name;
  editBudget.value = profile.value.preferences?.budget ?? 100;
  editDistrict.value =
    profile.value.preferences?.district || "Miraflores";
  editing.value = true;
  message.value = "";
}

async function saveProfile() {
  busy.value = true;
  message.value = "";

  try {
    const token = await auth.currentUser.getIdToken();

    const result = await request("/account", {
      method: "PATCH",
      token,
      body: {
        name: editName.value.trim(),
        budget: Number(editBudget.value),
        district: editDistrict.value
      }
    });

    profile.value = result.user;
    editing.value = false;
    message.value = "Cambios guardados.";
  } catch (error) {
    message.value = explain(error);
  } finally {
    busy.value = false;
  }
}

function explain(error) {
  const messages = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
    "auth/invalid-credential": "Revisa el correo y la contraseña.",
    "auth/weak-password": "Usa una contraseña más larga.",
    "auth/invalid-email": "Revisa el correo electrónico.",
    "auth/operation-not-allowed":
      "Falta habilitar correo y contraseña en Firebase.",
    "auth/network-request-failed": "Revisa tu conexión a internet.",
    "auth/too-many-requests": "Espera unos minutos y vuelve a intentar."
  };

  return messages[error.code] || error.message || "Ocurrió un error.";
}

async function loadProfile() {
  const token = await auth.currentUser.getIdToken();
  const result = await request("/account", { token });
  profile.value = result.user;
}

onMounted(async () => {
  try {
    await auth.authStateReady();

    if (auth.currentUser) {
      email.value = auth.currentUser.email || "";
      await loadProfile();
    }
  } catch (error) {
    message.value = explain(error);
  } finally {
    busy.value = false;
  }
});

async function submit() {
  busy.value = true;
  message.value = "";
  profile.value = null;

  try {
    let credential;

    if (signup.value) {
      try {
        credential = await createUserWithEmailAndPassword(
          auth,
          email.value.trim(),
          password.value
        );
      } catch (error) {
        if (error.code !== "auth/email-already-in-use") throw error;

        // Permite reintentar si la cuenta se creó,
        // pero el guardado del perfil falló.
        credential = await signInWithEmailAndPassword(
          auth,
          email.value.trim(),
          password.value
        );
      }

      const token = await credential.user.getIdToken();

      const result = await request("/account", {
        method: "POST",
        token,
        body: {
          name: name.value.trim(),
          role: role.value
        }
      });

      profile.value = result.user;
      message.value = "Cuenta y perfil guardados.";
    } else {
      await signInWithEmailAndPassword(
        auth,
        email.value.trim(),
        password.value
      );

      await loadProfile();
      message.value = "Ingresaste correctamente.";
    }

    password.value = "";
  } catch (error) {
    message.value = explain(error);
  } finally {
    busy.value = false;
  }
}

async function logout() {
  busy.value = true;

  try {
    await signOut(auth);
    editing.value = false;
    profile.value = null;
    password.value = "";
    signup.value = false;
    message.value = "Sesión cerrada.";
  } catch (error) {
    message.value = explain(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="account-page">
    <h1>Mi cuenta</h1>

    <p v-if="message" role="status">{{ message }}</p>

    <div v-if="profile">
      <h2>{{ profile.name }}</h2>
      <p>{{ profile.email }}</p>
      <p>Distrito: {{ profile.preferences?.district }}</p>
<p>Presupuesto: S/ {{ profile.preferences?.budget }}</p>

<button
  v-if="!editing"
  class="btn outline"
  type="button"
  :disabled="busy"
  @click="startEditing"
>
  Editar perfil
</button>

<form v-if="editing" @submit.prevent="saveProfile">
  <label>
    Nombre
    <input v-model="editName" required minlength="2" />
  </label>

  <label>
    Presupuesto máximo por taller
    <input
      v-model="editBudget"
      type="number"
      min="0"
      max="9999"
      step="0.01"
      required
    />
  </label>

  <label>
    Distrito
    <select v-model="editDistrict">
      <option v-for="district in districts" :key="district">
        {{ district }}
      </option>
    </select>
  </label>

  <button class="btn primary" type="submit" :disabled="busy">
    {{ busy ? "Guardando..." : "Guardar cambios" }}
  </button>

  <button
    class="btn outline"
    type="button"
    :disabled="busy"
    @click="editing = false"
  >
    Cancelar
  </button>
</form>
      <p>
        Cuenta de
        {{ profile.role === "instructor" ? "tallerista" : "cliente" }}
      </p>

      <button class="btn primary" :disabled="busy" @click="logout">
        Cerrar sesión
      </button>
    </div>

    <form v-else @submit.prevent="submit">
      <h2>{{ signup ? "Crear cuenta" : "Iniciar sesión" }}</h2>

      <label v-if="signup">
        Nombre
        <input v-model="name" required minlength="2" />
      </label>

      <label>
        Correo
        <input v-model="email" type="email" required />
      </label>

      <label>
        Contraseña
        <input
          v-model="password"
          type="password"
          required
          minlength="8"
        />
      </label>

      <label v-if="signup">
        Tipo de cuenta
        <select v-model="role">
          <option value="client">Cliente</option>
          <option value="instructor">Tallerista</option>
        </select>
      </label>

      <button class="btn primary" type="submit" :disabled="busy">
        {{ busy ? "Espera..." : signup ? "Crear cuenta" : "Ingresar" }}
      </button>

      <button
        class="btn outline"
        type="button"
        :disabled="busy"
        @click="signup = !signup; message = ''"
      >
        {{ signup ? "Ya tengo cuenta" : "Quiero crear una cuenta" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.account-page {
  max-width: 480px;
  margin: 40px auto;
  padding: 24px;
}

form,
label {
  display: grid;
  gap: 10px;
}

form {
  gap: 20px;
}

input,
select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

h1,
h2,
p {
  margin-bottom: 16px;
}
</style>