"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import JoinForm from "./JoinForm";
import RoomGrid from "./RoomGrid";

export type RoomMeta = {
  title: string;
  timezone: string;
  startHour: string;
  endHour: string;
  dates: string;
  notice: string;
  ownerId: string;
  createdAt: string;
  baseExpireAt: string;
  confirmedSlot: string;
};

export type RoomState = {
  meta: RoomMeta;
  participants: Record<string, string>;
  rawParticipants: Record<string, string>;
  writerIds: string[];
  heatmap: Record<string, string[]>;
  version: string | number;
};

export type Auth = {
  participantId: string;
  token: string;
  name: string;
};

export default function RoomClient({ code }: { code: string }) {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [mySlots, setMySlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lastVersion = useRef<string | number | null>(null);

  const fetchRoomState = useCallback(async () => {
    const res = await fetch(`/api/room/${code}`);
    if (!res.ok) return;
    const data: RoomState = await res.json();
    setRoomState(data);
    lastVersion.current = data.version;
  }, [code]);

  // Load my slots from server
  const loadMySlots = useCallback(async (pid: string) => {
    const res = await fetch(`/api/room/${code}`);
    if (!res.ok) return;
    const data: RoomState = await res.json();
    setRoomState(data);
    lastVersion.current = data.version;
    // my avail is embedded in heatmap - rebuild from heatmap perspective
    // Actually we need to call a separate endpoint or compute from the heatmap data
    // We pass pid so we can filter heatmap entries that include pid
    const slots = new Set<string>();
    for (const [slot, pids] of Object.entries(data.heatmap)) {
      if (pids.includes(pid)) slots.add(slot);
    }
    setMySlots(slots);
  }, [code]);

  // Try auto-resume from localStorage
  useEffect(() => {
    async function init() {
      const pid = localStorage.getItem(`room:${code}:pid`);
      const token = localStorage.getItem(`room:${code}:token`);

      if (pid && token) {
        try {
          const res = await fetch(`/api/room/${code}/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ participantId: pid, token }),
          });
          if (res.ok) {
            const data = await res.json();
            const a: Auth = { participantId: pid, token, name: data.name };
            setAuth(a);
            await loadMySlots(pid);
            setLoading(false);
            return;
          }
        } catch {}
        localStorage.removeItem(`room:${code}:pid`);
        localStorage.removeItem(`room:${code}:token`);
      }
      // No auto-resume: just load room state to show join form
      await fetchRoomState();
      setLoading(false);
    }
    init();
  }, [code, fetchRoomState, loadMySlots]);

  // Polling
  useEffect(() => {
    if (!auth) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/${code}/version`);
        if (!res.ok) return;
        const { version } = await res.json();
        if (version !== lastVersion.current) {
          await fetchRoomState();
          // Refresh my slots too
          const newSlots = new Set<string>();
          const state = roomState;
          if (state) {
            for (const [slot, pids] of Object.entries(state.heatmap)) {
              if (pids.includes(auth.participantId)) newSlots.add(slot);
            }
          }
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [auth, code, fetchRoomState, roomState]);

  // After fetchRoomState, refresh mySlots
  useEffect(() => {
    if (auth && roomState) {
      const slots = new Set<string>();
      for (const [slot, pids] of Object.entries(roomState.heatmap)) {
        if (pids.includes(auth.participantId)) slots.add(slot);
      }
      setMySlots(slots);
    }
  }, [roomState, auth]);

  function handleJoined(a: Auth) {
    setAuth(a);
    localStorage.setItem(`room:${code}:pid`, a.participantId);
    localStorage.setItem(`room:${code}:token`, a.token);
    loadMySlots(a.participantId);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <JoinForm
        code={code}
        roomMeta={roomState?.meta ?? null}
        onJoined={handleJoined}
      />
    );
  }

  if (!roomState) return null;

  return (
    <RoomGrid
      code={code}
      auth={auth}
      roomState={roomState}
      mySlots={mySlots}
      setMySlots={setMySlots}
      onRefresh={fetchRoomState}
    />
  );
}
