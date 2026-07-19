-- Knowledge Base Table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FTS5 Virtual Table for Knowledge Base
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts USING fts5(
    id UNINDEXED,
    title,
    content,
    content=knowledge_base,
    content_rowid=rowid
);

-- Triggers to keep knowledge_base_fts in sync
CREATE TRIGGER IF NOT EXISTS knowledge_base_ai AFTER INSERT ON knowledge_base BEGIN
  INSERT INTO knowledge_base_fts(rowid, id, title, content) VALUES (new.rowid, new.id, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_base_ad AFTER DELETE ON knowledge_base BEGIN
  INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, id, title, content) VALUES('delete', old.rowid, old.id, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_base_au AFTER UPDATE ON knowledge_base BEGIN
  INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, id, title, content) VALUES('delete', old.rowid, old.id, old.title, old.content);
  INSERT INTO knowledge_base_fts(rowid, id, title, content) VALUES (new.rowid, new.id, new.title, new.content);
END;

-- We already have meeting_summaries table (from meeting-assistant.sql or similar), let's ensure FTS for it
CREATE VIRTUAL TABLE IF NOT EXISTS meeting_summaries_fts USING fts5(
    id UNINDEXED,
    meeting_id UNINDEXED,
    summary,
    content=meeting_summaries,
    content_rowid=rowid
);

-- Sync Triggers for meeting_summaries_fts
CREATE TRIGGER IF NOT EXISTS meeting_summaries_ai AFTER INSERT ON meeting_summaries BEGIN
  INSERT INTO meeting_summaries_fts(rowid, id, meeting_id, summary) VALUES (new.rowid, new.id, new.meeting_id, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS meeting_summaries_ad AFTER DELETE ON meeting_summaries BEGIN
  INSERT INTO meeting_summaries_fts(meeting_summaries_fts, rowid, id, meeting_id, summary) VALUES('delete', old.rowid, old.id, old.meeting_id, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS meeting_summaries_au AFTER UPDATE ON meeting_summaries BEGIN
  INSERT INTO meeting_summaries_fts(meeting_summaries_fts, rowid, id, meeting_id, summary) VALUES('delete', old.rowid, old.id, old.meeting_id, old.summary);
  INSERT INTO meeting_summaries_fts(rowid, id, meeting_id, summary) VALUES (new.rowid, new.id, new.meeting_id, new.summary);
END;
