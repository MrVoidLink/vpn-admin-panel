export default function handler(req, res) {
  const { count = 10, duration = 30, deviceLimit = 1 } = req.query;

  console.log("🎯 API CALLED - /generate-code");
  console.log("🔢 Count:", count);
  console.log("⏱️ Duration:", duration);
  console.log("📱 Device Limit:", deviceLimit);

  const codes = [];

  for (let i = 0; i < parseInt(count); i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push({
      code,
      duration: parseInt(duration),
      deviceLimit: parseInt(deviceLimit),
    });
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    success: true,
    generated: codes.length,
    codes,
  });
}
