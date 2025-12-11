'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkPage() {
  const router = useRouter();

  // 新規セッションIDを生成してリダイレクト
  useEffect(() => {
    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    router.replace(`/work/${newSessionId}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-600">セッションを作成中...</p>
      </div>
    </div>
  );
}
