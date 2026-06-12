"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  return h === 0 ? "자정" : h < 12 ? `오전 ${h}시` : h === 12 ? "정오" : `오후 ${h - 12}시`;
}

function getDatesInMonth(year: number, month: number) {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function CreateRoomForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const [title, setTitle] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(22);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPin, setOwnerPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const days = getDatesInMonth(calYear, calMonth);
  const firstDayOfWeek = days[0].getDay();

  function toggleDate(d: Date) {
    const key = d.toISOString().slice(0, 10);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !ownerName || ownerPin.length !== 4 || selectedDates.size === 0 || startHour >= endHour) {
      setError("모든 항목을 올바르게 입력하세요 (PIN 4자리, 시작<끝 시간, 날짜 1개 이상)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          timezone,
          startHour,
          endHour,
          dates: Array.from(selectedDates).sort(),
          notice,
          ownerName,
          ownerPin,
        }),
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
    <div className="min-h-screen p-4 max-w-lg mx-auto py-8">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">시작 시간</label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {HOURS.slice(0, 23).map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">끝 시간</label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {HOURS.slice(1).map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">후보 날짜 선택</label>
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">←</button>
            <span className="font-medium">{calYear}년 {calMonth + 1}월</span>
            <button type="button" onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">→</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
            {DAY_LABELS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={i} />)}
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const selected = selectedDates.has(key);
              const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !isPast && toggleDate(d)}
                  disabled={isPast}
                  className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${selected ? "bg-indigo-600 text-white" : isPast ? "text-gray-300 cursor-not-allowed" : "hover:bg-indigo-100 text-gray-700"}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {selectedDates.size > 0 && (
            <p className="mt-2 text-xs text-indigo-600">{selectedDates.size}일 선택됨</p>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">주최자 정보 (참여자로도 등록됩니다)</p>
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
              <label className="block text-xs text-gray-500 mb-1">PIN (4자리 숫자)</label>
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
