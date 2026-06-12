import RNFS from 'react-native-fs';
import { storageService } from '@services/storageService';
import type { Document, DocumentChunk } from '@apptypes/index';

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

// ─── Text Extraction ──────────────────────────────────────────────────────────

async function extractText(filePath: string, type: Document['type']): Promise<string> {
  switch (type) {
    case 'txt':
      return RNFS.readFile(filePath, 'utf8');

    case 'docx':
      return extractDocxText(filePath);

    case 'pdf':
      return extractPdfText(filePath);

    default:
      throw new Error(`Unsupported document type: ${type as string}`);
  }
}

/** Minimal DOCX text extraction: reads word/document.xml from the zip. */
async function extractDocxText(filePath: string): Promise<string> {
  // DOCX is a ZIP. react-native-fs can't unzip, so we read raw bytes
  // and do a simple regex parse of the embedded XML
  try {
    const base64 = await RNFS.readFile(filePath, 'base64');
    // PK header (50 4B 03 04) confirms it's a ZIP/DOCX
    if (!base64.startsWith('UEsD')) {
      throw new Error('Not a valid DOCX file (missing PK header)');
    }
    // Extract text between <w:t …> and </w:t> tags via pattern matching
    // This works on the raw binary because XML is ASCII-compatible
    const raw = atob(base64);
    const matches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) ?? [];
    const text = matches
      .map((m) => m.replace(/<[^>]+>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < 10) {
      throw new Error('Could not extract text from DOCX. File may be empty or encrypted.');
    }
    return text;
  } catch (e) {
    throw new Error(`DOCX extraction failed: ${(e as Error).message}`);
  }
}

/** PDF text extraction via markers between BT and ET operators. */
async function extractPdfText(filePath: string): Promise<string> {
  try {
    const base64 = await RNFS.readFile(filePath, 'base64');
    const raw = atob(base64);

    // Extract text from PDF stream objects (between BT...ET)
    const btMatches = raw.match(/BT[\s\S]*?ET/g) ?? [];
    const textParts: string[] = [];

    for (const block of btMatches) {
      // Match (text) Tj, [(text)] TJ, and <hex> Tj patterns
      const tjMatches = block.match(/\(([^)]+)\)\s*T[jJ]/g) ?? [];
      for (const tj of tjMatches) {
        const inner = tj.match(/\(([^)]+)\)/)?.[1];
        if (inner) {
          // Unescape PDF string escapes
          const decoded = inner
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')');
          textParts.push(decoded);
        }
      }
    }

    const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length < 10) {
      // Try alternate: grab readable ASCII strings from PDF
      const readable = raw.match(/[A-Za-z0-9 ,.!?;:'"()\-–]{20,}/g) ?? [];
      return readable.join(' ').replace(/\s+/g, ' ').trim();
    }
    return text;
  } catch (e) {
    throw new Error(`PDF extraction failed: ${(e as Error).message}`);
  }
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  // Tokenise by splitting on whitespace (word tokens)
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

// ─── TF-IDF Vectorisation ─────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/** Build a term-frequency map for a document. */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const total = tokens.length;
  tf.forEach((v, k) => tf.set(k, v / total));
  return tf;
}

/** Build vocabulary from all chunks, then create TF-IDF sparse vectors. */
function buildTfIdfVectors(chunks: string[]): {
  vocabulary: string[];
  vectors: number[][];
} {
  // Build vocabulary
  const tokenizedChunks = chunks.map(tokenize);
  const vocabSet = new Set<string>();
  for (const tokens of tokenizedChunks) tokens.forEach((t) => vocabSet.add(t));
  const vocabulary = Array.from(vocabSet);

  // IDF: log(N / df) + 1
  const N = tokenizedChunks.length;
  const idf = new Map<string, number>();
  for (const term of vocabulary) {
    const df = tokenizedChunks.filter((tokens) => tokens.includes(term)).length;
    idf.set(term, Math.log(N / (1 + df)) + 1);
  }

  // TF-IDF vectors
  const vectors = tokenizedChunks.map((tokens) => {
    const tf = termFrequency(tokens);
    return vocabulary.map((term) => (tf.get(term) ?? 0) * (idf.get(term) ?? 0));
  });

  return { vocabulary, vectors };
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom < 1e-10 ? 0 : dot / denom;
}

// ─── BM25 ─────────────────────────────────────────────────────────────────────

const BM25_K1 = 1.5;
const BM25_B = 0.75;

function bm25Score(
  queryTokens: string[],
  chunkTokens: string[],
  avgLen: number,
  idf: Map<string, number>
): number {
  const len = chunkTokens.length;
  const tf = termFrequency(chunkTokens);
  return queryTokens.reduce((score, term) => {
    const tfVal = (tf.get(term) ?? 0) * len; // raw count
    const idfVal = idf.get(term) ?? 0;
    const numerator = tfVal * (BM25_K1 + 1);
    const denominator = tfVal + BM25_K1 * (1 - BM25_B + BM25_B * (len / avgLen));
    return score + idfVal * (numerator / denominator);
  }, 0);
}

