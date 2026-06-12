"use client";

import { useState } from "react";
import type { Auth, RoomMeta } from "./RoomClient";

export default function JoinForm({
  code,
  roomMeta,
  onJoined,
}: {
  code: string;
  roomMeta: RoomMeta | null;
  onJoined: (auth: Auth) => void;
}) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name || pin.length !== 4) {
      setError("이름과 PIN 4자리를 입력하세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onJoined({ participantId: data.participantId, token: data.token, name });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류 발생");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {roomMeta && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-indigo-600">{roomMeta.title}</h1>
            <p className="text-sm text-gray-500 mt-1">방 코드: {code}</p>
          </div>
        )}
        {!roomMeta && (
          <div className="text-center">
            <h1 className="text-2xl font-bold">방 입장</h1>
            <p className="text-sm text-gray-500">코드: {code}</p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          이 방은 생성 후 60일, 약속 확정 시 약속일+7일에 자동 삭제됩니다.
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름 입력"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">PIN (4자리 숫자)</label>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              type="password"
              inputMode="numeric"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-400">
            같은 이름으로 다른 기기에서 입장하면 PIN으로 본인 확인됩니다.
            PIN을 잊으면 복구가 불가합니다.
          </p>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
          >
            {loading ? "입장 중..." : "입장"}
          </button>
        </form>
      </div>
    </div>
  );
}
