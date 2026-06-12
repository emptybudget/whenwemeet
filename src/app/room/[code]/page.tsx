import { Suspense } from "react";
import RoomClient from "@/components/RoomClient";

async function RoomContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomClient code={code} />;
}

export default function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-400">불러오는 중...</p>
        </div>
      }
    >
      <RoomContent params={params} />
    </Suspense>
  );
}
