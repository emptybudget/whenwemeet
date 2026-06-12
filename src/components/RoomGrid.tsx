"use client";

import { useState, useRef, useCallback } from "react";
import type { Auth, RoomState } from "./RoomClient";

type Props = {
  code: string;
  auth: Auth;
  roomState: RoomState;
  mySlots: Set<string>;
  setMySlots: (s: Set<string>) => void;
  onRefresh: () => Promise<void>;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function formatHour(h: number) {
  return h < 12 ? `${h}시` : h === 12 ? `12시` : `${h}시`;
}

function heatColor(count: number, total: number): string {
  if (total === 0 || count === 0) return "";
  const ratio = count / total;
  if (ratio === 1) return "bg-emerald-500 text-white";
  if (ratio >= 0.75) return "bg-indigo-400 text-white";
  if (ratio >= 0.5) return "bg-indigo-300 text-white";
  if (ratio >= 0.25) return "bg-indigo-200 text-indigo-900";
  return "bg-indigo-100 text-indigo-800";
}

export default function RoomGrid({ code, auth, roomState, mySlots, setMySlots, onRefresh }: Props) {
  const { meta, participants, writerIds, heatmap } = roomState;
  const dates: string[] = JSON.parse(meta.dates);
  const startHour = Number(meta.startHour);
  const endHour = Number(meta.endHour);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const isOwner = meta.ownerId === auth.participantId;
  const writerCount = writerIds.length;
  const participantCount = Object.keys(participants).length;

  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [popupSlot, setPopupSlot] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // Drag state
  const dragRef = useRef<{ active: boolean; startChecked: boolean; touched: Set<string> }>({
    active: false,
    startChecked: false,
    touched: new Set(),
  });
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushToggles = useCallback(async () => {
    if (pendingRef.current.size === 0) return;
    const slots = Array.from(pendingRef.current.entries()).map(([slot, checked]) => ({ slot, checked }));
    pendingRef.current.clear();
    try {
      await fetch(`/api/room/${code}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: auth.participantId, token: auth.token, slots }),
      });
      await onRefresh();
    } catch {}
  }, [code, auth, onRefresh]);

  function scheduleFlush() {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushToggles, 300);
  }

  function handleCellStart(slot: string) {
    const checked = !mySlots.has(slot);
    dragRef.current = { active: true, startChecked: checked, touched: new Set([slot]) };
    const next = new Set(mySlots);
    if (checked) next.add(slot);
    else next.delete(slot);
    setMySlots(next);
    pendingRef.current.set(slot, checked);
    scheduleFlush();
  }

  function handleCellEnter(slot: string) {
    if (!dragRef.current.active) return;
    if (dragRef.current.touched.has(slot)) return;
    dragRef.current.touched.add(slot);
    const checked = dragRef.current.startChecked;
    const next = new Set(mySlots);
    if (checked) next.add(slot);
    else next.delete(slot);
    setMySlots(next);
    pendingRef.current.set(slot, checked);
    scheduleFlush();
  }

  function handleDragEnd() {
    dragRef.current.active = false;
  }

  async function handleConfirm(slot: string) {
    setConfirmLoading(true);
    try {
      await fetch(`/api/room/${code}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: auth.participantId, token: auth.token, slot }),
      });
      await onRefresh();
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleUnconfirm() {
    setConfirmLoading(true);
    try {
      await fetch(`/api/room/${code}/unconfirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: auth.participantId, token: auth.token }),
      });
      await onRefresh();
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleLeave() {
    await fetch(`/api/room/${code}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: auth.participantId, token: auth.token }),
    });
    localStorage.removeItem(`room:${code}:pid`);
    localStorage.removeItem(`room:${code}:token`);
    window.location.href = "/";
  }

  async function saveNote() {
    await fetch(`/api/room/${code}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: auth.participantId, token: auth.token, note }),
    });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  const baseExpireDate = new Date(Number(meta.baseExpireAt));
  const expireDateStr = baseExpireDate.toLocaleDateString("ko-KR");

  // Check if there's any overlap
  const hasOverlap = writerCount > 0 && Object.values(heatmap).some((pids) => pids.length > 0);
  const allSlots: string[] = [];
  for (const date of dates) {
    for (const hour of hours) {
      allSlots.push(`${date}T${String(hour).padStart(2, "0")}`);
    }
  }

  const confirmedSlot = meta.confirmedSlot;

  return (
    <div
      className="min-h-screen p-4 max-w-4xl mx-auto select-none"
      onMouseUp={handleDragEnd}
      onTouchEnd={handleDragEnd}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">{meta.title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">방 코드: {code}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{participantCount}명 입장 · {writerCount}명 작성</p>
          </div>
        </div>

        {meta.notice && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            {meta.notice}
          </div>
        )}

        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
          이 방은 생성 후 60일({expireDateStr}), 약속 확정 시 약속일+7일에 자동 삭제됩니다.
        </div>

        {confirmedSlot && (
          <div className="mt-2 bg-emerald-50 border border-emerald-400 rounded-lg p-3 text-sm font-medium text-emerald-800">
            확정된 약속: {confirmedSlot.replace("T", " ")}시
            {isOwner && (
              <button onClick={handleUnconfirm} disabled={confirmLoading} className="ml-3 text-xs text-red-600 hover:underline">
                취소
              </button>
            )}
          </div>
        )}
      </div>

      {/* Share */}
      <button
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
        }}
        className="mb-4 text-sm text-indigo-600 hover:underline"
      >
        링크 복사
      </button>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Date headers */}
          <div className="flex" style={{ marginLeft: "3rem" }}>
            {dates.map((date) => (
              <div key={date} className="flex-1 text-center text-xs font-medium text-gray-600 py-1 min-w-[60px]">
                {formatDate(date)}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {hours.map((hour) => (
            <div key={hour} className="flex items-stretch">
              <div className="w-12 flex-shrink-0 text-right pr-2 text-xs text-gray-400 leading-none pt-1">
                {formatHour(hour)}
              </div>
              {dates.map((date) => {
                const slot = `${date}T${String(hour).padStart(2, "0")}`;
                const myChecked = mySlots.has(slot);
                const heatPids = heatmap[slot] || [];
                const heatCount = heatPids.length;
                const isAllAgree = writerCount > 0 && heatCount === writerCount;
                const isConfirmed = confirmedSlot === slot;

                return (
                  <div
                    key={slot}
                    className={`
                      flex-1 min-w-[60px] h-8 border border-gray-200 cursor-pointer transition-colors relative
                      ${myChecked ? "bg-indigo-500 border-indigo-600" : "bg-white hover:bg-gray-50"}
                      ${isConfirmed ? "ring-2 ring-emerald-500 ring-inset" : ""}
                    `}
                    onMouseDown={() => handleCellStart(slot)}
                    onMouseEnter={() => handleCellEnter(slot)}
                    onTouchStart={(e) => { e.preventDefault(); handleCellStart(slot); }}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const el = document.elementFromPoint(touch.clientX, touch.clientY);
                      const s = el?.getAttribute("data-slot");
                      if (s) handleCellEnter(s);
                    }}
                    data-slot={slot}
                    onClick={() => {
                      if (heatCount > 0) setPopupSlot(slot);
                    }}
                  >
                    {/* Heat overlay */}
                    {heatCount > 0 && !myChecked && (
                      <div className={`absolute inset-0 ${heatColor(heatCount, writerCount)} opacity-70`} />
                    )}
                    {isAllAgree && (
                      <div className="absolute inset-0 ring-2 ring-emerald-400 ring-inset pointer-events-none" />
                    )}
                    {/* Count badge */}
                    {heatCount > 0 && (
                      <span className={`absolute inset-0 flex items-center justify-center text-xs font-medium pointer-events-none ${myChecked ? "text-white" : ""}`}>
                        {heatCount}
                      </span>
                    )}
                    {/* Owner confirm button */}
                    {isOwner && !confirmedSlot && heatCount > 0 && (
                      <button
                        className="absolute -top-5 left-0 right-0 text-xs text-emerald-600 hover:text-emerald-800 hidden group-hover:block"
                        onClick={(e) => { e.stopPropagation(); handleConfirm(slot); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>히트맵 (작성자 {writerCount}명 기준):</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-indigo-100 border border-gray-200" /> 일부
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-emerald-500 border border-gray-200" /> 전원
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-indigo-500 border border-gray-200" /> 내 선택
        </span>
      </div>

      {!hasOverlap && writerCount > 0 && (
        <div className="mt-4 text-center py-6 text-gray-400">
          아직 모두가 되는 시간이 없어요
        </div>
      )}

      {/* Owner confirm UI */}
      {isOwner && !confirmedSlot && (
        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-medium mb-2">약속 확정 (주최자 전용)</p>
          <p className="text-xs text-gray-400 mb-3">격자에서 칸을 클릭하면 해당 참여자 목록이 표시됩니다. 아래에서 슬롯을 직접 선택해 확정할 수 있습니다.</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(heatmap)
              .filter(([, pids]) => pids.length === writerCount && writerCount > 0)
              .map(([slot]) => (
                <button
                  key={slot}
                  onClick={() => handleConfirm(slot)}
                  disabled={confirmLoading}
                  className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:bg-emerald-200 transition-colors"
                >
                  {slot.replace("T", " ")}시 (전원 가능)
                </button>
              ))}
            {Object.entries(heatmap)
              .filter(([, pids]) => pids.length > 0 && pids.length < writerCount)
              .sort(([, a], [, b]) => b.length - a.length)
              .slice(0, 10)
              .map(([slot, pids]) => (
                <button
                  key={slot}
                  onClick={() => handleConfirm(slot)}
                  disabled={confirmLoading}
                  className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm hover:bg-indigo-100 transition-colors"
                >
                  {slot.replace("T", " ")}시 ({pids.length}/{writerCount}명)
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Personal note */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-1">개인 메모</label>
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="나만 보이는 메모"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={saveNote}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
          >
            {noteSaved ? "저장됨!" : "저장"}
          </button>
        </div>
      </div>

      {/* Leave */}
      <div className="mt-8 pb-8">
        {!leaveConfirm ? (
          <button onClick={() => setLeaveConfirm(true)} className="text-sm text-red-400 hover:text-red-600 hover:underline">
            탈퇴 (내 데이터 삭제)
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-500">정말 탈퇴할까요?</span>
            <button onClick={handleLeave} className="text-sm px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600">탈퇴</button>
            <button onClick={() => setLeaveConfirm(false)} className="text-sm text-gray-500 hover:underline">취소</button>
          </div>
        )}
      </div>

      {/* Popup */}
      {popupSlot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPopupSlot(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">{popupSlot.replace("T", " ")}시</h3>
            <p className="text-sm text-gray-500 mb-3">
              {(heatmap[popupSlot] || []).length}/{writerCount}명 가능
            </p>
            <div className="space-y-1">
              {(heatmap[popupSlot] || []).map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <span className="text-green-500">●</span>
                  <span className="text-sm">{participants[pid] || pid}</span>
                </div>
              ))}
              {Object.keys(participants).filter((pid) => !(heatmap[popupSlot] || []).includes(pid) && writerIds.includes(pid)).map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <span className="text-gray-300">●</span>
                  <span className="text-sm text-gray-400">{participants[pid] || pid}</span>
                </div>
              ))}
            </div>
            {isOwner && !confirmedSlot && (
              <button
                onClick={() => { handleConfirm(popupSlot!); setPopupSlot(null); }}
                disabled={confirmLoading}
                className="mt-4 w-full py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors"
              >
                이 시간으로 확정
              </button>
            )}
            <button onClick={() => setPopupSlot(null)} className="mt-2 w-full py-2 text-gray-500 text-sm hover:bg-gray-50 rounded-lg">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
