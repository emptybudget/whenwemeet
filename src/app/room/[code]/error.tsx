"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <p className="text-red-500 font-medium">페이지를 불러오지 못했습니다</p>
        <p className="text-gray-400 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
