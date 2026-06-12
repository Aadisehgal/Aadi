import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { ragModule } from '@modules/RAGModule';
import { ErrorBoundary } from '@components/ErrorBoundary';
import ConfirmDialog from '@components/ConfirmDialog';
import type { Document } from '@apptypes/index';

function DocumentScreenInner() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await ragModule.getDocuments();
      setDocuments(docs);
    } catch {
      // Silently fail on load
    }
  }, []);

  useEffect(() => {
    loadDocuments().catch(() => {});
  }, [loadDocuments]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [
          DocumentPicker.types.pdf,
          DocumentPicker.types.plainText,
          DocumentPicker.types.docx,
        ],
        allowMultiSelection: false,
      });

      const file = result[0];
      if (!file?.uri || !file.name) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['pdf', 'txt', 'docx'].includes(ext)) {
        Alert.alert('Unsupported File', 'Please select a PDF, TXT, or DOCX file.');
        return;
      }

      setLoading(true);

      try {
        await ragModule.addDocument(file.uri, file.name);
        await loadDocuments();
        Alert.alert('Success', `"${file.name}" indexed successfully.`);
      } catch (err) {
        Alert.alert(
          'Index Failed',
          err instanceof Error ? err.message : 'Failed to process document.'
        );
      } finally {
        setLoading(false);
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert('Error', 'Failed to pick document.');
      }
    }
  }, [loadDocuments]);

  const handleDeleteDocument = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await ragModule.deleteDocument(deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
    } catch {
      Alert.alert('Error', 'Failed to delete document.');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const renderItem = useCallback(
    ({ item }: { item: Document }) => (
      <View style={styles.docCard}>
        <View style={styles.docIconContainer}>
          <Text style={styles.docIcon}>
            {item.type === 'pdf' ? '📄' : item.type === 'docx' ? '📝' : '📃'}
          </Text>
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.docMeta}>
            {item.type.toUpperCase()} •{' '}
            {item.chunks.length} chunk{item.chunks.length !== 1 ? 's' : ''} •{' '}
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setDeleteTarget(item)}
          style={styles.deleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>
    ),
    []
  );

  const keyExtractor = useCallback((item: Document) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📚 Documents</Text>
        <Text style={styles.headerSub}>
          Upload PDFs, TXT, or DOCX files for local RAG search
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.uploadBtn, loading && styles.uploadBtnDisabled]}
        onPress={handlePickDocument}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.uploadBtnText}>＋ Add Document</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Documents are processed locally using TF-IDF. No data is sent to any
          server. Indexed content is injected as context when you ask related
          questions.
        </Text>
      </View>

      {documents.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyText}>No documents yet</Text>
          <Text style={styles.emptySubtext}>
            Tap "Add Document" to upload and index a file
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {loading && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator color="#e94560" size="small" />
          <Text style={styles.uploadingText}>Indexing document…</Text>
        </View>
      )}

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Document"
        message={`Remove "${deleteTarget?.name ?? ''}" from the index? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteDocument}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

export default function DocumentScreen() {
  return (
    <ErrorBoundary>
      <DocumentScreenInner />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  headerSub: { color: '#888', fontSize: 13, lineHeight: 18 },
  uploadBtn: {
    backgroundColor: '#e94560',
    margin: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  uploadBtnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: {
    backgroundColor: '#16213e',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4a90e2',
  },
  infoText: { color: '#7faed4', fontSize: 12, lineHeight: 18 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  docCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#16213e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docIcon: { fontSize: 22 },
  docInfo: { flex: 1 },
  docName: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  docMeta: { color: '#666', fontSize: 12, marginTop: 3 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 18 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  uploadingBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#1e1e30',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  uploadingText: { color: '#e94560', fontSize: 14, fontWeight: '600' },
});
