import { db } from "../src/utils/firebase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    console.log("add-server API is running");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const serverData = req.body;

  // اعتبارسنجی اولیه
  if (
    !serverData.serverName ||
    !serverData.ipAddress ||
    !serverData.port ||
    !serverData.protocol ||
    !serverData.serverType ||
    !serverData.maxConnections ||
    !serverData.location ||
    !serverData.status
  ) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    await db.collection("servers").add(serverData);
    return res.status(200).json({ message: "Server added successfully" });
  } catch (error) {
    console.error("Error adding server:", error);
    return res.status(500).json({ message: "Failed to add server", error: error.message });
  }
}
