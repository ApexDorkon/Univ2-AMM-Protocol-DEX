"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type Notification = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

export default function NotificationBox({
  notifications,
  onClose,
}: {
  notifications: Notification[];
  onClose: (id: string) => void;
}) {
  useEffect(() => {
    const timers = notifications.map((n) =>
      setTimeout(() => onClose(n.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, onClose]);

  const colors = {
    success: "border-l-4 border-green-500 bg-green-800/20",
    error: "border-l-4 border-red-500 bg-red-800/20",
    info: "border-l-4 border-blue-500 bg-blue-800/20",
  };

  return (
    <div className="mt-4 space-y-2 w-full">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`${colors[n.type]} p-3 rounded-lg text-sm flex justify-between items-start text-white`}
          >
            <span className="pr-4">{n.message}</span>
            <button
              onClick={() => onClose(n.id)}
              className="text-gray-400 hover:text-white font-bold ml-2"
            >
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}