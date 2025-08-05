import { useEffect } from "react";
import axios from "axios";

const GenerateForm = () => {
  useEffect(() => {
    const fetchCodes = async () => {
      try {
        console.log("📡 Sending request to API...");

        const response = await axios.get("/api/generate-code", {
          params: {
            count: 5,
            duration: 30,
            deviceLimit: 2,
          },
        });

        console.log("✅ API Response:", response.data);
      } catch (error) {
        console.error("❌ API Error:", error);
      }
    };

    fetchCodes();
  }, []);

  return (
    <div>
      <h2>در حال دریافت کد...</h2>
    </div>
  );
};

export default GenerateForm;