// ─── Character N-gram Fallback ────────────────────────────────────────────────

function ngramSimilarity(query: string, text: string, n = 3): number {
  const ngrams = (s: string) => {
    const set = new Set<string>();
    const lower = s.toLowerCase();
    for (let i = 0; i <= lower.length - n; i++) set.add(lower.substring(i, i + n));
    return set;
  };
  const qgrams = ngrams(query);
  const tgrams = ngrams(text);
  const intersection = [...qgrams].filter((g) => tgrams.has(g)).length;
  const union = new Set([...qgrams, ...tgrams]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── RAGModule ────────────────────────────────────────────────────────────────

class RAGModule {
  /** Upload, parse, chunk, vectorise and persist a document. */
  async addDocument(filePath: string, name: string): Promise<Document> {
    const ext = (filePath.split('.').pop() ?? '').toLowerCase();
    if (!['pdf', 'txt', 'docx'].includes(ext)) {
      throw new Error(`Unsupported file type: .${ext}. Supported: pdf, txt, docx`);
    }
    const type = ext as Document['type'];

    const rawText = await extractText(filePath, type);
    if (!rawText || rawText.length < 10) {
      throw new Error('Document appears to be empty or unreadable.');
    }

    const textChunks = chunkText(rawText);
    const { vocabulary, vectors } = buildTfIdfVectors(textChunks);

    const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    const chunks: DocumentChunk[] = textChunks.map((content, i) => ({
      id: `chunk-${docId}-${i}`,
      documentId: docId,
      content,
      vector: vectors[i] ?? [],
      position: i,
    }));

    const document: Document = {
      id: docId,
      name,
      type,
      content: rawText,
      chunks,
      createdAt: Date.now(),
    };

    await storageService.saveDocument(document);

    // Store vocabulary in MMKV for reuse
    storageService.setMMKVString(`vocab-${docId}`, JSON.stringify(vocabulary));

    return document;
  }

  /**
   * Retrieve top-k relevant chunks for a query using:
   * 1. TF-IDF cosine (primary)
   * 2. BM25 (fallback when cosine scores are too low)
   * 3. Character n-gram (last resort)
   */
  async retrieveChunks(query: string, topK = 3): Promise<DocumentChunk[]> {
    const documents = await storageService.getDocuments();
    if (documents.length === 0) return [];

    const queryTokens = tokenize(query);
    const allChunks: Array<{ chunk: DocumentChunk; score: number }> = [];

    for (const doc of documents) {
      if (doc.chunks.length === 0) continue;

      const chunkTexts = doc.chunks.map((c) => c.content);
      const { vocabulary, vectors } = buildTfIdfVectors(chunkTexts);

      // Build query vector using same vocabulary
      const queryTf = termFrequency(queryTokens);
      const queryVec = vocabulary.map((term) => queryTf.get(term) ?? 0);

      // Compute per-chunk IDF for BM25
      const N = doc.chunks.length;
      const idf = new Map<string, number>();
      for (const term of vocabulary) {
        const df = doc.chunks.filter((c) => tokenize(c.content).includes(term)).length;
        idf.set(term, Math.log(N / (1 + df)) + 1);
      }
      const avgLen = doc.chunks.reduce((s, c) => s + tokenize(c.content).length, 0) / N;

      for (let i = 0; i < doc.chunks.length; i++) {
        const chunk = doc.chunks[i];
        if (!chunk) continue;

        const chunkVec = vectors[i] ?? [];
        const cosine = cosineSimilarity(queryVec, chunkVec);

        // BM25 fallback
        const bm25 = bm25Score(queryTokens, tokenize(chunk.content), avgLen, idf);

        // N-gram fallback (normalised to [0,1])
        const ngram = ngramSimilarity(query, chunk.content);

        // Weighted blend: cosine 50%, BM25 30%, ngram 20%
        const normalBm25 = Math.min(1, bm25 / 10); // rough normalisation
        const score = cosine * 0.5 + normalBm25 * 0.3 + ngram * 0.2;

        allChunks.push({ chunk, score });
      }
    }

    return allChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.chunk);
  }

  /** Build context string injected into the system prompt. */
  async buildContext(query: string, topK = 3): Promise<string> {
    const chunks = await this.retrieveChunks(query, topK);
    if (chunks.length === 0) return '';

    const lines = chunks.map((c, i) => `[Document ${i + 1}]\n${c.content}`);
    return `Relevant document excerpts:\n\n${lines.join('\n\n')}`;
  }

  async getDocuments(): Promise<Document[]> {
    return storageService.getDocuments();
  }

  async deleteDocument(id: string): Promise<void> {
    await storageService.deleteDocument(id);
    storageService.setMMKVString(`vocab-${id}`, '');
  }
}

export const ragModule = new RAGModule();
