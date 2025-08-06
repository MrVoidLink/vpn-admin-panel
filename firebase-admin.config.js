// firebase-admin.config.js
import admin from "firebase-admin";

const serviceAccount = {
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "xxx",
  "private_key": "-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n",
  "client_email": "xxx@xxx.iam.gserviceaccount.com",
  "client_id": "xxx",
  ...
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export { db };
