import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface PDFDoc {
  id: string;
  name: string;
  uri: string;
  size: number;
  addedAt: string;
  lastReadAt?: string;
}

const STORAGE_KEY = "pdf_reader_docs";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PDFCard({
  doc,
  onOpen,
  onDelete,
}: {
  doc: PDFDoc;
  onOpen: (doc: PDFDoc) => void;
  onDelete: (id: string) => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => onOpen(doc)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
        <Feather name="file-text" size={28} color={colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text
          style={[styles.cardName, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {doc.name.replace(/\.pdf$/i, "")}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>
            {formatSize(doc.size)}
          </Text>
          <Text style={[styles.cardMetaDot, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.cardMetaText, { color: colors.mutedForeground }]}>
            {formatDate(doc.addedAt)}
          </Text>
        </View>
        {doc.lastReadAt && (
          <Text style={[styles.cardLastRead, { color: colors.accent }]}>
            Last read {formatDate(doc.lastReadAt)}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => onDelete(doc.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.deleteBtn}
      >
        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [docs, setDocs] = useState<PDFDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setDocs(JSON.parse(raw) as PDFDoc[]);
    } catch (_) {}
    setLoading(false);
  };

  const saveDocs = async (updated: PDFDoc[]) => {
    setDocs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const pickPDF = useCallback(async () => {
    if (picking) return;
    setPicking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newDoc: PDFDoc = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: asset.name,
          uri: asset.uri,
          size: asset.size ?? 0,
          addedAt: new Date().toISOString(),
        };
        const updated = [newDoc, ...docs];
        await saveDocs(updated);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (_) {}
    setPicking(false);
  }, [picking, docs]);

  const openDoc = useCallback(
    async (doc: PDFDoc) => {
      const updated = docs.map((d) =>
        d.id === doc.id ? { ...d, lastReadAt: new Date().toISOString() } : d
      );
      await saveDocs(updated);
      router.push({ pathname: "/reader", params: { uri: doc.uri, name: doc.name } });
    },
    [docs]
  );

  const deleteDoc = useCallback(
    async (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = docs.filter((d) => d.id !== id);
      await saveDocs(updated);
    },
    [docs]
  );

  const filtered = search.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : docs;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View
        style={[
          styles.header,
          { backgroundColor: colors.navBackground, paddingTop: topInset + 12 },
        ]}
      >
        <View style={styles.headerRow}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
          />
          <View>
            <Text style={styles.headerTitle}>PDF Reader</Text>
            <Text style={styles.headerSub}>
              {docs.length} {docs.length === 1 ? "document" : "documents"}
            </Text>
          </View>
        </View>

        <View style={[styles.searchBar, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
          <Feather name="search" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search documents..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="book-open" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {search ? "No results found" : "No PDFs yet"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search
              ? "Try a different search term"
              : "Tap the + button to add your first PDF"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PDFCard doc={item} onOpen={openDoc} onDelete={deleteDoc} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomInset + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={filtered.length > 0}
        />
      )}

      <TouchableOpacity
        onPress={pickPDF}
        disabled={picking}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: bottomInset + 24,
            shadowColor: colors.primary,
          },
        ]}
        activeOpacity={0.85}
      >
        {picking ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Feather name="plus" size={28} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 10,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardMetaDot: {
    fontSize: 12,
  },
  cardLastRead: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  deleteBtn: {
    padding: 4,
    flexShrink: 0,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
