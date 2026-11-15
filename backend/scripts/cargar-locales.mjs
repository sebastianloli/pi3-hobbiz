import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';

dotenv.config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true
});

// Nombre, distrito y cuenta de Instagram tomados del PDF.
const locales = [
  ['Brilla Pe', 'Barranco', 'brilla_pe'],
  ['Blacktelier creativo', 'Barranco', 'blackateliercreativo'],
  ['Taller Magenta', 'Barranco', 'taller.magenta'],
  ['Casonatrazzo', 'Barranco', 'casonatrazzo'],
  ['Ampayyuraq', 'Barranco', 'ampayyuraq'],
  ['Kapulitelier', 'Barranco', 'kapuliatelier'],
  ['Peruacademyofart', 'Barranco', 'peruacademyofart'],
  ['Casa Infinito Perú', 'Barranco', 'casainfinitoperu'],
  ['Ultramaaar', 'Barranco', 'ultramaaar'],
  ['Lima Fuego Academy', 'Barranco', 'limafuegoacademy'],
  ['Taller 320', 'Barranco', 'taller320.barranco'],
  ['Paint and Wine Perú', 'Barranco', 'paintandwineperu'],
  ['Octava', 'Barranco', 'octava.pe'],
  ['Quincha Estudio', 'Barranco', 'quinchaestudio'],
  ['BLANLAB', 'Barranco', '_blanlab_'],
  ['Espacio 303', 'Barranco', 'espacio_303'],
  ['Academia Aidem', 'Barranco', 'aidem_musica_barranco'],
  ['Samaca Artes y Letras', 'Barranco', 'samacaartesyletras'],
  ['Barranqueando', 'Barranco', 'somosbarranqueando'],
  ['Studio Rock', 'Miraflores', 'studiorock.pe'],
  ['Taller de escritura creativa', 'Miraflores', 'tallerdeescrituracreativa'],
  ['El Embarre', 'Miraflores', 'elembarretaller'],
  ['Spazio', 'Miraflores', 'spaziostudio.pe'],
  ['Wegner', 'Miraflores', 'wagnertalleresdearte'],
  ['Terra Point', 'Miraflores', 'terrapoint.pe'],
  ['PLAM', 'Miraflores', 'plamoficial'],
  ['Urban Coffee', 'Miraflores', 'urbancoffeeperu'],
  ['El Taller', 'Miraflores', 'eltaller.espacio'],
  ['Taller Forns', 'Miraflores', 'taller_forns'],
  ['MiCoAcuarlaIlustracion', 'Miraflores', 'milagros_contreras_mi_co'],
  ['Mundo de Barro', 'Miraflores', 'mundodebarro'],
  ['Rima con Lima', 'Miraflores', 'rimaconlima'],
  ['Arte para crecer', 'Miraflores', 'arteparacrecer'],
  ['Puerta Roja', 'Miraflores', 'lapuertarojataller'],
  ['Club de Teatro de Lima', 'Miraflores', 'clubdeteatrodelima'],
  ['Workshop', 'Miraflores', 'workshop.centroartistico'],
  ['LMS | Escuela de Técnica Vocal y Música', 'Miraflores', 'limamusicstudio'],
  ['Guitarra Lima Academy', 'Miraflores', 'guitarralima.academy'],
  ['Sibelius Academia', 'Miraflores', 'sibelius.pe']
];

function instagramHandle(link) {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();

    if (!['instagram.com', 'www.instagram.com'].includes(host)) {
      return '';
    }

    return url.pathname.split('/').filter(Boolean)[0]?.toLowerCase() || '';
  } catch {
    return '';
  }
}

let client;

try {
  let uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Falta MONGODB_URI en backend/.env.');
  }

  for (const marker of ['<db_password>', '<password>']) {
    if (uri.includes(marker)) {
      if (!process.env.MONGODB_PASSWORD) {
        throw new Error('Falta MONGODB_PASSWORD en backend/.env.');
      }

      uri = uri.replace(
        marker,
        encodeURIComponent(process.env.MONGODB_PASSWORD)
      );
    }
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000
  });

  await client.connect();

  const db = client.db(process.env.MONGODB_DB || 'hobbiz');
  const users = db.collection('users');

  const existentes = await users.find(
    {},
    {
      projection: {
        id: 1,
        role: 1,
        'studio.links.instagram': 1,
        'studio.link': 1
      }
    }
  ).toArray();

  const porId = new Map(existentes.map(user => [user.id, user]));
  const porInstagram = new Map();

  for (const user of existentes) {
    if (user.role !== 'instructor') continue;

    const handle = instagramHandle(
      user.studio?.links?.instagram || user.studio?.link
    );

    if (handle) porInstagram.set(handle, user);
  }

  let agregados = 0;
  let conservados = 0;

  console.log(`Base seleccionada: ${db.databaseName}`);
  console.log(`Locales del PDF: ${locales.length}\n`);

  for (const [name, district, handle] of locales) {
    const id = `venue-${handle.replace(/[^a-z0-9]+/gi, '-')}`;
    const existente = porId.get(id) || porInstagram.get(handle);

    if (existente) {
      if (existente.role !== 'instructor') {
        throw new Error(`El identificador ${id} pertenece a otro tipo de usuario.`);
      }

      console.log(`CONSERVADO: ${name}`);
      conservados++;
      continue;
    }

    const instagram = `https://www.instagram.com/${handle}/`;

    const profile = {
      id,
      name,
      email: '',
      role: 'instructor',
      claimed: false,
      preferences: {
        interests: [],
        budget: 0,
        district,
        day: ''
      },
      favorites: [],
      studio: {
        displayName: name,
        tagline: '',
        bio: '',
        link: '',
        links: { instagram },
        accent: 'terracota',
        accentColor: '',
        font: 'moderna',
        layout: 'portada',
        coverImage: '',
        gallery: [],
        district,
        address: ''
      },
      importSource: 'talleres.pdf'
    };

    const result = await users.updateOne(
      { id },
      { $setOnInsert: profile },
      { upsert: true }
    );

    if (result.upsertedCount) {
      agregados++;
      console.log(`AGREGADO: ${name}`);
    } else {
      conservados++;
      console.log(`CONSERVADO: ${name}`);
    }

    porId.set(id, profile);
    porInstagram.set(handle, profile);
  }

  console.log('\nCARGA COMPLETADA');
  console.log(`Agregados: ${agregados}`);
  console.log(`Conservados: ${conservados}`);
  console.log(`Locales procesados: ${agregados + conservados}`);
} catch (error) {
  console.error('\nNo se completó la carga:', error.message);
  process.exitCode = 1;
} finally {
  await client?.close();
}