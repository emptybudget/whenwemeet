"use client";

import { useState } from "react";
import type { Auth, RoomState } from "./RoomClient";

type Props = {
  code: string;
  auth: Auth;
  roomState: RoomState;
  onRefresh: () => Promise<void>;
};

export default function MemoView({ code, auth, roomState, onRefresh }: Props) {
  const { meta, participants, notes } = roomState;
  const isOwner = meta.ownerId === auth.participantId;
  const participantCount = Object.keys(participants).length;

  const [myNote, setMyNote] = useState(notes[auth.participantId] ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  const [confirmInput, setConfirmInput] = useState(meta.confirmedText ?? "");
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseExpireDate = new Date(Number(meta.baseExpireAt));
  const expireDateStr = baseExpireDate.toLocaleDateString("ko-KR");

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

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const otherParticipants = Object.entries(participants).filter(
    ([pid]) => pid !== auth.participantId
  );

  return (
    <div className="min-h-screen max-w-lg mx-auto p-4 py-6">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">{meta.title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">방 코드: <span className="font-mono font-medium">{code}</span></p>
          </div>
          <span className="text-sm text-gray-400 mt-1">{participantCount}명</span>
        </div>

        {meta.notice && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            {meta.notice}
          </div>
        )}

        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
          이 방은 생성 후 60일({expireDateStr})에 자동 삭제됩니다.
        </div>

        {meta.confirmedText && (
          <div className="mt-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4">
            <p className="text-xs text-emerald-600 font-medium mb-1">확정된 약속</p>
            <p className="text-emerald-800 font-bold text-lg">{meta.confirmedText}</p>
            {isOwner && (
              <button
                onClick={handleUnconfirm}
                disabled={confirmLoading}
                className="mt-2 text-xs text-red-500 hover:underline"
              >
                확정 취소
              </button>
            )}
          </div>
        )}

        <button onClick={copyLink} className="mt-3 text-sm text-indigo-500 hover:underline">
          {copied ? "복사됨!" : "링크 복사"}
        </button>
      </div>

      {/* My memo */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">
          내 메모 <span className="text-gray-400 font-normal text-xs">(언제 가능한지 적어주세요)</span>
        </label>
        <textarea
          value={myNote}
          onChange={(e) => setMyNote(e.target.value)}
          rows={4}
          placeholder="예: 주말 오후는 다 돼요. 평일은 저녁 7시 이후만 가능해요."
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <button
          onClick={saveNote}
          disabled={noteSaving}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          {noteSaved ? "저장됨!" : noteSaving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* Others' memos */}
      {otherParticipants.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">다른 참여자</h2>
          {otherParticipants.map(([pid, name]) => (
            <div key={pid} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-800 mb-1">{name}</p>
              {notes[pid] ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{notes[pid]}</p>
              ) : (
                <p className="text-xs text-gray-300">아직 메모 없음</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Owner: confirm */}
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
            <button
              onClick={handleConfirm}
              disabled={confirmLoading || !confirmInput.trim()}
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors disabled:opacity-40"
            >
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
    </div>
  );
}
