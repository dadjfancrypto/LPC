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

  const [panels, setPanels] = useState<Panel[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [draggingToZone, setDraggingToZone] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [initialPanelsLoaded, setInitialPanelsLoaded] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const matrixRef = useRef<HTMLDivElement>(null);
  const moveThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<{ [key: string]: number }>({});

  // テキストの文字数に応じてパネルの幅を計算する関数
  const calculatePanelWidth = (text: string): number => {
    // 日本語の文字幅を考慮（全角文字は約16-18px、半角は約8px）
    // パディングを最小限に（左右各8px、合計16px）
    const charCount = text.length;
    const minWidth = 60; // 最小幅
    const maxWidth = 250; // 最大幅
    const charWidth = 16.5; // 1文字あたりの幅（日本語全角を想定、切れないように少し余裕を持たせる）
    const padding = 16; // 左右のパディング合計（文字が切れないように少し余裕を持たせる）
    
    const calculatedWidth = charCount * charWidth + padding;
    return Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
  };

  // 初期パネルデータを計算する関数（リスクマトリクスコンテナを基準に）
  const getInitialPanels = (): Omit<Panel, 'id'>[] => {
    const panelHeight = 40;
    const panelSpacing = 2; // パネル間の余白を最小化
    
    // 初期パネルのテキストリスト（文字数の短い順に並べ替え）
    const panelTexts = [
      '骨折', // 2文字
      '上皮内がん', // 5文字
      '長期の入院', // 6文字
      '短期の入院', // 6文字
      '介護費用 (将来的)', // 9文字
      '火災などの住宅損傷', // 9文字
      '風邪やインフルエンザ', // 9文字
      'パートナーの早期死亡', // 10文字
      'パートナーの介護/障害', // 10文字
      '旅行のキャンセル費用', // 10文字
      'ステージの進んだがん', // 11文字
      '交通事故による高額賠償', // 12文字
      '自動車の軽微な物損事故', // 12文字
    ];
    
    if (!matrixRef.current) {
      // フォールバック: デフォルト位置（余白最小）
      const baseX = 20;
      const baseY = 20;
      return panelTexts.map((text, index) => ({
        text,
        x: baseX,
        y: baseY + (panelHeight + panelSpacing) * index,
        width: calculatePanelWidth(text),
        height: panelHeight,
      }));
    }
    
    const matrixRect = matrixRef.current.getBoundingClientRect();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) {
      return [];
    }
    
    // リスクマトリクスコンテナを基準にした相対位置（余白最小）
    const baseX = 20; // 左マージン
    const baseY = 20; // 上マージン（最小化）
    
    return panelTexts.map((text, index) => ({
      text,
      x: baseX,
      y: baseY + (panelHeight + panelSpacing) * index,
      width: calculatePanelWidth(text),
      height: panelHeight,
    }));
  };

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
    
    // オフラインモードの設定を取得（localStorageから）
    const storedOfflineMode = localStorage.getItem('work-offline-mode') === 'true';
    setOfflineMode(storedOfflineMode);
    
    // オフラインモードの場合、ローカルストレージからパネルを読み込む
    if (storedOfflineMode && sessionId) {
      const localPanelsKey = `work-panels-${sessionId}`;
      const localPanels = localStorage.getItem(localPanelsKey);
      if (localPanels) {
        try {
          const parsedPanels = JSON.parse(localPanels);
          setPanels(parsedPanels);
          // 初期パネルが存在するかチェック
          const hasInitialPanels = parsedPanels.some((p: Panel) => p.id.startsWith('initial-panel-'));
          setInitialPanelsLoaded(hasInitialPanels);
        } catch (e) {
          console.error('Failed to parse local panels:', e);
          setInitialPanelsLoaded(false);
        }
      } else {
        // ローカルストレージにパネルがない場合、初期パネルを追加する準備
        setInitialPanelsLoaded(false);
      }
    }
  }, [sessionId]);

  // オフラインモードで初期パネルを追加
  useEffect(() => {
    if (!offlineMode || !sessionId || initialPanelsLoaded || !userId) return;
    
    // リスクマトリクスコンテナが準備できているか確認
    if (matrixRef.current) {
      const initialPanelsData = getInitialPanels();
      const panelsToAdd = initialPanelsData.map((panel, index) => ({
        ...panel,
        id: `initial-panel-${Date.now()}-${index}`,
        userId,
        userName: userName || 'ユーザー',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      
      setPanels(panelsToAdd);
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(panelsToAdd));
      setInitialPanelsLoaded(true);
    } else {
      // リスクマトリクスコンテナが準備できていない場合、少し待ってから再試行
      const timer = setTimeout(() => {
        if (matrixRef.current && !initialPanelsLoaded) {
          const initialPanelsData = getInitialPanels();
          const panelsToAdd = initialPanelsData.map((panel, index) => ({
            ...panel,
            id: `initial-panel-${Date.now()}-${index}`,
            userId,
            userName: userName || 'ユーザー',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }));
          
          setPanels(panelsToAdd);
          const localPanelsKey = `work-panels-${sessionId}`;
          localStorage.setItem(localPanelsKey, JSON.stringify(panelsToAdd));
          setInitialPanelsLoaded(true);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [offlineMode, sessionId, initialPanelsLoaded, userId, userName]);
  
  // オフラインモードの初期化
  useEffect(() => {
    if (offlineMode) {
      // オフラインモードのときは接続状態として表示（Firebaseは使わない）
      setIsConnected(true);
      setConnectedUsers([]);
    }
  }, [offlineMode]);

  // Firebase Realtime Databaseとの接続
  useEffect(() => {
    if (!sessionId || !userId || !database || offlineMode) return;

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
          // リスクマトリクスコンテナが準備できているか確認
          if (matrixRef.current) {
            const initialPanelsData = getInitialPanels();
            const panelsToAdd = initialPanelsData.map((panel, index) => ({
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
            // リスクマトリクスコンテナが準備できていない場合、少し待ってから再試行
            setTimeout(() => {
              if (matrixRef.current && !initialPanelsLoaded) {
                const initialPanelsData = getInitialPanels();
                const panelsToAdd = initialPanelsData.map((panel, index) => ({
                  ...panel,
                  id: `initial-panel-${Date.now()}-${index}`,
                  userId,
                  userName: userName || 'ユーザー',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }));
                
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
              }
            }, 100);
          }
        }
        
        // 既存のパネルを表示
        setPanels(panelsArray);
        setInitialPanelsLoaded(true);
      } else {
        // データが存在しない場合、初期パネルを追加
        if (!initialPanelsLoaded && database && sessionId) {
          // リスクマトリクスコンテナが準備できているか確認
          if (matrixRef.current) {
            const initialPanelsData = getInitialPanels();
            const panelsToAdd = initialPanelsData.map((panel, index) => ({
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
            // リスクマトリクスコンテナが準備できていない場合、少し待ってから再試行
            setTimeout(() => {
              if (matrixRef.current && !initialPanelsLoaded) {
                const initialPanelsData = getInitialPanels();
                const panelsToAdd = initialPanelsData.map((panel, index) => ({
                  ...panel,
                  id: `initial-panel-${Date.now()}-${index}`,
                  userId,
                  userName: userName || 'ユーザー',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }));
                
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
              }
            }, 100);
          }
        } else {
          setPanels([]);
        }
      }
      setIsConnected(true);
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
    const db = database; // TypeScript用の変数
    const userRef = ref(db, `work/${sessionId}/users/${userId}`);
    set(userRef, {
      userName: userName || 'ユーザー',
      lastSeen: Date.now(),
    });

    // 定期的にlastSeenを更新（30秒ごと）
    const heartbeatInterval = setInterval(() => {
      if (db) {
        update(userRef, {
          lastSeen: Date.now(),
        });
      }
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
  }, [sessionId, userId, userName, offlineMode]);

  // パネルを追加
  const addPanel = () => {
    if (!sessionId || !userId) return;

    const newPanel: Panel = {
      id: `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

    // オフラインモードの場合、ローカルストレージに保存
    if (offlineMode) {
      const updatedPanels = [...panels, newPanel];
      setPanels(updatedPanels);
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(updatedPanels));
      return;
    }

    // オンラインモードの場合、Firebaseに追加
    if (!database) return;
    const panelsRef = ref(database, `work/${sessionId}/panels`);
    push(panelsRef, newPanel);
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
      setSelectedPanelId(panelId);
      e.stopPropagation();
      return;
    }

    setSelectedPanelId(panelId);
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

      // オフラインモードの場合、ローカルストレージへの保存はリサイズ終了時に行う（ラグを防ぐため）
      // スロットリング（100msごとに更新）
      if (!offlineMode) {
        if (moveThrottleRef.current) {
          clearTimeout(moveThrottleRef.current);
        }

        moveThrottleRef.current = setTimeout(() => {
          if (!database || !sessionId) return;
          const db = database; // TypeScript用の変数
          const panel = updatedPanels.find(p => p.id === resizingId);
          if (panel && db) {
            const panelRef = ref(db, `work/${sessionId}/panels/${resizingId}`);
            update(panelRef, {
              width: panel.width,
              updatedAt: Date.now(),
            });
          }
        }, 100);
      }
      return;
    }

    // ドラッグ中
    if (!draggingId || !boardRef.current || !sessionId) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    // ボード内の相対位置を計算
    const newX = e.clientX - boardRect.left - dragOffset.x;
    const newY = e.clientY - boardRect.top - dragOffset.y;

    const updatedPanels = panels.map(panel => 
      panel.id === draggingId
        ? { ...panel, x: Math.max(0, newX), y: Math.max(0, newY) }
        : panel
    );
    setPanels(updatedPanels);

    // オフラインモードの場合、ローカルストレージへの保存はドラッグ終了時に行う（ラグを防ぐため）
    // スロットリング（100msごとに更新）
    if (!offlineMode) {
      if (moveThrottleRef.current) {
        clearTimeout(moveThrottleRef.current);
      }

      moveThrottleRef.current = setTimeout(() => {
        if (!database) return;
        const db = database; // TypeScript用の変数
        const panel = updatedPanels.find(p => p.id === draggingId);
        if (panel && db) {
          const panelRef = ref(db, `work/${sessionId}/panels/${draggingId}`);
          update(panelRef, {
            x: panel.x,
            y: panel.y,
            updatedAt: Date.now(),
          });
        }
      }, 100);
    }
  };

  // ドラッグ終了
  const handleMouseUp = (e: React.MouseEvent) => {
    // オフラインモードの場合、ドラッグ終了時にローカルストレージに保存
    if (offlineMode && sessionId && draggingId) {
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(panels));
    }
    
    if (moveThrottleRef.current) {
      clearTimeout(moveThrottleRef.current);
      moveThrottleRef.current = null;
    }

    // リサイズ終了
    if (resizingId) {
      // オフラインモードの場合、リサイズ終了時にローカルストレージに保存
      if (offlineMode && sessionId) {
        const localPanelsKey = `work-panels-${sessionId}`;
        localStorage.setItem(localPanelsKey, JSON.stringify(panels));
      }
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
    if (!sessionId) return;
    
    // オフラインモードの場合、ローカルストレージから削除
    if (offlineMode) {
      const updatedPanels = panels.filter(p => p.id !== id);
      setPanels(updatedPanels);
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(updatedPanels));
      setEditingId(null);
      return;
    }
    
    // オンラインモードの場合、Firebaseから削除
    if (!database) return;
    const panelRef = ref(database, `work/${sessionId}/panels/${id}`);
    remove(panelRef);
    setEditingId(null);
  };

  // 全てのパネルをクリアして初期パネルを初期位置に戻す
  const clearAllPanels = () => {
    if (!sessionId || !userId) return;
    
    // リスクマトリクスコンテナが準備できているか確認
    if (!matrixRef.current) {
      // 少し待ってから再試行
      setTimeout(() => clearAllPanels(), 100);
      return;
    }
    if (!confirm('全てのパネルを削除して、初期パネルを初期位置に戻しますか？')) return;
    
    // 初期パネルを取得（リスクマトリクスコンテナを基準に）
    const initialPanels = getInitialPanels();
    
    // 初期パネルを追加
    const panelsToAdd = initialPanels.map((panel, index) => ({
      ...panel,
      id: `initial-panel-${Date.now()}-${index}`,
      userId,
      userName: userName || 'ユーザー',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    // オフラインモードの場合、ローカルストレージに保存
    if (offlineMode) {
      setPanels(panelsToAdd);
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(panelsToAdd));
      setInitialPanelsLoaded(true);
      setEditingId(null);
      return;
    }

    // オンラインモードの場合、Firebaseに保存
    if (!database) return;
    const panelsRef = ref(database, `work/${sessionId}/panels`);
    const db = database; // TypeScript用の変数
    remove(panelsRef).then(() => {
      panelsToAdd.forEach(panel => {
        const panelRef = ref(db, `work/${sessionId}/panels/${panel.id}`);
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
      });
    });
    setInitialPanelsLoaded(true);
    setEditingId(null);
  };


  // 編集開始
  const startEditing = (panel: Panel) => {
    setSelectedPanelId(panel.id);
    setEditingId(panel.id);
    setEditingText(panel.text);
  };

  // 編集保存
  const saveEditing = (id: string) => {
    if (!sessionId) return;
    
    // オフラインモードの場合、ローカルストレージに保存
    if (offlineMode) {
      const updatedPanels = panels.map(p => 
        p.id === id ? { ...p, text: editingText, updatedAt: Date.now() } : p
      );
      setPanels(updatedPanels);
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(updatedPanels));
      setEditingId(null);
      setSelectedPanelId(null);
      return;
    }
    
    // オンラインモードの場合、Firebaseに保存
    if (!database) return;
    const panelRef = ref(database, `work/${sessionId}/panels/${id}`);
    update(panelRef, {
      text: editingText,
      updatedAt: Date.now(),
    });
    setEditingId(null);
    setSelectedPanelId(null);
  };
  
  // オフラインモードの切り替え
  const toggleOfflineMode = () => {
    const newOfflineMode = !offlineMode;
    setOfflineMode(newOfflineMode);
    localStorage.setItem('work-offline-mode', String(newOfflineMode));
    
    if (newOfflineMode && sessionId) {
      // オフラインモードに切り替えた場合、現在のパネルをローカルストレージに保存
      const localPanelsKey = `work-panels-${sessionId}`;
      localStorage.setItem(localPanelsKey, JSON.stringify(panels));
    }
  };

  // 編集キャンセル
  const cancelEditing = () => {
    setEditingId(null);
    setSelectedPanelId(null);
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

  // Firebaseが設定されていない場合の警告表示（オフラインモードの場合はスキップ）
  if (typeof window !== 'undefined' && !isFirebaseConfigured() && !offlineMode) {
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
            <div className="mt-4">
              <p className="text-slate-700 mb-2">
                または、オフラインモードで使用することもできます（ローカルストレージのみ、リアルタイム同期なし）:
              </p>
              <button
                onClick={() => {
                  setOfflineMode(true);
                  localStorage.setItem('work-offline-mode', 'true');
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
              >
                ⚡ オフラインモードで使用
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <main className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 bg-white border-b-2 border-blue-800 py-2 md:py-4 relative">
          {/* 左側の余白スペースの中央に編集・削除ボタンを配置 */}
          <div className="absolute left-0 top-0 bottom-0 hidden md:flex items-center justify-center" style={{ width: '208px' }}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // 最初のパネルを選択する
                  if (panels.length > 0) {
                    const firstPanel = panels[0];
                    setSelectedPanelId(firstPanel.id);
                    startEditing(firstPanel);
                  }
                }}
                disabled={panels.length === 0}
                className={`w-20 h-10 md:w-24 md:h-12 border-2 rounded-lg flex items-center justify-center transition-all font-semibold text-xs ${
                  panels.length > 0
                    ? 'border-blue-500 bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer'
                    : 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                編集
              </button>
              <button
                onClick={() => {
                  // 最初のパネルを選択して削除する
                  if (panels.length > 0) {
                    const firstPanel = panels[0];
                    setSelectedPanelId(firstPanel.id);
                    deletePanel(firstPanel.id);
                    setSelectedPanelId(null);
                  }
                }}
                disabled={panels.length === 0}
                className={`w-20 h-10 md:w-24 md:h-12 border-2 rounded-lg flex items-center justify-center transition-all font-semibold text-xs ${
                  panels.length > 0
                    ? 'border-red-500 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer'
                    : 'border-slate-300 bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                削除
              </button>
            </div>
          </div>
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2 md:gap-4 px-2 md:px-6 md:ml-[208px]">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
              <h1 className="text-base md:text-2xl font-bold text-blue-800 underline">
                ワーク: あなたの人生リスクMAP
              </h1>
              <div className="flex items-center gap-1 md:gap-2">
                <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs md:text-sm text-slate-600">
                  {isConnected ? '接続中' : '切断中'}
                </span>
              </div>
              {connectedUsers.length > 0 && (
                <div className="text-xs md:text-sm text-slate-600">
                  参加者: {connectedUsers.length}人
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 md:gap-4 flex-wrap">
              <button
                onClick={toggleOfflineMode}
                className={`px-2 py-1 md:px-4 md:py-2 text-xs md:text-base rounded-lg transition-colors font-medium ${
                  offlineMode
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-slate-600 hover:bg-slate-700 text-white'
                }`}
                title={offlineMode ? 'オフラインモード: タイムラグなし' : 'オンラインモード: リアルタイム同期'}
              >
                {offlineMode ? '⚡ オフライン' : '🌐 オンライン'}
              </button>
              <button
                onClick={addPanel}
                className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-base bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                + 追加
              </button>
              <button
                onClick={clearAllPanels}
                className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-base bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                🔄 クリア
              </button>
              {sessionId && !offlineMode && (
                <button
                  onClick={copySessionUrl}
                  className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-base bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                >
                  共有
                </button>
              )}
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
          {/* よくわからないゾーン（初期パネルの一番上） - ボード基準の絶対配置 */}
          <div className="absolute z-10 hidden md:block" style={{ top: '20px', left: '120px' }}>
            <div className="w-24 h-12 md:w-32 md:h-16 border-2 border-dashed border-slate-300 bg-slate-50 rounded-lg flex items-center justify-center">
              <span className="text-xs font-semibold text-slate-700">よくわからない</span>
            </div>
          </div>

          {/* リスクマトリクスの背景 */}
          <div className="absolute inset-0 flex items-center justify-center min-h-full">
            <div 
              ref={matrixRef}
              className="relative w-full h-full max-w-5xl max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-120px)] mx-auto my-2 md:my-8 border-2 md:border-4 border-blue-800"
            >
              {/* Y軸（縦軸） */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-blue-800 transform -translate-x-1/2" />
              
              {/* X軸（横軸） */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-blue-800 transform -translate-y-1/2" />

              {/* Y軸ラベル（事故の頻度） - 十字線に被らないように調整 */}
              <div className="absolute left-1/2 top-8 md:top-12 transform -translate-x-1/2 text-center z-10 bg-white px-1 md:px-2">
                <div className="text-blue-800 font-bold text-sm md:text-lg mb-1 md:mb-2">事故の頻度</div>
                <div className="text-blue-800 font-semibold text-xs md:text-base">よくある</div>
              </div>
              <div className="absolute left-1/2 bottom-8 md:bottom-12 transform -translate-x-1/2 text-center z-10 bg-white px-1 md:px-2">
                <div className="text-blue-800 font-semibold text-xs md:text-base">まれに</div>
              </div>

              {/* X軸ラベル（損害額） - 横表示、十字線に被らないように調整 */}
              <div className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 -translate-y-4 md:-translate-y-6 z-10 bg-white px-1 md:px-2">
                <div className="text-blue-800 font-bold text-sm md:text-lg text-center">損害額</div>
              </div>
              <div className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 translate-y-1 z-10 bg-white px-1 md:px-2">
                <div className="text-blue-800 font-semibold text-xs md:text-base text-center whitespace-nowrap">困らない</div>
              </div>
              <div className="absolute right-8 md:right-12 top-1/2 transform -translate-y-1/2 text-blue-800 font-semibold text-xs md:text-base z-10 bg-white px-1 md:px-2">
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
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={(e) => {
                // テキスト選択を防ぐ
                if (editingId !== panel.id) {
                  e.preventDefault();
                }
                handleMouseDown(e, panel.id);
              }}
              className={`absolute bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 rounded-lg shadow-md transition-all select-none ${
                draggingId === panel.id ? 'border-blue-500 z-50 shadow-xl opacity-90 cursor-move scale-105' : 
                resizingId === panel.id ? 'border-green-500 z-50 cursor-ew-resize' : 
                selectedPanelId === panel.id ? 'border-blue-500 ring-2 ring-blue-300 z-40 shadow-lg' :
                'border-yellow-300 hover:border-yellow-400 hover:shadow-lg z-10 cursor-move'
              } ${editingId === panel.id ? 'ring-2 ring-emerald-500' : ''} ${
                panel.userId !== userId ? 'border-purple-300' : ''
              }`}
              style={{
                left: `${panel.x}px`,
                top: `${panel.y}px`,
                width: `${panel.width}px`,
                height: `${panel.height}px`,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
              }}
            >
              {/* パネルコンテンツ（1行表示、横に伸ばせる） */}
              <div className="px-2 h-full flex items-center relative select-none" style={{ userSelect: 'none' }}>
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
                      style={{ userSelect: 'text' }}
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

        </div>
      </main>
    </div>
  );
}
