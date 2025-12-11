import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// Firebase設定（環境変数から取得）
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 環境変数のチェック
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
];

const missingEnvVars = requiredEnvVars.filter(
  (key) => !process.env[key]
);

if (missingEnvVars.length > 0 && typeof window !== 'undefined') {
  console.warn(
    '⚠️ Firebase環境変数が設定されていません:',
    missingEnvVars.join(', ')
  );
  console.warn(
    '📖 設定方法: FIREBASE_SETUP.md を参照してください'
  );
}

// Firebaseアプリの初期化（既に初期化されている場合は再利用）
let app: FirebaseApp | null = null;
let database: Database | null = null;

if (typeof window !== 'undefined') {
  // クライアント側でのみ初期化
  if (getApps().length === 0) {
    // 必須の環境変数が設定されている場合のみ初期化
    if (
      firebaseConfig.projectId &&
      firebaseConfig.databaseURL &&
      firebaseConfig.apiKey
    ) {
      try {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
      } catch (error) {
        console.error('Firebase初期化エラー:', error);
      }
    } else {
      console.warn(
        '⚠️ Firebaseが設定されていません。.env.localファイルに環境変数を設定してください。'
      );
    }
  } else {
    app = getApps()[0];
    database = getDatabase(app);
  }
}

// エクスポート（nullの可能性があるため、使用時にチェックが必要）
export { database };
export const isFirebaseConfigured = () => {
  return database !== null && app !== null;
};

