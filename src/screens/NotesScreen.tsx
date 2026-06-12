import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { storageService } from '@services/storageService';
import type { Note } from '@apptypes/index';

const NotesScreen = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadNotes(); }, []);

  const loadNotes = useCallback(async () => {
    const saved = await storageService.getNotes();
    setNotes(saved);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Required', 'Please enter a title and content.');
      return;
    }
    const note: Note = {
      id: `note-${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await storageService.saveNote(note);
    setNotes((prev) => [note, ...prev]);
    setTitle('');
    setContent('');
    setAdding(false);
  }, [title, content]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Note', 'Delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await storageService.deleteNote(id);
          setNotes((prev) => prev.filter((n) => n.id !== id));
        },
      },
    ]);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>📝 Notes</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAdding((p) => !p)}>
          <Text style={styles.addBtnText}>{adding ? '✕ Cancel' : '+ New'}</Text>
        </TouchableOpacity>
      </View>

      {adding && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#888"
            autoFocus
          />
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={content}
            onChangeText={setContent}
            placeholder="Content"
            placeholderTextColor="#888"
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
            <Text style={styles.saveBtnText}>Save Note</Text>
          </TouchableOpacity>
        </View>
      )}

      {notes.length === 0 && !adding && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notes yet</Text>
          <Text style={styles.emptySubtext}>Notes saved via AI tools or tapped above appear here</Text>
        </View>
      )}

      {notes.map((note) => (
        <TouchableOpacity
          key={note.id}
          style={styles.noteCard}
          onLongPress={() => handleDelete(note.id)}
          activeOpacity={0.85}>
          <Text style={styles.noteTitle}>{note.title}</Text>
          <Text style={styles.noteContent} numberOfLines={3}>{note.content}</Text>
          <Text style={styles.noteDate}>{new Date(note.updatedAt).toLocaleString()}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.hint}>Long-press a note to delete it</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  addBtn: { backgroundColor: '#e94560', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  form: { backgroundColor: '#16213e', borderRadius: 12, padding: 16, marginBottom: 16 },
  input: { backgroundColor: '#0f0f23', borderRadius: 8, padding: 12, color: '#fff', marginBottom: 10, fontSize: 14 },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: '#e94560', padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: '#555', fontSize: 13, marginTop: 6, textAlign: 'center' },
  noteCard: { backgroundColor: '#16213e', borderRadius: 12, padding: 14, marginBottom: 10 },
  noteTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  noteContent: { color: '#ccc', fontSize: 13, lineHeight: 18 },
  noteDate: { color: '#666', fontSize: 11, marginTop: 6 },
  hint: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8 },
});

export default NotesScreen;
