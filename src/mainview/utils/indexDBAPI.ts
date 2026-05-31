/**
 * IndexDB用のCRUD API
 * データベースの初期化、作成、読取、更新、削除操作を提供します
 */

export interface IDBConfig {
  dbName: string;
  version: number;
  stores: {
    name: string;
    keyPath: string;
    indexes?: Array<{
      name: string;
      keyPath: string | string[];
      options?: IDBIndexParameters;
    }>;
  }[];
}

/**
 * IndexDBAPIクラス
 * シングルトンパターンでIndexDB操作を管理
 */
class IndexDBAPI {
  private static instance: IndexDBAPI;
  private db: IDBDatabase | null = null;
  private config: IDBConfig | null = null;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): IndexDBAPI {
    if (!IndexDBAPI.instance) {
      IndexDBAPI.instance = new IndexDBAPI();
    }
    return IndexDBAPI.instance;
  }

  /**
   * IndexDBを初期化
   * @param config データベース設定
   */
  async init(config: IDBConfig): Promise<IDBDatabase> {
    const openDatabase = (version: number) =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(config.dbName, version);

        request.onerror = () => {
          reject(new Error(`IndexDB初期化エラー: ${request.error}`));
        };

        request.onupgradeneeded = () => {
          const db = request.result;

          // 既存データを保持したまま、足りないストアだけ追加する
          config.stores.forEach((store) => {
            if (db.objectStoreNames.contains(store.name)) return;

            const objectStore = db.createObjectStore(store.name, {
              keyPath: store.keyPath,
              autoIncrement: false,
            });

            if (store.indexes) {
              store.indexes.forEach((index) => {
                objectStore.createIndex(index.name, index.keyPath, index.options);
              });
            }
          });
        };

        request.onsuccess = () => {
          resolve(request.result);
        };
      });

    const db = await openDatabase(config.version);
    const missingStores = config.stores.filter(
      (store) => !db.objectStoreNames.contains(store.name),
    );

    if (missingStores.length === 0) {
      this.db = db;
      this.config = config;
      return db;
    }

    db.close();
    const upgradedDb = await openDatabase(db.version + 1);
    this.db = upgradedDb;
    this.config = config;
    return upgradedDb;
  }

  /**
   * トランザクションを取得
   * @param storeName ストア名
   * @param mode 'readonly' | 'readwrite'
   */
  private getTransaction(
    storeName: string,
    mode: IDBTransactionMode = "readonly"
  ): IDBObjectStore {
    if (!this.db) {
      throw new Error("IndexDBが初期化されていません");
    }
    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  /**
   * データを作成（Create）
   * @param storeName ストア名
   * @param data 保存するデータ
   */
  async create<T>(storeName: string, data: T): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");
      const request = objectStore.add(data);

      request.onerror = () => {
        reject(new Error(`作成エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  /**
   * 複数のデータを作成（バッチ作成）
   * @param storeName ストア名
   * @param dataArray 保存するデータの配列
   */
  async createBatch<T>(storeName: string, dataArray: T[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");

      dataArray.forEach((data) => {
        const request = objectStore.add(data);
        request.onerror = () => {
          reject(new Error(`バッチ作成エラー: ${request.error}`));
        };
      });

      objectStore.transaction.oncomplete = () => {
        resolve();
      };

      objectStore.transaction.onerror = () => {
        reject(new Error(`トランザクションエラー`));
      };
    });
  }

  /**
   * データを読取（Read）
   * @param storeName ストア名
   * @param key キー
   */
  async read<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readonly");
      const request = objectStore.get(key);

      request.onerror = () => {
        reject(new Error(`読取エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };
    });
  }

  /**
   * すべてのデータを読取
   * @param storeName ストア名
   */
  async readAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readonly");
      const request = objectStore.getAll();

      request.onerror = () => {
        reject(new Error(`読取エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result as T[]);
      };
    });
  }

  /**
   * インデックスを使用してデータを検索
   * @param storeName ストア名
   * @param indexName インデックス名
   * @param query 検索キー
   */
  async query<T>(
    storeName: string,
    indexName: string,
    query: IDBValidKey
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readonly");
      const index = objectStore.index(indexName);
      const request = index.getAll(query);

      request.onerror = () => {
        reject(new Error(`クエリエラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result as T[]);
      };
    });
  }

  /**
   * インデックスを使用して範囲検索
   * @param storeName ストア名
   * @param indexName インデックス名
   * @param range IDBKeyRange
   */
  async queryRange<T>(
    storeName: string,
    indexName: string,
    range: IDBKeyRange
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readonly");
      const index = objectStore.index(indexName);
      const request = index.getAll(range);

      request.onerror = () => {
        reject(new Error(`範囲検索エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result as T[]);
      };
    });
  }

  /**
   * データを更新（Update）
   * @param storeName ストア名
   * @param data 更新するデータ
   */
  async update<T>(storeName: string, data: T): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");
      const request = objectStore.put(data);

      request.onerror = () => {
        reject(new Error(`更新エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  /**
   * 複数のデータを更新（バッチ更新）
   * @param storeName ストア名
   * @param dataArray 更新するデータの配列
   */
  async updateBatch<T>(storeName: string, dataArray: T[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");

      dataArray.forEach((data) => {
        const request = objectStore.put(data);
        request.onerror = () => {
          reject(new Error(`バッチ更新エラー: ${request.error}`));
        };
      });

      objectStore.transaction.oncomplete = () => {
        resolve();
      };

      objectStore.transaction.onerror = () => {
        reject(new Error(`トランザクションエラー`));
      };
    });
  }

  /**
   * データを削除（Delete）
   * @param storeName ストア名
   * @param key キー
   */
  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");
      const request = objectStore.delete(key);

      request.onerror = () => {
        reject(new Error(`削除エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * 複数のデータを削除（バッチ削除）
   * @param storeName ストア名
   * @param keys キーの配列
   */
  async deleteBatch(storeName: string, keys: IDBValidKey[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");

      keys.forEach((key) => {
        const request = objectStore.delete(key);
        request.onerror = () => {
          reject(new Error(`バッチ削除エラー: ${request.error}`));
        };
      });

      objectStore.transaction.oncomplete = () => {
        resolve();
      };

      objectStore.transaction.onerror = () => {
        reject(new Error(`トランザクションエラー`));
      };
    });
  }

  /**
   * ストア内のすべてのデータを削除
   * @param storeName ストア名
   */
  async clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const objectStore = this.getTransaction(storeName, "readwrite");
      const request = objectStore.clear();

      request.onerror = () => {
        reject(new Error(`クリアエラー: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * データベース全体を削除
   * @param dbName データベース名
   */
  async deleteDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);

      request.onerror = () => {
        reject(new Error(`データベース削除エラー: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = null;
        this.config = null;
        resolve();
      };
    });
  }

  /**
   * データベースに接続しているか確認
   */
  isConnected(): boolean {
    return this.db !== null;
  }

  /**
   * 現在のデータベース設定を取得
   */
  getConfig(): IDBConfig | null {
    return this.config;
  }

  /**
   * 現在のデータベースインスタンスを取得
   */
  getDatabase(): IDBDatabase | null {
    return this.db;
  }
}

// エクスポート
export const indexDBAPI = IndexDBAPI.getInstance();
export default IndexDBAPI;
