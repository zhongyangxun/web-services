DROP TABLE IF EXISTS words;

CREATE TABLE words (
  word        TEXT NOT NULL COLLATE NOCASE,
  phonetic    TEXT,
  translation TEXT,
  exchange    TEXT,
  PRIMARY KEY (word)
);
