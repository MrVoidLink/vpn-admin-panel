import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from "./hooks/AuthContext.jsx"; // مسیرت رو تنظیم کن
import { ToastContainer } from "react-toastify";
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
<AuthProvider>
  <StrictMode>
    <App />
    <ToastContainer position="top-right" autoClose={3000} />
  </StrictMode>,
</AuthProvider>
)
