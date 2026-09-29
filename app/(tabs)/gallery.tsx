import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { buildGalleryFolders, galleryAssetCount, type GalleryAsset, type GalleryFolder } from "@/lib/gallery";
import { fromRemoteInspection, type Inspection, type RemoteInspectionRecord } from "@/lib/inspection-storage";

type GalleryInspection = RemoteInspectionRecord;
type PreparedInspection = { record: GalleryInspection; item: Inspection; folders: GalleryFolder[]; assetCount: number };
type GalleryEntry = GalleryAsset | GalleryFolder | PreparedInspection;

function isGalleryAsset(entry: GalleryEntry): entry is GalleryAsset { return "uri" in entry && "kind" in entry; }
function isGalleryFolder(entry: GalleryEntry): entry is GalleryFolder { return "assets" in entry && "key" in entry; }

export default function GalleryScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const canOpen = Boolean(user && (user.role === "admin" || user.permissions?.viewAllInspections));
  const dashboard = trpc.admin.dashboard.useQuery(undefined, { enabled: canOpen, retry: false });
  const [search, setSearch] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<GalleryAsset | null>(null);

  const inspections = useMemo(() => (dashboard.data?.inspections ?? []) as GalleryInspection[], [dashboard.data]);
  const prepared = useMemo<PreparedInspection[]>(() => inspections.map((record) => {
    const item = fromRemoteInspection(record);
    return { record, item, folders: buildGalleryFolders(item), assetCount: galleryAssetCount(item) };
  }), [inspections]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return prepared.filter(({ record, item }) => !term || `${record.sequentialCode} ${record.propertyAddress} ${item.property.ownerName} ${item.inspectorName}`.toLowerCase().includes(term));
  }, [prepared, search]);
  const selected = prepared.find(({ record }) => record.id === selectedInspectionId);
  const folder = selected?.folders.find((candidate) => candidate.key === selectedFolderKey);
  const listData: GalleryEntry[] = folder ? folder.assets : selected ? selected.folders : filtered;

  const openInspection = (id: number) => { setSelectedInspectionId(id); setSelectedFolderKey(null); };
  const goRoot = () => { setSelectedInspectionId(null); setSelectedFolderKey(null); };
  const goFolders = () => setSelectedFolderKey(null);

  if (loading || dashboard.isLoading) return <Center text="Carregando galeria…" />;
  if (!user) return <Access title="Acesso necessário" text="Entre com seu e-mail e senha para visualizar a galeria." action="Ir para o login" onPress={() => router.push("/login")} />;
  if (!canOpen) return <Access title="Galeria restrita" text="A galeria administrativa está disponível apenas para usuários com acesso a todas as vistorias." action="Voltar" onPress={() => router.replace("/")} />;

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <FlatList<GalleryEntry>
      data={listData}
      keyExtractor={(entry) => isGalleryAsset(entry) ? entry.id : isGalleryFolder(entry) ? entry.key : String(entry.record.id)}
      numColumns={folder ? 2 : 1}
      columnWrapperStyle={folder ? styles.photoRow : undefined}
      contentContainerStyle={styles.content}
      ListHeaderComponent={<>
        <View style={styles.header}><View style={styles.headerIcon}><IconSymbol name="photo.fill" size={25} color="#fff" /></View><View style={styles.headerCopy}><Text style={styles.eyebrow}>GESTÃO DE MÍDIAS</Text><Text style={styles.title}>Galeria administrativa</Text><Text style={styles.subtitle}>Navegue pelas vistorias, ambientes e pastas de fotos sincronizadas.</Text></View></View>
        <View style={styles.breadcrumb}><Pressable onPress={goRoot}><Text style={[styles.breadcrumbText, !selected && styles.breadcrumbActive]}>Vistorias</Text></Pressable>{selected ? <><Text style={styles.breadcrumbSeparator}>›</Text><Pressable onPress={goFolders}><Text style={[styles.breadcrumbText, !folder && styles.breadcrumbActive]}>{selected.record.sequentialCode}</Text></Pressable></> : null}{folder ? <><Text style={styles.breadcrumbSeparator}>›</Text><Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>{folder.label}</Text></> : null}</View>
        {!selected ? <View style={styles.searchBox}><IconSymbol name="magnifyingglass" size={18} color="#738078" /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por código, endereço ou vistoriador" placeholderTextColor="#9AA59E" style={styles.search} /></View> : <View style={styles.contextBar}><Text style={styles.contextTitle}>{folder ? folder.label : selected.record.propertyAddress}</Text><Text style={styles.contextSubtitle}>{folder ? `${folder.assets.length} arquivo(s)` : `${selected.assetCount} arquivo(s) em ${selected.folders.length} pasta(s)`}</Text></View>}
      </>}
      renderItem={({ item }) => {
        if (isGalleryAsset(item)) return <AssetCard asset={item} onPress={() => setSelectedAsset(item)} />;
        if (isGalleryFolder(item)) return <FolderCard folder={item} onPress={() => setSelectedFolderKey(item.key)} />;
        return <InspectionCard record={item.record} inspection={item.item} count={item.assetCount} onPress={() => openInspection(item.record.id)} />;
      }}
      ListEmptyComponent={<View style={styles.empty}><IconSymbol name="photo.fill" size={30} color="#93A79A" /><Text style={styles.emptyTitle}>{folder ? "Nenhuma foto nesta pasta" : selected ? "Nenhuma pasta com mídia" : "Nenhuma vistoria com fotos"}</Text><Text style={styles.emptyText}>As imagens aparecem aqui depois que a vistoria for sincronizada.</Text></View>}
    />
    <Modal visible={Boolean(selectedAsset)} transparent animationType="fade" onRequestClose={() => setSelectedAsset(null)}><Pressable style={styles.modalBackdrop} onPress={() => setSelectedAsset(null)}><Pressable style={styles.viewer} onPress={(event) => event.stopPropagation()}><View style={styles.viewerHeader}><View><Text style={styles.viewerTitle}>{selectedAsset?.title}</Text><Text style={styles.viewerSubtitle}>{selectedAsset?.subtitle}</Text></View><Pressable onPress={() => setSelectedAsset(null)} style={styles.close}><Text style={styles.closeText}>Fechar</Text></Pressable></View>{selectedAsset ? <Image source={{ uri: selectedAsset.uri }} style={styles.fullImage} resizeMode="contain" /> : null}</Pressable></Pressable></Modal>
  </ScreenContainer>;
}

