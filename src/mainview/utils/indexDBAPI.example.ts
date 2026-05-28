/**
 * IndexDB CRUD API の使用例
 */

import { indexDBAPI, IDBConfig } from './indexDBAPI';

/**
 * 例1: データベースの初期化
 */
export async function exampleInit() {
  const config: IDBConfig = {
    dbName: 'scheduline-db',
    version: 1,
    stores: [
      {
        name: 'events',
        keyPath: 'id',
        indexes: [
          {
            name: 'dateIndex',
            keyPath: 'date',
          },
          {
            name: 'categoryIndex',
            keyPath: 'category',
          },
        ],
      },
      {
        name: 'users',
        keyPath: 'userId',
        indexes: [
          {
            name: 'emailIndex',
            keyPath: 'email',
            options: { unique: true },
          },
        ],
      },
    ],
  };

  try {
    await indexDBAPI.init(config);
    console.log('IndexDB initialized successfully');
  } catch (error) {
    console.error('Failed to initialize IndexDB:', error);
  }
}

/**
 * 例2: 単一データの作成（Create）
 */
export async function exampleCreate() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  const event: Event = {
    id: 'event-1',
    title: 'Team Meeting',
    date: '2024-01-15',
    category: 'work',
  };

  try {
    const result = await indexDBAPI.create('events', event);
    console.log('Event created with key:', result);
  } catch (error) {
    console.error('Failed to create event:', error);
  }
}

/**
 * 例3: 複数データの作成（バッチ作成）
 */
export async function exampleCreateBatch() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  const events: Event[] = [
    {
      id: 'event-1',
      title: 'Meeting 1',
      date: '2024-01-15',
      category: 'work',
    },
    {
      id: 'event-2',
      title: 'Meeting 2',
      date: '2024-01-16',
      category: 'work',
    },
    {
      id: 'event-3',
      title: 'Personal Event',
      date: '2024-01-17',
      category: 'personal',
    },
  ];

  try {
    await indexDBAPI.createBatch('events', events);
    console.log('Multiple events created successfully');
  } catch (error) {
    console.error('Failed to create events batch:', error);
  }
}

/**
 * 例4: 単一データの読取（Read）
 */
export async function exampleRead() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  try {
    const event = await indexDBAPI.read<Event>('events', 'event-1');
    if (event) {
      console.log('Event found:', event);
    } else {
      console.log('Event not found');
    }
  } catch (error) {
    console.error('Failed to read event:', error);
  }
}

/**
 * 例5: すべてのデータを読取
 */
export async function exampleReadAll() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  try {
    const events = await indexDBAPI.readAll<Event>('events');
    console.log('All events:', events);
  } catch (error) {
    console.error('Failed to read all events:', error);
  }
}

/**
 * 例6: インデックスを使用して検索
 */
export async function exampleQuery() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  try {
    const workEvents = await indexDBAPI.query<Event>(
      'events',
      'categoryIndex',
      'work'
    );
    console.log('Work events:', workEvents);
  } catch (error) {
    console.error('Failed to query events:', error);
  }
}

/**
 * 例7: 範囲検索
 */
export async function exampleQueryRange() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  try {
    // 2024-01-15 から 2024-01-20 までのイベントを検索
    const range = IDBKeyRange.bound('2024-01-15', '2024-01-20');
    const events = await indexDBAPI.queryRange<Event>(
      'events',
      'dateIndex',
      range
    );
    console.log('Events in date range:', events);
  } catch (error) {
    console.error('Failed to query range:', error);
  }
}

/**
 * 例8: 単一データの更新（Update）
 */
export async function exampleUpdate() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  const updatedEvent: Event = {
    id: 'event-1',
    title: 'Updated Meeting',
    date: '2024-01-15',
    category: 'work',
  };

  try {
    const result = await indexDBAPI.update('events', updatedEvent);
    console.log('Event updated with key:', result);
  } catch (error) {
    console.error('Failed to update event:', error);
  }
}

/**
 * 例9: 複数データの更新（バッチ更新）
 */
export async function exampleUpdateBatch() {
  interface Event {
    id: string;
    title: string;
    date: string;
    category: string;
  }

  const events: Event[] = [
    {
      id: 'event-1',
      title: 'Updated Meeting 1',
      date: '2024-01-15',
      category: 'work',
    },
    {
      id: 'event-2',
      title: 'Updated Meeting 2',
      date: '2024-01-16',
      category: 'personal',
    },
  ];

  try {
    await indexDBAPI.updateBatch('events', events);
    console.log('Multiple events updated successfully');
  } catch (error) {
    console.error('Failed to update events batch:', error);
  }
}

/**
 * 例10: 単一データの削除（Delete）
 */
export async function exampleDelete() {
  try {
    await indexDBAPI.delete('events', 'event-1');
    console.log('Event deleted successfully');
  } catch (error) {
    console.error('Failed to delete event:', error);
  }
}

/**
 * 例11: 複数データの削除（バッチ削除）
 */
export async function exampleDeleteBatch() {
  try {
    await indexDBAPI.deleteBatch('events', ['event-1', 'event-2', 'event-3']);
    console.log('Multiple events deleted successfully');
  } catch (error) {
    console.error('Failed to delete events batch:', error);
  }
}

/**
 * 例12: ストアのクリア
 */
export async function exampleClearStore() {
  try {
    await indexDBAPI.clearStore('events');
    console.log('Events store cleared successfully');
  } catch (error) {
    console.error('Failed to clear store:', error);
  }
}

/**
 * 例13: データベースの削除
 */
export async function exampleDeleteDatabase() {
  try {
    await indexDBAPI.deleteDatabase('scheduline-db');
    console.log('Database deleted successfully');
  } catch (error) {
    console.error('Failed to delete database:', error);
  }
}

/**
 * 例14: 接続確認
 */
export function exampleCheckConnection() {
  if (indexDBAPI.isConnected()) {
    console.log('Connected to IndexDB');
    const config = indexDBAPI.getConfig();
    console.log('Database config:', config);
  } else {
    console.log('Not connected to IndexDB');
  }
}
