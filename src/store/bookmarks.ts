import { create } from "zustand";
import {
  addBookmark as addBookmarkToIdb,
  clearAll as clearAllBookmarksFromIdb,
  loadAllBookmarks,
  removeBookmark as removeBookmarkFromIdb,
  type Bookmark,
} from "@/lib/storage/bookmarks";

export type { Bookmark } from "@/lib/storage/bookmarks";

interface BookmarksState {
  bookmarks: Bookmark[];
  /**
   * Best-effort prefill from IndexedDB. Called once on AppShell mount,
   * mirroring `hydrateMessageCache`.
   */
  hydrate: () => Promise<void>;
  /** Toggle helper — used by `MessageItem` from the hover toolbar. */
  addBookmark: (bookmark: Bookmark) => void;
  removeBookmark: (contextId: string, messageId: string) => void;
  /** O(1) check used by `MessageItem` to fill the icon. */
  isSaved: (contextId: string, messageId: string) => boolean;
  clearAll: () => void;
}

function sortByNewest(list: Bookmark[]): Bookmark[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  bookmarks: [],

  hydrate: async () => {
    const fromIdb = await loadAllBookmarks();
    set((s) => {
      // Merge by composite key — anything already in-memory (e.g. a
      // bookmark added between mount and hydration) wins over IDB so a
      // race doesn't lose a save.
      const keyed = new Map<string, Bookmark>();
      for (const b of fromIdb) keyed.set(`${b.contextId}::${b.messageId}`, b);
      for (const b of s.bookmarks) keyed.set(`${b.contextId}::${b.messageId}`, b);
      return { bookmarks: sortByNewest([...keyed.values()]) };
    });
  },

  addBookmark: (bookmark) => {
    set((s) => {
      // Replace any existing entry for the same message so a re-save
      // updates the snippet/contextLabel if they shifted.
      const without = s.bookmarks.filter(
        (b) => !(b.contextId === bookmark.contextId && b.messageId === bookmark.messageId)
      );
      return { bookmarks: sortByNewest([bookmark, ...without]) };
    });
    void addBookmarkToIdb(bookmark);
  },

  removeBookmark: (contextId, messageId) => {
    set((s) => ({
      bookmarks: s.bookmarks.filter(
        (b) => !(b.contextId === contextId && b.messageId === messageId)
      ),
    }));
    void removeBookmarkFromIdb(contextId, messageId);
  },

  isSaved: (contextId, messageId) =>
    get().bookmarks.some((b) => b.contextId === contextId && b.messageId === messageId),

  clearAll: () => {
    set({ bookmarks: [] });
    void clearAllBookmarksFromIdb();
  },
}));
