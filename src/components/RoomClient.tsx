"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import JoinForm from "./JoinForm";
import MemoView from "./MemoView";

export type RoomMeta = {
  title: string;
  notice: string;
  ownerId: string;
  createdAt: string;
  baseExpireAt: string;
  confirmedText: string;
};

export type RoomState = {
  meta: RoomMeta;
  participants: Record<string, string>;
  notes: Record<string, string>;
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
  const [loading, setLoading] = useState(true);
  const lastVersion = useRef<string | number | null>(null);

  const fetchRoomState = useCallback(async () => {
    const res = await fetch(`/api/room/${code}`);
    if (!res.ok) return;
    const data: RoomState = await res.json();
    setRoomState(data);
    lastVersion.current = data.version;
  }, [code]);

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
            setAuth({ participantId: pid, token, name: data.name });
            await fetchRoomState();
            setLoading(false);
            return;
          }
        } catch {}
        localStorage.removeItem(`room:${code}:pid`);
        localStorage.removeItem(`room:${code}:token`);
      }
      await fetchRoomState();
      setLoading(false);
    }
    init();
  }, [code, fetchRoomState]);

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
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [auth, code, fetchRoomState]);

  function handleJoined(a: Auth) {
    setAuth(a);
    localStorage.setItem(`room:${code}:pid`, a.participantId);
    localStorage.setItem(`room:${code}:token`, a.token);
    fetchRoomState();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">불러오는 중...</p>
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
    <MemoView
      code={code}
      auth={auth}
      roomState={roomState}
      onRefresh={fetchRoomState}
    />
  );
}
