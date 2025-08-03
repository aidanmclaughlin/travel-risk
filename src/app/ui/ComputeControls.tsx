"use client";

import { useState } from "react";

export default function ComputeControls() {
  const [destination, setDestination] = useState("");

  const href = `/api/daily?compute=1${destination ? `&destination=${encodeURIComponent(destination)}` : ""}`;

  return (
    <div className="space-y-2">
      <label className="block text-sm muted">Compute for destination</label>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm bg-white/70"
          placeholder="e.g., Canada"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <a
          className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${destination ? "bg-black text-white hover:opacity-90" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
          href={href}
          aria-disabled={!destination}
          onClick={(e) => { if (!destination) e.preventDefault(); }}
        >
          Compute
        </a>
      </div>
    </div>
  );
}

