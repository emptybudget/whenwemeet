"use client";

import { useState, useRef, useCallback } from "react";
import type { Auth, RoomState } from "./RoomClient";

type Props = {
  code: string;
  auth: Auth;
  roomState: RoomState;
  myDates: Set<string>;
  setMyDates: (s: Set<string>) => void;
  onRefresh: () => Promise<void>;
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toKey(d: Date) {
  // Build from LOCAL date parts, not toISOString() (which is UTC and would
  // shift the day backwards for timezones ahead of UTC, e.g. KST = UTC+9).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function formatDateDow(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`;
}

function heatBg(count: number, total: number) {
  if (!total || !count) return "";
  const r = count / total;
  if (r === 1) return "bg-emerald-500 text-white";
  if (r >= 0.66) return "bg-indigo-400 text-white";
  if (r >= 0.33) return "bg-indigo-200 text-indigo-900";
  return "bg-indigo-100 text-indigo-800";
}

export default function MemoView({ code, auth, roomState, myDates, setMyDates, onRefresh }: Props) {
  const { meta, participants, writerIds, heatmap, notes } = roomState;
  const isOwner = meta.ownerId === auth.participantId;
  const participantCount = Object.keys(participants).length;
  const writerCount = writerIds.length;

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [popupDate, setPopupDate] = useState<string | null>(null);

  const [myNote, setMyNote] = useState(notes[auth.participantId] ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const [confirmInput, setConfirmInput] = useState(meta.confirmedText ?? "");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Drag toggle
  const dragRef = useRef<{ active: boolean; startChecked: boolean; touched: Set<string> }>({
    active: false, startChecked: false, touched: new Set(),
  });
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushToggles = useCallback(async () => {
    if (pendingRef.current.size === 0) return;
    const dates = Array.from(pendingRef.current.entries()).map(([date, checked]) => ({ date, checked }));
    pendingRef.current.clear();
    try {
      await fetch(`/api/room/${code}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: auth.participantId, token: auth.token, dates }),
      });
      await onRefresh();
    } catch {}
  }, [code, auth, onRefresh]);

  function scheduleFlush() {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushToggles, 300);
  }

  function handleDayDown(key: string) {
    const checked = !myDates.has(key);
    dragRef.current = { active: true, startChecked: checked, touched: new Set([key]) };
    const next = new Set(myDates);
    checked ? next.add(key) : next.delete(key);
    setMyDates(next);
    pendingRef.current.set(key, checked);
    scheduleFlush();
  }

  function handleDayEnter(key: string) {
    if (!dragRef.current.active) return;
    if (dragRef.current.touched.has(key)) return;
    dragRef.current.touched.add(key);
    const checked = dragRef.current.startChecked;
    const next = new Set(myDates);
    checked ? next.add(key) : next.delete(key);
    setMyDates(next);
    pendingRef.current.set(key, checked);
    scheduleFlush();
  }

  async function saveNote() {
    setNoteSaving(true);
    try {
      await fetch(`/api/room/${code}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: auth.participantId, token: auth.token, note: myNote }),
      });
      await onRefresh();
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirmInput.trim()) return;
    setConfirmLoading(true);
    try {
      await fetch(`/api/room/${code}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: auth.participantId, token: auth.token, confirmedText: confirmInput.trim() }),
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
      setConfirmInput("");
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

  const days = getDaysInMonth(calYear, calMonth);
  const firstDow = days[0].getDay();
  const baseExpireDate = new Date(Number(meta.baseExpireAt));

  // Per-participant dates (reversed from heatmap)
  const participantDates: Record<string, string[]> = {};
  for (const [date, pids] of Object.entries(heatmap)) {
    for (const pid of pids) {
      if (!participantDates[pid]) participantDates[pid] = [];
      participantDates[pid].push(date);
    }
  }
  for (const pid of Object.keys(participantDates)) {
    participantDates[pid].sort();
  }

  const overlappingDates = new Set(
    Object.entries(heatmap)
      .filter(([, pids]) => pids.length > 1)
      .map(([date]) => date)
  );

  const otherParticipants = Object.entries(participants).filter(([pid]) => pid !== auth.participantId);

  return (
    <div
      className="min-h-screen max-w-lg mx-auto p-4 py-6 select-none"
      onMouseUp={() => { dragRef.current.active = false; }}
    >
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">{meta.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">방 코드: <span className="font-mono font-medium text-gray-600">{code}</span></span>
              <button
                onClick={() => { navigator.clipboard.writeText(code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                {codeCopied ? "복사됨!" : "코드 복사"}
              </button>
            </div>
          </div>
          <span className="text-sm text-gray-400 mt-1">{participantCount}명 참여</span>
        </div>

        {meta.notice && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            {meta.notice}
          </div>
        )}

        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
          이 방은 생성 후 60일({baseExpireDate.toLocaleDateString("ko-KR")})에 자동 삭제됩니다.
        </div>

        {meta.confirmedText && (
          <div className="mt-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">확정된 약속</p>
            <p className="text-emerald-800 font-bold text-lg">{meta.confirmedText}</p>
            {isOwner && (
              <button onClick={handleUnconfirm} disabled={confirmLoading} className="mt-2 text-xs text-red-500 hover:underline">
                확정 취소
              </button>
            )}
          </div>
        )}

        <button onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="mt-3 text-sm text-indigo-500 hover:underline">
          {copied ? "복사됨!" : "링크 복사"}
        </button>
      </div>

      {/* Calendar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded text-sm">←</button>
          <span className="font-semibold text-sm">{calYear}년 {calMonth + 1}월</span>
          <button onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded text-sm">→</button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-400 mb-1">
          {DAY_LABELS.map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDow }).map((_, i) => <div key={i} />)}
          {days.map((d) => {
            const key = toKey(d);
            const myChecked = myDates.has(key);
            const heatPids = heatmap[key] || [];
            const count = heatPids.length;
            const isAll = writerCount > 0 && count === writerCount;
            const heatClass = heatBg(count, writerCount);

            return (
              <div
                key={key}
                className={`
                  relative rounded-lg py-2 text-sm font-medium cursor-pointer transition-colors text-center
                  ${myChecked ? "bg-indigo-500 text-white" : count > 0 ? heatClass : "hover:bg-gray-100 text-gray-700"}
                  ${isAll ? "ring-2 ring-emerald-400 ring-inset" : ""}
                `}
                onMouseDown={() => handleDayDown(key)}
                onMouseEnter={() => handleDayEnter(key)}
                onTouchStart={(e) => { e.preventDefault(); handleDayDown(key); }}
                onClick={() => count > 0 && setPopupDate(key)}
              >
                <div>{d.getDate()}</div>
                {count > 0 && (
                  <div className={`text-xs leading-none ${myChecked ? "text-indigo-200" : ""}`}>{count}명</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500 inline-block" /> 내 선택</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> 전원 가능</span>
        </div>

        {writerCount === 0 && (
          <p className="mt-3 text-center text-sm text-gray-400">날짜를 클릭해서 가능한 날을 선택하세요</p>
        )}
      </div>

      {/* Memo */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">
          메모 <span className="text-gray-400 font-normal text-xs">(추가로 전달할 내용)</span>
        </label>
        <textarea
          value={myNote}
          onChange={(e) => setMyNote(e.target.value)}
          rows={3}
          placeholder="예: 오전은 어렵고 오후면 다 됩니다"
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <button onClick={saveNote} disabled={noteSaving}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          {noteSaved ? "저장됨!" : noteSaving ? "저장 중..." : "저장"}
        </button>
        {(myDates.size > 0 || notes[auth.participantId]) && (
          <div className="mt-3 rounded-xl p-3 border border-indigo-200 bg-indigo-50">
            <p className="text-xs font-semibold mb-2 text-indigo-600">저장된 내 정보</p>
            {myDates.size > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {Array.from(myDates).sort().map((date) => {
                  const isOverlap = overlappingDates.has(date);
                  return (
                    <button
                      key={date}
                      onClick={() => setPopupDate(date)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        isOverlap
                          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {formatDateDow(date)}
                    </button>
                  );
                })}
              </div>
            )}
            {notes[auth.participantId] && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes[auth.participantId]}</p>
            )}
          </div>
        )}
      </div>

      {/* Other participants' dates + memos */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">
          다른 참여자 <span className="text-gray-400 font-normal text-xs">({otherParticipants.length}명)</span>
        </h2>
        {otherParticipants.length === 0 ? (
          <p className="text-sm text-gray-400">아직 다른 참여자가 없어요. 방 코드를 공유해보세요.</p>
        ) : (
          <div className="space-y-3">
            {otherParticipants.map(([pid, name]) => {
              const dates = participantDates[pid] || [];
              const note = notes[pid];
              return (
                <div key={pid} className="rounded-xl p-3 border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold mb-2 text-gray-500">{name}</p>
                  {dates.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {dates.map((date) => {
                        const isOverlap = overlappingDates.has(date);
                        return (
                          <button
                            key={date}
                            onClick={() => setPopupDate(date)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                              isOverlap
                                ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-400"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {formatDateDow(date)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-1">선택한 날짜 없음</p>
                  )}
                  {note && <p className="text-sm text-gray-700 whitespace-pre-wrap">{note}</p>}
                </div>
              );
            })}
          </div>
        )}
        {overlappingDates.size > 0 && (
          <p className="mt-2 text-xs text-emerald-600">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
            초록색 날짜는 나를 포함해 2명 이상 겹치는 날이에요
          </p>
        )}
      </div>

      {/* Owner confirm */}
      {isOwner && !meta.confirmedText && (
        <div className="mb-6 bg-gray-50 rounded-xl p-4">
          <p className="text-sm font-semibold mb-2">약속 확정 (주최자 전용)</p>
          <div className="flex gap-2">
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="예: 6월 21일 토요일 오후 2시"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button onClick={handleConfirm} disabled={confirmLoading || !confirmInput.trim()}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-40 transition-colors">
              확정
            </button>
          </div>
        </div>
      )}

      {/* Leave */}
      <div className="pt-4 border-t">
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

      {/* Date popup */}
      {popupDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPopupDate(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold mb-1">{popupDate}</h3>
            <p className="text-sm text-gray-500 mb-3">{(heatmap[popupDate] || []).length}/{writerCount}명 가능</p>
            <div className="space-y-1 mb-4">
              {(heatmap[popupDate] || []).map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <span className="text-emerald-500 text-xs">●</span>
                  <span className="text-sm">{participants[pid]}</span>
                </div>
              ))}
              {Object.keys(participants).filter((pid) => !(heatmap[popupDate] || []).includes(pid) && writerIds.includes(pid)).map((pid) => (
                <div key={pid} className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs">●</span>
                  <span className="text-sm text-gray-400">{participants[pid]}</span>
                </div>
              ))}
            </div>
            {isOwner && !meta.confirmedText && (
              <button
                onClick={() => { setConfirmInput(popupDate); setPopupDate(null); }}
                className="w-full py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 mb-2"
              >
                이 날로 확정
              </button>
            )}
            <button onClick={() => setPopupDate(null)} className="w-full py-2 text-gray-500 text-sm hover:bg-gray-50 rounded-lg">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
