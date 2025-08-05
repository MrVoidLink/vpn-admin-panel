import React, { useState } from "react";
import GenerateForm from "../components/generate-code/GenerateForm";
import FileHistory from "../components/generate-code/FileHistory";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver"; // ✅ اضافه شد

const GenerateCode = () => {
  const [fileHistory, setFileHistory] = useState([]);

  const generateCodeString = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetters = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    return `${randomLetters}-${randomNumbers}`;
  };

  const handleGenerate = ({ count, validForDays, deviceLimit }) => {
    const newCodes = Array.from({ length: count }, () => ({
      code: generateCodeString(),
      validForDays,
      deviceLimit,
    }));

    const timestamp = new Date();
    const filename = `codes-${timestamp.toISOString().replace(/[:.]/g, "-")}.xlsx`;

    // ساخت فایل اکسل
    const worksheet = XLSX.utils.json_to_sheet(newCodes);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Codes");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, filename); // ✅ اضافه شد: دانلود فایل

    // ثبت در فایل‌ هیستوری با blob ذخیره‌شده
    const newFileRecord = {
      name: filename,
      createdAt: timestamp.toLocaleString("fa-IR"),
      count,
      validForDays,
      deviceLimit,
      blob,
    };

    setFileHistory((prev) => [newFileRecord, ...prev]);
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
