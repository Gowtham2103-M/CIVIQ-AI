import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import "./Toast.css";

export const Toast = ({ message, type = "info", duration = 4000, onClose }) => {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) onClose();
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [message, duration, onClose]);

  if (!visible || !message) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle2 size={18} className="toast-icon success" />;
      case "error":
        return <XCircle size={18} className="toast-icon error" />;
      case "warning":
        return <AlertTriangle size={18} className="toast-icon warning" />;
      default:
        return <Info size={18} className="toast-icon info" />;
    }
  };

  return (
    <div className={`officer-toast toast-${type}`}>
      {getIcon()}
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close-btn"
        onClick={() => {
          setVisible(false);
          if (onClose) onClose();
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
