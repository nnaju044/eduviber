import React, { useState, useEffect } from "react";
import studentApi from "../../api/studentApi.js";
import LoadingSpinner from "../../components/LoadingSpinner.jsx";

/**
 * StudentDeviceManager
 * Displays registered streaming devices (max 2) and allows removing devices.
 */
export default function StudentDeviceManager() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentApi.listDevices();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err.message || "Failed to load registered devices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (deviceId) => {
    if (!window.confirm("Are you sure you want to remove this device? It will need to register again upon next streaming session.")) {
      return;
    }

    try {
      setRevokingId(deviceId);
      await studentApi.revokeDevice(deviceId);
      await loadDevices();
    } catch (err) {
      alert(err.message || "Failed to remove device.");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-200 pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-900">
            Registered Streaming Devices
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            You can register up to 2 active devices simultaneously.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white border border-neutral-200 text-neutral-700 shrink-0">
          <span className={`w-2 h-2 rounded-full ${devices.length >= 2 ? "bg-amber-500" : "bg-emerald-500"}`} />
          {devices.length} / 2 Registered
        </span>
      </div>

      {loading ? (
        <div className="py-6 flex justify-center">
          <LoadingSpinner text="Loading registered devices..." />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      ) : devices.length === 0 ? (
        <div className="p-6 text-center text-xs text-neutral-400 italic">
          No registered devices found. A device will register automatically when you start video playback.
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
          {devices.map((device) => (
            <div
              key={device.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center text-base shrink-0">
                  {device.deviceType === "Mobile" || device.deviceType === "Tablet" ? "📱" : "💻"}
                </span>
                <div>
                  <h3 className="font-bold text-neutral-900 text-sm">
                    {device.deviceName}
                  </h3>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    {device.browser} • {device.os} • Last active:{" "}
                    {new Date(device.lastActiveAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRevoke(device.id)}
                disabled={revokingId === device.id}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {revokingId === device.id ? "Removing..." : "Remove Device"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

