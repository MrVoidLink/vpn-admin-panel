export default function handler(req, res) {
  const { count = 10, duration = 30, deviceLimit = 1 } = req.query;

  const codes = [];

  for (let i = 0; i < parseInt(count); i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push({
      code,
      duration: parseInt(duration),
      deviceLimit: parseInt(deviceLimit),
    });
  }

  res.status(200).json({
    success: true,
    generatedAt: new Date().toISOString(),
    count: codes.length,
    codes,
  });
}
