"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CreateRoomForm from "@/components/CreateRoomForm";

export default function Home() {
  const [mode, setMode] = useState<"landing" | "create" | "join">("landing");
  const [joinCode, setJoinCode] = useState("");
  const router = useRouter();

  if (mode === "create") {
    return <CreateRoomForm onBack={() => setMode("landing")} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-indigo-600">우리언제봐?</h1>
          <p className="mt-2 text-gray-500">모임 시간을 함께 정해요</p>
        </div>

        {mode === "landing" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              방 만들기
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-3 px-4 border-2 border-indigo-600 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 transition-colors"
            >
              코드로 입장
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="방 코드 입력 (예: AB3X9K)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full py-3 px-4 border border-gray-300 rounded-xl text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => joinCode.length === 6 && router.push(`/room/${joinCode}`)}
              disabled={joinCode.length !== 6}
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              입장
            </button>
            <button
              onClick={() => { setMode("landing"); setJoinCode(""); }}
              className="w-full py-2 text-gray-500 hover:text-gray-700"
            >
              뒤로
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
