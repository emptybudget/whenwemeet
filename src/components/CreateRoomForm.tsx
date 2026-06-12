"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateRoomForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPin, setOwnerPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !ownerName || ownerPin.length !== 4) {
      setError("제목, 이름, PIN 4자리를 입력하세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, notice, ownerName, ownerPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem(`room:${data.code}:pid`, data.participantId);
      localStorage.setItem(`room:${data.code}:token`, data.token);
      router.push(`/room/${data.code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "오류 발생");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4 max-w-sm mx-auto py-8">
      <button onClick={onBack} className="mb-4 text-indigo-600 hover:underline text-sm">← 뒤로</button>
      <h2 className="text-2xl font-bold mb-6">방 만들기</h2>
      <form onSubmit={handleSubmit} className="space-y-5">

        <div>
          <label className="block text-sm font-medium mb-1">모임 제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 졸업 파티"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">공지 메모 (선택)</label>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            placeholder="참여자들에게 전달할 내용"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">주최자 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">이름</label>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="이름"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">PIN (4자리)</label>
              <input
                value={ownerPin}
                onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                type="password"
                inputMode="numeric"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          {loading ? "생성 중..." : "방 만들기"}
        </button>
      </form>
    </div>
  );
}
