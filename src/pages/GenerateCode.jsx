import React, { useState, useEffect } from "react";
import axios from "axios";
import GenerateForm from "../components/generate-code/GenerateForm";
import FileHistory from "../components/generate-code/FileHistory";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const GenerateCode = () => {
  const [fileHistory, setFileHistory] = useState([]);

  // گرفتن تاریخچه فایل‌ها از سرور هر بار که صفحه لود شد
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get("/api/file-history");
        setFileHistory(res.data.files); // فایل‌ها رو از API بگیر
      } catch (error) {
        setFileHistory([]);
      }
    };
    fetchHistory();
  }, []);

  const handleGenerate = async ({ count, validForDays, deviceLimit, type }) => {
    try {
      const res = await axios.get("/api/generate-code", {
        params: { count, duration: validForDays, deviceLimit, type },
      });

      const generatedCodes = res.data.codes;
      const timestamp = new Date();
      const formattedTime = timestamp.toISOString().replace(/[:.]/g, "-");
      const filename = `codes-${type}-${formattedTime}.xlsx`;

      // تبدیل داده‌ها به اکسل
      const worksheetData = generatedCodes.map((code) => ({
        "کد اشتراک": code.code,
        "مدت اعتبار (روز)": code.duration,
        "تعداد کاربر": code.deviceLimit,
        "نوع اشتراک": code.type,
        "تاریخ ایجاد": new Date(code.createdAt._seconds * 1000).toLocaleString("fa-IR"),
        "استفاده شده؟": code.isUsed ? "بله" : "خیر",
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Codes");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(blob, filename);

      // بعد از ساخت فایل، اطلاعات فایل رو توی Firestore ذخیره کن (یک درخواست POST به /api/file-history)
      await axios.post("/api/file-history", {
        name: filename,
        createdAt: timestamp.toISOString(),
        count,
        validForDays,
        deviceLimit,
        type,
      });

      // بعد از تولید کد جدید، دوباره تاریخچه رو از سرور بگیر
      const historyRes = await axios.get("/api/file-history");
      setFileHistory(historyRes.data.files);

    } catch (error) {
      console.error("❌ خطا در دریافت کد از API:", error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">تولید کد اشتراک</h1>
      <GenerateForm onGenerate={handleGenerate} />
      <FileHistory files={fileHistory} />
    </div>
  );
};

export default GenerateCode;
