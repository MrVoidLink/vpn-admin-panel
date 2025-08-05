export default function handler(req, res) {
  try {
    const {
      count = 10,
      duration = 30,
      deviceLimit = 1
    } = req.query;

    console.log("🧩 API Called with:", { count, duration, deviceLimit });

    const codes = [];

    for (let i = 0; i < parseInt(count); i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push({
        code,
        duration: parseInt(duration),
        deviceLimit: parseInt(deviceLimit),
      });
    }

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      generated: codes.length,
      codes,
    });
  } catch (error) {
    console.error("❌ API Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
