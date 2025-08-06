import React, { useState, useEffect } from "react";
import axios from "axios";
import GenerateForm from "../components/generate-code/GenerateForm";
import FileHistory from "../components/generate-code/FileHistory";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const GenerateCode = () => {
  const [fileHistory, setFileHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get("/api/file-history");
      setFileHistory(res.data.files);
    } catch {
      setFileHistory([]);
    }
  };

  const handleGenerate = async ({ count, validForDays, deviceLimit, type }) => {
    try {
      const res = await axios.get("/api/generate-code", {
        params: { count, duration: validForDays, deviceLimit, type },
      });

      const generatedCodes = res.data.codes;
      const timestamp = new Date();
      const formattedTime = timestamp.toISOString().replace(/[:.]/g, "-");
      const filename = `codes-${type}-${formattedTime}.xlsx`;

      // Generate Excel file (columns in English)
      const worksheetData = generatedCodes.map((code) => ({
        "Code": code.code,
        "Duration (days)": code.duration,
        "Device Limit": code.deviceLimit,
        "Type": code.type,
        "Created At": code.createdAt
          ? new Date(
              code.createdAt._seconds
                ? code.createdAt._seconds * 1000
                : code.createdAt
            ).toLocaleString("en-GB")
          : "",
        "Used?": code.isUsed ? "Used" : "Unused",
      }));
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Codes");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, filename);

      // Save file and codes info to Firestore
      await axios.post("/api/file-history", {
        name: filename,
        createdAt: timestamp.toISOString(),
        count,
        validForDays,
        deviceLimit,
        type,
        codes: generatedCodes, // very important
      });

      fetchHistory();
    } catch (error) {
      console.error("❌ API Error:", error);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-3xl font-extrabold mb-8 text-gray-800 text-center tracking-tight drop-shadow-sm">
        Generate Subscription Code
      </h1>
      <div className="mb-10">
        <GenerateForm onGenerate={handleGenerate} />
      </div>
      <div>
        <FileHistory files={fileHistory} />
      </div>
    </div>
  );
};

export default GenerateCode;
