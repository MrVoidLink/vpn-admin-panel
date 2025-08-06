import React, { useState } from "react";
import axios from "axios";
import GenerateForm from "../components/generate-code/GenerateForm";
import FileHistory from "../components/generate-code/FileHistory";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const GenerateCode = () => {
  const [fileHistory, setFileHistory] = useState([]);

  const handleGenerate = async ({ count, validForDays, deviceLimit }) => {
    try {
      // ارسال درخواست به API
      const res = await axios.get("/api/generate-code", {
        params: {
          count,
          duration: validForDays,
          deviceLimit,
        },
      });

      const generatedCodes = res.data.codes;
      console.log("✅ کدهای دریافتی:", generatedCodes);

      const timestamp = new Date();
      const filename = `codes-${timestamp.toISOString().replace(/[:.]/g, "-")}.xlsx`;

      // ساخت فایل اکسل از کدهای دریافتی
      const worksheet = XLSX.utils.json_to_sheet(generatedCodes);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Codes");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, filename);

      // ثبت در فایل‌ هیستوری
      const newFileRecord = {
        name: filename,
        createdAt: timestamp.toLocaleString("fa-IR"),
        count,
        validForDays,
        deviceLimit,
        blob,
      };

      setFileHistory((prev) => [newFileRecord, ...prev]);
    } catch (error) {
      console.error("❌ خطا در دریافت کد از API:", error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Code Generator</h1>
      <GenerateForm onGenerate={handleGenerate} />
      <FileHistory files={fileHistory} />
    </div>
  );
};

export default GenerateCode;
