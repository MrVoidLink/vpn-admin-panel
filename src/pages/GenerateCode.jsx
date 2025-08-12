// src/pages/GenerateCode.jsx
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

  // helper: parse possible Timestamp shapes
  const parseCreatedAt = (v) => {
    try {
      if (!v) return "";
      // Firestore Timestamp serialized by Admin SDK -> { _seconds, _nanoseconds } or { seconds, nanoseconds }
      const sec =
        (typeof v._seconds === "number" && v._seconds) ||
        (typeof v.seconds === "number" && v.seconds);
      if (sec) return new Date(sec * 1000).toLocaleString("en-GB");
      // string or millis
      const d = new Date(v);
      return isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB");
    } catch {
      return "";
    }
  };

  const handleGenerate = async ({ count, validForDays, deviceLimit, type }) => {
    try {
      // برای سازگاری با بک‌اند فعلی، همان پارام‌های قبلی را می‌فرستیم:
      const res = await axios.get("/api/generate-code", {
        params: {
          count,
          duration: validForDays,  // روزهای اعتبار
          deviceLimit,             // ظرفیت دستگاه (در سرور به maxDevices نگاشت می‌شود)
          type,
          // اگر در آینده بخواهی منبع را از UI بدهی، اینجا: source
        },
      });

      const generatedCodes = Array.isArray(res.data?.codes) ? res.data.codes : [];
      const timestamp = new Date();
      const formattedTime = timestamp.toISOString().replace(/[:.]/g, "-");
      const filename = `codes-${type}-${formattedTime}.xlsx`;

      // ستون‌های اکسل — با پشتیبانی از ساختار جدید و قدیمی
      const worksheetData = generatedCodes.map((code) => {
        const days = code.validForDays ?? code.duration ?? validForDays;
        const maxDevices =
          code.maxDevices ?? code.remainingDevices ?? code.deviceLimit ?? deviceLimit;
        const activeDevices = code.activeDevices ?? 0;
        const source = code.source ?? "admin";

        return {
          Code: code.code,
          "Valid For (days)": days,
          "Max Devices": maxDevices,
          "Active Devices": activeDevices,
          Type: code.type,
          Source: source,
          "Created At": parseCreatedAt(code.createdAt),
          "Used?": code.isUsed ? "Used" : "Unused",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Codes");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      saveAs(blob, filename);

      // ذخیره‌ی متادیتا برای تاریخچه (سازگار با قدیم/جدید)
      await axios.post("/api/file-history", {
        name: filename,
        createdAt: timestamp.toISOString(),
        count,
        validForDays,
        deviceLimit, // برای سازگاری تاریخچه، همون نام قدیمی حفظ می‌شه
        type,
        codes: generatedCodes,
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
