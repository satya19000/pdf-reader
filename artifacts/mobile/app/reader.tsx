import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { useColors } from "@/hooks/useColors";

// Dynamically loads PDF.js from CDN — no package install needed, works in nested iframes
function loadPDFJS(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) {
      resolve(w.pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Web-only component: renders each PDF page as a <canvas> element.
// Avoids iframe entirely — works even in Chrome's nested iframe context.
function WebPDFRenderer({
  uri,
  primaryColor,
  mutedColor,
}: {
  uri: string;
  primaryColor: string;
  mutedColor: string;
}) {
  const containerRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;

    const render = async () => {
      try {
        const pdfjsLib = await loadPDFJS();
        if (cancelled) return;

        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNum);
          const naturalWidth = page.getViewport({ scale: 1 }).width;
          const scale = Math.min((window.innerWidth - 24) / naturalWidth, 2);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = [
            "display:block",
            "margin:8px auto",
            "box-shadow:0 2px 10px rgba(0,0,0,0.14)",
            "background:#fff",
            "border-radius:4px",
          ].join(";");

          if (containerRef.current) {
            containerRef.current.appendChild(canvas);
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        }

        if (!cancelled) setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflowY: "auto",
        backgroundColor: "#E8E4DC",
        padding: "8px 0",
        boxSizing: "border-box",
      }}
    >
      <div ref={containerRef} />

      {status === "loading" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: `3px solid ${primaryColor}`,
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span
            style={{
              color: mutedColor,
              fontSize: 14,
              fontFamily: "Inter_400Regular, sans-serif",
            }}
          >
            Loading PDF...
          </span>
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            justifyContent: "center",
            height: "60vh",
            gap: "12px",
            padding: "0 32px",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 36 }}>⚠️</span>
          <span
            style={{
              color: "#1C2B4A",
              fontSize: 17,
              fontWeight: 600,
              fontFamily: "Inter_600SemiBold, sans-serif",
            }}
          >
            Could not load PDF
          </span>
          <span style={{ color: mutedColor, fontSize: 14 }}>
            The file may be corrupted or inaccessible.
          </span>
        </div>
      )}
    </div>
  );
}

export default function ReaderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { uri, name } = useLocalSearchParams<{ uri: string; name: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const displayName = (name ?? "Document").replace(/\.pdf$/i, "");

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ url: uri ?? "", message: name ?? "PDF Document" });
    } catch (_) {}
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const openExternal = async () => {
    if (!uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Linking.openURL(uri);
    } catch (_) {}
  };

  const renderContent = () => {
    if (!uri) {
      return (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            No file provided
          </Text>
        </View>
      );
    }

    // Web: use PDF.js canvas renderer — no iframe, no Chrome blocking
    if (Platform.OS === "web") {
      return (
        <View style={StyleSheet.absoluteFill}>
          <WebPDFRenderer
            uri={uri}
            primaryColor={colors.primary}
            mutedColor={colors.mutedForeground}
          />
        </View>
      );
    }

    // Android: WebView can't render PDFs — open in system viewer
    if (Platform.OS === "android") {
      return (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <View style={[styles.pdfIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="file-text" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {displayName}
          </Text>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            Tap below to open in your device's PDF viewer.
          </Text>
          <TouchableOpacity
            onPress={openExternal}
            style={[styles.openBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Feather name="external-link" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.openBtnText}>Open PDF</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // iOS: WKWebView renders PDFs natively
    return (
      <View style={styles.fill}>
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.webview}
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          originWhitelist={["*"]}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowFileAccessFromFileURLs
          javaScriptEnabled
          scrollEnabled
        />
        {loading && (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.centered,
              { backgroundColor: colors.background },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading PDF...
            </Text>
          </View>
        )}
        {error && (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.centered,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={[styles.pdfIcon, { backgroundColor: colors.muted }]}>
              <Feather name="alert-circle" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.errorTitle, { color: colors.foreground }]}>
              Could not display PDF
            </Text>
            <TouchableOpacity
              onPress={openExternal}
              style={[styles.openBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Feather name="external-link" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.openBtnText}>Open Externally</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.navBackground,
            paddingTop: topInset + 10,
            paddingBottom: 12,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.headerBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
          >
            <Feather name="share" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.fill, { paddingBottom: bottomInset }]}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  webview: { flex: 1, backgroundColor: "transparent" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 36,
  },
  pdfIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  openBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
  },
  openBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
