'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { database, isFirebaseConfigured } from '../../../lib/firebase';
import { ref, set, onValue, off, push, remove, update, serverTimestamp } from 'firebase/database';

interface Panel {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  userId?: string;
  userName?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface ConnectedUser {
  userId: string;
  userName: string;
  lastSeen: number;
}

export default function WorkPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  // 初期パネルデータ（左側余白に配置、上下余白なし）
  const initialPanels: Omit<Panel, 'id'>[] = [
    { text: 'ステージの進んだがんの治療', x: 20, y: 100, width: 200, height: 40 },
    { text: '長期の入院', x: 20, y: 140, width: 200, height: 40 },
    { text: 'パートナーの早期死亡', x: 20, y: 180, width: 200, height: 40 },
    { text: 'パートナーの介護や障害', x: 20, y: 220, width: 200, height: 40 },
    { text: '介護費用 (将来的に)', x: 20, y: 260, width: 200, height: 40 },
    { text: '交通事故による高額賠償', x: 20, y: 300, width: 200, height: 40 },
    { text: '火災などの住宅損傷', x: 20, y: 340, width: 200, height: 40 },
    { text: '風邪やインフルエンザ', x: 20, y: 380, width: 200, height: 40 },
    { text: '短期の入院', x: 20, y: 420, width: 200, height: 40 },
    { text: '骨折', x: 20, y: 460, width: 200, height: 40 },
    { text: '上皮内がん', x: 20, y: 500, width: 200, height: 40 },
    { text: '自動車の軽微な物損事故', x: 20, y: 540, width: 200, height: 40 },
    { text: '旅行のキャンセル費用', x: 20, y: 580, width: 200, height: 40 },
  ];

