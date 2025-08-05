// /api/generateCodes.js

import { faker } from "@faker-js/faker";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "../firebase/firebaseConfig"; // آدرس دقیق فایل config خودتو بذار

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { count, validForDays, deviceLimit } = req.body;

  if (!count || !validForDays || !deviceLimit) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  const codes = [];

  for (let i = 0; i < count; i++) {
    const code = `${faker.string.alpha({ length: 4, casing: "upper" })}-${faker.number.int({ min: 1000, max: 9999 })}`;
    const doc = {
      code,
      status: "unused",
      validForDays,
      deviceLimit,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, "codes"), doc);
    codes.push(doc);
  }

  return res.status(200).json({ message: "Codes generated successfully", codes });
}