function InspectionCard({ record, inspection, count, onPress }: { record: GalleryInspection; inspection: Inspection; count: number; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.inspectionCard, pressed && styles.pressed]}><View style={styles.folderIcon}><IconSymbol name="folder.fill" size={25} color="#C98525" /></View><View style={styles.cardCopy}><Text style={styles.code}>{record.sequentialCode}</Text><Text style={styles.address}>{record.propertyAddress}</Text><Text style={styles.meta}>{inspection.property.propertyType} · {count} arquivo(s)</Text><Text style={styles.inspector}>Vistoriador: {inspection.inspectorName || "Não informado"}</Text></View><IconSymbol name="chevron.right" size={20} color="#738078" /></Pressable>; }
function FolderCard({ folder, onPress }: { folder: GalleryFolder; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.folderCard, pressed && styles.pressed]}><View style={styles.folderIcon}><IconSymbol name="folder.fill" size={28} color="#C98525" /></View><Text style={styles.folderTitle}>{folder.label}</Text><Text style={styles.folderDescription}>{folder.description}</Text><Text style={styles.folderCount}>{folder.assets.length} arquivo(s)</Text></Pressable>; }
function AssetCard({ asset, onPress }: { asset: GalleryAsset; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.assetCard, pressed && styles.pressed]}><Image source={{ uri: asset.uri }} style={styles.thumbnail} resizeMode="cover" /><Text numberOfLines={1} style={styles.assetTitle}>{asset.title}</Text><Text numberOfLines={1} style={styles.assetSubtitle}>{asset.subtitle}</Text></Pressable>; }
function Center({ text }: { text: string }) { return <ScreenContainer style={styles.center}><ActivityIndicator color="#2E7D62" /><Text style={styles.centerText}>{text}</Text></ScreenContainer>; }
function Access({ title, text, action, onPress }: { title: string; text: string; action: string; onPress: () => void }) { return <ScreenContainer style={styles.center}><View style={styles.access}><IconSymbol name="shield.fill" size={28} color="#2E7D62" /><Text style={styles.accessTitle}>{title}</Text><Text style={styles.accessText}>{text}</Text><Pressable onPress={onPress} style={styles.accessButton}><Text style={styles.accessButtonText}>{action}</Text></Pressable></View></ScreenContainer>; }

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7F8F4" }, content: { width: "100%", maxWidth: 1120, alignSelf: "center", padding: 22, paddingBottom: 60 }, center: { backgroundColor: "#F7F8F4", alignItems: "center", justifyContent: "center" }, centerText: { color: "#738078", marginTop: 9 }, header: { flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 18 }, headerIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: "#2E7D62", alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1 }, eyebrow: { color: "#2E7D62", fontSize: 9, fontWeight: "800", letterSpacing: 1.3 }, title: { color: "#1D2924", fontSize: 28, fontWeight: "800", marginTop: 4 }, subtitle: { color: "#738078", fontSize: 12, lineHeight: 18, marginTop: 4 }, breadcrumb: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 13 }, breadcrumbText: { color: "#738078", fontSize: 11, fontWeight: "700" }, breadcrumbActive: { color: "#2E7D62" }, breadcrumbSeparator: { color: "#B0BBB3", fontSize: 16 }, searchBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D8E1DB", borderRadius: 11, backgroundColor: "#fff", paddingHorizontal: 12, marginBottom: 18 }, search: { flex: 1, minHeight: 44, paddingHorizontal: 9, color: "#1D2924" }, contextBar: { backgroundColor: "#203C31", borderRadius: 13, padding: 14, marginBottom: 18 }, contextTitle: { color: "#fff", fontSize: 15, fontWeight: "800" }, contextSubtitle: { color: "#C4D7CD", fontSize: 11, marginTop: 3 }, inspectionCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 15, padding: 15, marginBottom: 10 }, cardCopy: { flex: 1 }, folderIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#FFF6E7", alignItems: "center", justifyContent: "center" }, code: { color: "#2E7D62", fontSize: 10, fontWeight: "800" }, address: { color: "#1D2924", fontSize: 15, fontWeight: "800", marginTop: 5 }, meta: { color: "#738078", fontSize: 10, marginTop: 3 }, inspector: { color: "#738078", fontSize: 10, marginTop: 7 }, folderCard: { flex: 1, minWidth: 220, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 15, padding: 16, marginBottom: 10 }, folderTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800", marginTop: 13 }, folderDescription: { color: "#738078", fontSize: 11, lineHeight: 16, marginTop: 4 }, folderCount: { color: "#2E7D62", fontSize: 10, fontWeight: "800", marginTop: 12 }, assetCard: { flex: 1, minWidth: 150, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 12, padding: 8, marginBottom: 10 }, photoRow: { gap: 10 }, thumbnail: { width: "100%", aspectRatio: 1.25, borderRadius: 8, backgroundColor: "#E8EEE9" }, assetTitle: { color: "#1D2924", fontSize: 11, fontWeight: "800", marginTop: 7 }, assetSubtitle: { color: "#738078", fontSize: 9, marginTop: 3 }, pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] }, empty: { backgroundColor: "#fff", borderRadius: 15, alignItems: "center", padding: 28, marginTop: 8 }, emptyTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800", marginTop: 9 }, emptyText: { color: "#738078", fontSize: 11, textAlign: "center", marginTop: 5 }, modalBackdrop: { flex: 1, backgroundColor: "rgba(16, 27, 21, 0.78)", alignItems: "center", justifyContent: "center", padding: 18 }, viewer: { width: "100%", maxWidth: 980, height: "88%", backgroundColor: "#fff", borderRadius: 16, padding: 14 }, viewerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }, viewerTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800" }, viewerSubtitle: { color: "#738078", fontSize: 10, marginTop: 3 }, close: { borderWidth: 1, borderColor: "#D9AAA5", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }, closeText: { color: "#A93D37", fontSize: 10, fontWeight: "800" }, fullImage: { flex: 1, width: "100%", backgroundColor: "#F0F3F0" }, access: { width: "90%", maxWidth: 400, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 18, padding: 24, alignItems: "center" }, accessTitle: { color: "#1D2924", fontSize: 18, fontWeight: "800", marginTop: 9 }, accessText: { color: "#738078", fontSize: 11, marginTop: 5, textAlign: "center" }, accessButton: { backgroundColor: "#2E7D62", borderRadius: 9, padding: 10, marginTop: 14 }, accessButtonText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
