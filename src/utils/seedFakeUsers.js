import { getFirestore, collection, addDoc } from "firebase/firestore";
import firebaseApp from "../firebase/firebaseConfig";
import { faker } from "@faker-js/faker";

const db = getFirestore(firebaseApp);

export const seedFakeUsers = async (count = 20) => {
  const usersRef = collection(db, "users");
  const roles = ["free", "premium", "premium plus"];
  const purchaseTypes = ["credit card", "paypal"];
  const statuses = ["online", "offline"];

  for (let i = 0; i < count; i++) {
    const user = {
      name: faker.person.fullName(),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      subscription: roles[Math.floor(Math.random() * roles.length)],
      activation: "2024-06-01",
      expiration: "2025-06-01",
      dataUsage: `${(Math.random() * 50 + 10).toFixed(1)} GB`,
      purchType: purchaseTypes[Math.floor(Math.random() * purchaseTypes.length)],
    };

    await addDoc(usersRef, user);
  }

  console.log(`✅ ${count} کاربر فیک اضافه شد.`);
};
