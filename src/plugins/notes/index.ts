import { storageService } from '@services/storageService';
import type { Plugin, PluginResult } from '@apptypes/index';

const notesPlugin: Plugin = {
  id: 'notes',
  name: 'Notes',
  description: 'Create, read, list, delete notes in SQLite',
  execute: async (params): Promise<PluginResult> => {
    const action = params.action as string;
    try {
      switch (action) {
        case 'create': {
          const note = {
            id: `note-${Date.now()}`,
            title: (params.title as string) ?? 'Untitled',
            content: (params.content as string) ?? '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await storageService.saveNote(note);
          return { success: true, data: JSON.stringify(note) };
        }
        case 'read': {
          const notes = await storageService.getNotes();
          const note = notes.find((n) => n.id === (params.id as string));
          if (!note) return { success: false, error: 'Note not found' };
          return { success: true, data: JSON.stringify(note) };
        }
        case 'list': {
          const notes = await storageService.getNotes();
          return { success: true, data: JSON.stringify(notes) };
        }
        case 'delete': {
          await storageService.deleteNote(params.id as string);
          return { success: true, data: 'Note deleted.' };
        }
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Notes operation failed',
      };
    }
  },
};

export default notesPlugin;
