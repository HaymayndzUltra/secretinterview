import Database from 'better-sqlite3';
import path from 'node:path';
import type { SuggestionLine, TranscriptSegment } from '@shared/types';

export class SqliteStore {
  private db: Database.Database;
  private insertSegmentStmt: Database.Statement;
  private insertSuggestionStmt: Database.Statement;

  constructor(dbPath = path.resolve(process.cwd(), 'interview-assistant.db')) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        tx_id TEXT PRIMARY KEY,
        timestamp TEXT,
        text TEXT,
        confidence REAL
      );
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        tx_id TEXT,
        mode TEXT,
        summary TEXT,
        next_line TEXT,
        probe TEXT,
        why TEXT,
        created_at INTEGER,
        FOREIGN KEY (tx_id) REFERENCES transcripts(tx_id)
      );
    `);
    this.insertSegmentStmt = this.db.prepare(
      'INSERT OR REPLACE INTO transcripts (tx_id, timestamp, text, confidence) VALUES (@id, @timestamp, @text, @confidence)'
    );
    this.insertSuggestionStmt = this.db.prepare(
      `INSERT OR REPLACE INTO suggestions (id, tx_id, mode, summary, next_line, probe, why, created_at)
       VALUES (@id, @txId, @mode, @summary, @nextLine, @probe, @why, @createdAt)`
    );
  }

  public saveTranscript(segment: TranscriptSegment): void {
    this.insertSegmentStmt.run(segment);
  }

  public saveSuggestions(suggestions: SuggestionLine[]): void {
    const insertMany = this.db.transaction((items: SuggestionLine[]) => {
      for (const suggestion of items) {
        this.insertSuggestionStmt.run(suggestion);
      }
    });
    insertMany(suggestions);
  }
}