  const [panels, setPanels] = useState<Panel[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [draggingToZone, setDraggingToZone] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [initialPanelsLoaded, setInitialPanelsLoaded] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const moveThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<{ [key: string]: number }>({});

  // ユーザーIDとユーザー名の初期化
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ユーザーIDを生成（localStorageに保存）
    let storedUserId = localStorage.getItem('work-user-id');
    if (!storedUserId) {
      storedUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('work-user-id', storedUserId);
    }
    setUserId(storedUserId);

    // ユーザー名を取得（localStorageから）
    const storedUserName = localStorage.getItem('work-user-name') || 'ユーザー';
    setUserName(storedUserName);
  }, []);

  // Firebase Realtime Databaseとの接続
  useEffect(() => {
    if (!sessionId || !userId || !database) return;

    const sessionRef = ref(database, `work/${sessionId}`);
    const panelsRef = ref(database, `work/${sessionId}/panels`);
    const usersRef = ref(database, `work/${sessionId}/users`);

    // パネルの変更を監視
    const unsubscribePanels = onValue(panelsRef, (snapshot) => {
      if (snapshot.exists()) {
        const panelsData = snapshot.val();
        const panelsArray: Panel[] = Object.keys(panelsData).map(key => ({
          id: key,
          ...panelsData[key],
        }));
        
        // 初期パネルが存在するかチェック（初期パネルのIDパターンで判定）
        const hasInitialPanels = panelsArray.some(p => p.id.startsWith('initial-panel-'));
        
        // 初期パネルが存在しない場合、追加する
        if (!hasInitialPanels && !initialPanelsLoaded && database && sessionId) {
          const panelsToAdd = initialPanels.map((panel, index) => ({
            ...panel,
            id: `initial-panel-${Date.now()}-${index}`,
            userId,
            userName: userName || 'ユーザー',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
          
          // Firebaseに初期パネルを追加（既存のパネルとマージ）
          panelsToAdd.forEach(panel => {
            if (database) {
              const panelRef = ref(database, `work/${sessionId}/panels/${panel.id}`);
              set(panelRef, {
                text: panel.text,
                x: panel.x,
                y: panel.y,
                width: panel.width,
                height: panel.height,
                userId: panel.userId,
                userName: panel.userName,
                createdAt: panel.createdAt,
                updatedAt: panel.updatedAt,
              });
            }
          });
          setInitialPanelsLoaded(true);
        } else {
          setPanels(panelsArray);
          setInitialPanelsLoaded(true);
        }
      } else {
        // データが存在しない場合、初期パネルを追加
        if (!initialPanelsLoaded && database && sessionId) {
          const panelsToAdd = initialPanels.map((panel, index) => ({
            ...panel,
            id: `initial-panel-${Date.now()}-${index}`,
            userId,
            userName: userName || 'ユーザー',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
          
          // Firebaseに初期パネルを追加
          panelsToAdd.forEach(panel => {
            if (database) {
              const panelRef = ref(database, `work/${sessionId}/panels/${panel.id}`);
              set(panelRef, {
                text: panel.text,
                x: panel.x,
                y: panel.y,
                width: panel.width,
                height: panel.height,
                userId: panel.userId,
                userName: panel.userName,
                createdAt: panel.createdAt,
                updatedAt: panel.updatedAt,
              });
            }
          });
          setInitialPanelsLoaded(true);
        } else {
          setPanels([]);
        }
      }
      setIsConnected(true);
    }, (error) => {
      console.error('Firebase error:', error);
      setIsConnected(false);
    });

    // 接続ユーザーの監視
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const usersArray: ConnectedUser[] = Object.keys(usersData).map(key => ({
          userId: key,
          ...usersData[key],
        }));
        // 5分以内にアクティブなユーザーのみ表示
        const now = Date.now();
        const activeUsers = usersArray.filter(user => now - user.lastSeen < 5 * 60 * 1000);
        setConnectedUsers(activeUsers);
      } else {
        setConnectedUsers([]);
      }
    });

    // 自分のユーザー情報を登録
    if (!database) return;
    const userRef = ref(database, `work/${sessionId}/users/${userId}`);
    set(userRef, {
      userName: userName || 'ユーザー',
      lastSeen: Date.now(),
    });

    // 定期的にlastSeenを更新（30秒ごと）
    const heartbeatInterval = setInterval(() => {
      update(userRef, {
        lastSeen: Date.now(),
      });
    }, 30000);

    // クリーンアップ
    return () => {
      unsubscribePanels();
      unsubscribeUsers();
      clearInterval(heartbeatInterval);
      // ユーザー情報を削除
      if (database) {
        remove(userRef);
      }
    };
  }, [sessionId, userId, userName, initialPanelsLoaded]);

  // パネルを追加
  const addPanel = () => {
    if (!sessionId || !userId || !database) return;

    const panelsRef = ref(database, `work/${sessionId}/panels`);
    const newPanel: Omit<Panel, 'id'> = {
      text: '新しいリスク',
      x: 400,
      y: 300,
      width: 200,
      height: 40,
      userId,
      userName: userName || 'ユーザー',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    push(panelsRef, newPanel);
  };

  // 初期パネルを追加（既存セッションでも使用可能）
  const addInitialPanels = () => {
    if (!sessionId || !userId || !database) return;

    const panelsToAdd = initialPanels.map((panel, index) => ({
      ...panel,
      id: `initial-panel-${Date.now()}-${index}`,
      userId,
      userName: userName || 'ユーザー',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    // Firebaseに初期パネルを追加
    panelsToAdd.forEach(panel => {
      if (database) {
        const panelRef = ref(database, `work/${sessionId}/panels/${panel.id}`);
        set(panelRef, {
          text: panel.text,
          x: panel.x,
          y: panel.y,
          width: panel.width,
          height: panel.height,
          userId: panel.userId,
          userName: panel.userName,
          createdAt: panel.createdAt,
          updatedAt: panel.updatedAt,
        });
      }
    });
  };

  // パネルのサイズ変更（右端をドラッグ）
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // ドラッグ開始
  const handleMouseDown = (e: React.MouseEvent, panelId: string) => {
    if (editingId === panelId) return;
    
    const panel = panels.find(p => p.id === panelId);
    if (!panel) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    // 右端の10px以内をクリックした場合はリサイズ
    const clickX = e.clientX - rect.left;
    if (clickX >= rect.width - 10) {
      setResizingId(panelId);
      setResizeStartX(e.clientX);
      setResizeStartWidth(panel.width);
      e.stopPropagation();
      return;
    }

    setDraggingId(panelId);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // ドラッグ中
  const handleMouseMove = (e: React.MouseEvent) => {
    // リサイズ中
    if (resizingId && !draggingId) {
      const deltaX = e.clientX - resizeStartX;
      const newWidth = Math.max(100, resizeStartWidth + deltaX);
      
      const updatedPanels = panels.map(panel => 
        panel.id === resizingId
          ? { ...panel, width: newWidth }
          : panel
      );
      setPanels(updatedPanels);

      // スロットリング（100msごとに更新）
      if (moveThrottleRef.current) {
        clearTimeout(moveThrottleRef.current);
      }

      moveThrottleRef.current = setTimeout(() => {
        if (!database || !sessionId) return;
        const panel = updatedPanels.find(p => p.id === resizingId);
        if (panel) {
          const panelRef = ref(database, `work/${sessionId}/panels/${resizingId}`);
          update(panelRef, {
            width: panel.width,
            updatedAt: Date.now(),
          });
        }
      }, 100);
      return;
    }

    // ドラッグ中
    if (!draggingId || !boardRef.current || !sessionId) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const newX = e.clientX - boardRect.left - dragOffset.x;
    const newY = e.clientY - boardRect.top - dragOffset.y;

    const updatedPanels = panels.map(panel => 
      panel.id === draggingId
        ? { ...panel, x: Math.max(0, newX), y: Math.max(0, newY) }
        : panel
    );
    setPanels(updatedPanels);

    // スロットリング（100msごとに更新）
    if (moveThrottleRef.current) {
      clearTimeout(moveThrottleRef.current);
    }

    moveThrottleRef.current = setTimeout(() => {
      if (!database) return;
      const panel = updatedPanels.find(p => p.id === draggingId);
      if (panel) {
        const panelRef = ref(database, `work/${sessionId}/panels/${draggingId}`);
        update(panelRef, {
          x: panel.x,
          y: panel.y,
          updatedAt: Date.now(),
        });
      }
    }, 100);
  };

  // ドラッグ終了
  const handleMouseUp = (e: React.MouseEvent) => {
    if (moveThrottleRef.current) {
      clearTimeout(moveThrottleRef.current);
      moveThrottleRef.current = null;
    }

    // リサイズ終了
    if (resizingId) {
      setResizingId(null);
      return;
    }

    // ドラッグ中のパネルが編集ゾーンまたは削除ゾーン内にあるかチェック
    if (draggingId) {
      const headerElement = document.querySelector('header');
      if (headerElement) {
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        // 編集ゾーン: ヘッダー内の「ワーク」タイトルの横
        const editZones = headerElement.querySelectorAll('[class*="border-slate-300"], [class*="border-blue-500"]');
        if (editZones.length > 0) {
          const editRect = editZones[0].getBoundingClientRect();
          if (mouseX >= editRect.left && mouseX <= editRect.right && 
              mouseY >= editRect.top && mouseY <= editRect.bottom) {
            const panel = panels.find(p => p.id === draggingId);
            if (panel) {
              startEditing(panel);
            }
            setDraggingId(null);
            return;
          }
        }

        // 削除ゾーン: 編集ゾーンの右隣
        if (editZones.length > 1) {
          const deleteRect = editZones[1].getBoundingClientRect();
          if (mouseX >= deleteRect.left && mouseX <= deleteRect.right && 
              mouseY >= deleteRect.top && mouseY <= deleteRect.bottom) {
            deletePanel(draggingId);
            setDraggingId(null);
            return;
          }
        }
      }
    }

    setDraggingId(null);
  };

  // パネルを削除
  const deletePanel = (id: string) => {
    if (!sessionId || !database) return;
    const panelRef = ref(database, `work/${sessionId}/panels/${id}`);
    remove(panelRef);
    setEditingId(null);
  };

  // 編集開始
  const startEditing = (panel: Panel) => {
    setEditingId(panel.id);
    setEditingText(panel.text);
  };

  // 編集保存
  const saveEditing = (id: string) => {
    if (!sessionId || !database) return;
    const panelRef = ref(database, `work/${sessionId}/panels/${id}`);
    update(panelRef, {
      text: editingText,
      updatedAt: Date.now(),
    });
    setEditingId(null);
  };

  // 編集キャンセル
  const cancelEditing = () => {
    setEditingId(null);
  };

  // セッションIDがない場合は新規セッションを作成
  useEffect(() => {
    if (!sessionId && typeof window !== 'undefined') {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      router.replace(`/work/${newSessionId}`);
    }
  }, [sessionId, router]);

  // ユーザー名を設定
  const handleUserNameChange = (name: string) => {
    setUserName(name);
    localStorage.setItem('work-user-name', name);
    if (sessionId && userId && database) {
      const userRef = ref(database, `work/${sessionId}/users/${userId}`);
      update(userRef, {
        userName: name,
        lastSeen: Date.now(),
      });
    }
  };

  // URLをコピー
  const copySessionUrl = () => {
    if (typeof window !== 'undefined' && sessionId) {
      const url = `${window.location.origin}/work/${sessionId}`;
      navigator.clipboard.writeText(url).then(() => {
        alert('URLをクリップボードにコピーしました！');
      });
    }
  };

  // Firebaseが設定されていない場合の警告表示
  if (typeof window !== 'undefined' && !isFirebaseConfigured()) {
    return (
      <div className="min-h-screen bg-white text-slate-900 font-sans">
        <main className="max-w-4xl mx-auto px-6 py-20">
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-yellow-800 mb-4">
              ⚠️ Firebaseが設定されていません
            </h2>
            <p className="text-slate-700 mb-4">
              リアルタイム共同編集機能を使用するには、Firebaseの設定が必要です。
            </p>
            <div className="bg-white rounded p-4 mb-4">
              <h3 className="font-bold text-slate-800 mb-2">設定手順:</h3>
              <ol className="list-decimal list-inside space-y-2 text-slate-700">
                <li><code className="bg-slate-100 px-2 py-1 rounded">FIREBASE_SETUP.md</code> ファイルを参照</li>
                <li>Firebase Consoleでプロジェクトを作成</li>
                <li>Realtime Databaseを有効化</li>
                <li>プロジェクトルートに <code className="bg-slate-100 px-2 py-1 rounded">.env.local</code> ファイルを作成</li>
                <li>環境変数を設定（<code className="bg-slate-100 px-2 py-1 rounded">.env.local.example</code> を参考）</li>
                <li>開発サーバーを再起動</li>
              </ol>
            </div>
            <Link
              href="/"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <main className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 bg-white border-b-2 border-blue-800 py-4 relative">
          {/* 左側の余白スペースの中央に編集・削除ゾーンを配置 */}
          <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center" style={{ width: '208px' }}>
            <div className="flex items-center gap-2">
              <div
                className={`w-24 h-12 border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${
                  draggingId ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700">編集</span>
              </div>
              <div
                className={`w-24 h-12 border-2 border-dashed rounded-lg flex items-center justify-center transition-all ${
                  draggingId ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700">削除</span>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4 px-6" style={{ marginLeft: '208px' }}>
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-2xl font-bold text-blue-800 underline">
                ワーク: あなたの人生リスクMAP
              </h1>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-slate-600">
                  {isConnected ? '接続中' : '切断中'}
                </span>
              </div>
              {connectedUsers.length > 0 && (
                <div className="text-sm text-slate-600">
                  参加者: {connectedUsers.length}人
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <input
                type="text"
                value={userName}
                onChange={(e) => handleUserNameChange(e.target.value)}
                placeholder="あなたの名前"
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                onClick={addPanel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                + パネルを追加
              </button>
              <button
                onClick={addInitialPanels}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                title="左側余白に初期パネル（13個）を追加"
              >
                + 初期パネルを追加
              </button>
              {sessionId && (
                <div className="px-4 py-2 bg-slate-100 rounded-lg text-sm">
                  <span className="text-slate-600">セッションID: </span>
                  <span className="font-mono text-blue-600">{sessionId}</span>
                  <button
                    onClick={copySessionUrl}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    コピー
                  </button>
                </div>
              )}
              <Link
                href="/"
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors"
              >
                ホームに戻る
              </Link>
            </div>
          </div>
        </header>

        {/* リスクマトリクスエリア */}
        <div
          ref={boardRef}
          className="flex-1 relative overflow-auto bg-white"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={(e) => {
            if (draggingId) {
              handleMouseUp(e);
            }
          }}
        >

          {/* リスクマトリクスの背景 */}
          <div className="absolute inset-0 flex items-center justify-center min-h-full">
            <div className="relative w-full h-full max-w-5xl max-h-[calc(100vh-120px)] mx-auto my-8">
              {/* Y軸（縦軸） */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-blue-800 transform -translate-x-1/2" />
              
              {/* X軸（横軸） */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-blue-800 transform -translate-y-1/2" />

              {/* Y軸ラベル（事故の頻度） */}
              <div className="absolute left-1/2 top-4 transform -translate-x-1/2 text-center">
                <div className="text-blue-800 font-bold text-lg mb-2">事故の頻度</div>
                <div className="text-blue-800 font-semibold">よくある</div>
              </div>
              <div className="absolute left-1/2 bottom-4 transform -translate-x-1/2 text-center">
                <div className="text-blue-800 font-semibold">まれに</div>
              </div>

              {/* X軸ラベル（損害額） */}
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 -rotate-90 origin-center">
                <div className="text-blue-800 font-bold text-lg">損害額</div>
              </div>
              <div className="absolute left-8 top-1/2 transform -translate-y-1/2 text-blue-800 font-semibold">
                困らない
              </div>
              <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-blue-800 font-semibold">
                困る
              </div>

              {/* 象限の背景色（薄い） */}
              <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-blue-50/30" />
              <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-red-50/30" />
              <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-green-50/30" />
              <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-yellow-50/30" />
            </div>
          </div>

          {/* パネル */}
          {panels.map(panel => (
            <div
              key={panel.id}
              className={`absolute bg-yellow-100 border-2 border-yellow-400 rounded-lg shadow-lg ${
                draggingId === panel.id ? 'border-blue-500 z-50 shadow-2xl opacity-90 cursor-move' : 
                resizingId === panel.id ? 'border-green-500 z-50 cursor-ew-resize' : 
                'z-10 cursor-move'
              } ${editingId === panel.id ? 'ring-2 ring-emerald-500' : ''} ${
                panel.userId !== userId ? 'border-purple-400' : ''
              }`}
              style={{
                left: `${panel.x}px`,
                top: `${panel.y}px`,
                width: `${panel.width}px`,
                height: `${panel.height}px`,
              }}
              onMouseDown={(e) => handleMouseDown(e, panel.id)}
            >
              {/* パネルコンテンツ（1行表示、横に伸ばせる） */}
              <div className="px-3 h-full flex items-center relative">
                {editingId === panel.id ? (
                  <div className="space-y-2 w-full">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full p-2 bg-white text-slate-900 border border-slate-400 rounded resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      rows={3}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEditing(panel.id)}
                        className="px-3 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1 text-sm bg-slate-400 hover:bg-slate-500 text-white rounded transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="text-slate-800 whitespace-nowrap font-medium text-sm overflow-hidden text-ellipsis flex-1"
                      title={panel.text}
                    >
                      {panel.text || 'クリックしてテキストを入力'}
                    </div>
                    {/* リサイズハンドル（右端） */}
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-yellow-300/50"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setResizingId(panel.id);
                        setResizeStartX(e.clientX);
                        setResizeStartWidth(panel.width);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          ))}

          {/* パネルがない場合のメッセージ */}
          {panels.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-slate-500 text-lg mb-4">
                  パネルを追加してリスクを配置してください
                </p>
                <button
                  onClick={addPanel}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  + 最初のパネルを追加
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
