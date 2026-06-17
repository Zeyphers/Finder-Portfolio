import React, { useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle, X, Minus } from "lucide-react";
import { motion, useDragControls } from "motion/react";
import { getApiUrl } from "../api";

interface ContactAppProps {
  onClose: () => void;
  isDark: boolean;
}

export function ContactApp({ onClose, isDark }: ContactAppProps) {
  const [formData, setFormData] = useState({
    name: "",
    contactInfo: "",
    subject: "",
    message: ""
  });
  
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const dragControls = useDragControls();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contactInfo || !formData.subject || !formData.message) {
      setStatus("error");
      setErrorMessage("Please fill in all fields.");
      return;
    }

    const hasEmail = formData.contactInfo.includes("@");
    const hasPhone = /\d{7,}/.test(formData.contactInfo.replace(/[\s-()]/g, ''));
    if (!hasEmail && !hasPhone) {
      setStatus("error");
      setErrorMessage("Please provide a valid email or phone number.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch(getApiUrl("/api/contact"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMessage(data.error || "An error occurred.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMessage("Failed to send message. Please try again later.");
    }
  };

  const styles = {
    backdropBg: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent select-none pointer-events-none",
    windowBg: isDark 
      ? "relative w-[95vw] sm:w-[500px] h-auto min-h-[500px] max-h-[95vh] bg-[#282828] rounded-[10px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.85)] border border-white/10 flex flex-col font-sans text-slate-200 pointer-events-auto" 
      : "relative w-[95vw] sm:w-[500px] h-auto min-h-[500px] max-h-[95vh] bg-white rounded-[10px] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.25)] border border-black/15 flex flex-col font-sans text-[#1f2937] pointer-events-auto",
    titleBarBg: isDark 
      ? "drag-handle cursor-grab active:cursor-grabbing bg-[#333333] h-12 px-4 flex items-center justify-between border-b border-black/30 shrink-0 relative pointer-events-auto" 
      : "drag-handle cursor-grab active:cursor-grabbing bg-[#E6E6E6] h-12 px-4 flex items-center justify-between border-b border-black/10 shrink-0 relative pointer-events-auto",
    titleText: isDark ? "text-slate-300 drop-shadow-sm" : "text-slate-800 drop-shadow-sm",
    inputBg: isDark ? "bg-[#1C1C1C] border-[#3A3A3A] text-white" : "bg-[#F9FAFB] border-[#E5E7EB] text-slate-900",
  };

  return (
    <div className={styles.backdropBg} onClick={onClose}>
      <motion.div 
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className={styles.windowBg} 
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div onPointerDown={(e) => dragControls.start(e)} className={styles.titleBarBg}>
          <div className="flex space-x-2 z-10" onPointerDown={(e) => e.stopPropagation()}>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer transition-colors active:bg-[#C23C37]"
              title="Close"
            >
              <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#4C0002]" strokeWidth={3.5} />
            </button>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center cursor-pointer transition-colors active:bg-[#A97510]"
              title="Close"
            >
              <Minus className="w-2.5 h-2.5 text-[#5C3E00] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </button>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#27C93F] border border-[#1AAB29] flex items-center justify-center cursor-pointer transition-colors active:bg-[#168119]"
              title="Close"
            >
              <span className="text-[8px] text-[#024B0E] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
            </button>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-[13px] font-[600] tracking-wide ${styles.titleText}`}>Contact Me</span>
          </div>
          
          <div className="w-12 z-10"></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {status === "success" ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Message Sent!</h2>
              <p className={`mb-8 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Thank you for reaching out. I'll get back to you as soon as possible.
              </p>
              <button 
                onClick={() => {
                  setFormData({ name: "", contactInfo: "", subject: "", message: "" });
                  setStatus("idle");
                }}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${isDark ? "bg-white text-black hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}
              >
                Send Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="h-full flex flex-col space-y-4">
              
              {status === "error" && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="name" className={`text-[13px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Your Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${styles.inputBg}`}
                    required
                  />
                </div>
                
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="contactInfo" className={`text-[13px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Email or Phone</label>
                  <input
                    id="contactInfo"
                    name="contactInfo"
                    type="text"
                    value={formData.contactInfo}
                    onChange={handleChange}
                    className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${styles.inputBg}`}
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="subject" className={`text-[13px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Subject</label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    value={formData.subject}
                    onChange={handleChange}
                    className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow ${styles.inputBg}`}
                    required
                  />
                </div>

                <div className="flex flex-col space-y-1.5 flex-1 min-h-[160px]">
                  <label htmlFor="message" className={`text-[13px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Message</label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none flex-1 transition-shadow ${styles.inputBg}`}
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-6 py-2.5 bg-[#1062fe] hover:bg-[#0f58e5] text-white rounded-lg transition-colors font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </div>

            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
