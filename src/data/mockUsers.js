const mockUsers = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  status: i % 3 === 0 ? "online" : "offline",
  subscription:
    i % 5 === 0
      ? "premium plus"
      : i % 2 === 0
      ? "premium"
      : "free",
  activation: "2024-06-01",
  expiration: "2025-06-01",
  dataUsage: `${(Math.random() * 50 + 10).toFixed(1)} GB`,
  purchType: i % 4 === 0 ? "credit card" : "paypal",
}));
export default mockUsers;
