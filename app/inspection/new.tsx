import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Polyline } from "react-native-svg";
import { ScreenContainer } from "@/components/screen-container";
import { ChoiceChip, Field, IconButton, PrimaryButton, SectionTitle, StatusPill } from "@/components/inspection-ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DrawingSurface } from "@/components/drawing-surface";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { uploadInspectionMedia } from "@/lib/inspection-sync";
import { persistMediaUri } from "@/lib/media-uri";
import { createInspection, emptyEnvironmentDetail, ENVIRONMENTS, EnvironmentDetail, Inspection, InspectionPhoto, PROPERTY_TYPES, saveInspection, VULNERABILITY_LEVELS, buildOpinion, markUpdated, vulnerabilityColor, vulnerabilityCopy, formatCoordinates, fromRemoteInspection, listInspections } from "@/lib/inspection-storage";
import { EXTERNAL_CHECKLIST, INTERNAL_CHECKLIST, NO_PATHOLOGY, toggleChecklistValue } from "@/lib/checklist-options";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export default function NewInspectionScreen() {
  const router = useRouter();
  const { id, serverId } = useLocalSearchParams<{ id?: string; serverId?: string }>();
  const colors = useColors();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const cloudCreate = trpc.inspections.create.useMutation();
  const cloudUpdate = trpc.inspections.update.useMutation();
  const cloudUpload = trpc.inspections.uploadMedia.useMutation();
  const remoteInspection = trpc.inspections.get.useQuery({ id: Number(serverId || 0) }, { enabled: isAuthenticated && Boolean(serverId), retry: false });
  const [item, setItem] = useState<Inspection>(() => createInspection());
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoChooser, setPhotoChooser] = useState<string | null>(null);
  const [cameraEnvironment, setCameraEnvironment] = useState<string | null>(null);
  const [projectChooser, setProjectChooser] = useState(false);
  const [projectCameraOpen, setProjectCameraOpen] = useState(false);
  const [entryPhotoChooser, setEntryPhotoChooser] = useState<number | null>(null);
  const [entryCameraAttempt, setEntryCameraAttempt] = useState<number | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const goPrevious = () => {
    if (step > 1) setStep((value) => (value - 1) as Step);
    else router.back();
  };

  useEffect(() => {
    if (!id) return;
    listInspections().then((items) => {
      const existing = items.find((value) => value.id === id);
      if (existing) setItem(existing);
    });
  }, [id]);
  useEffect(() => {
    if (remoteInspection.data) setItem(fromRemoteInspection(remoteInspection.data));
  }, [remoteInspection.data]);
  useEffect(() => {
    if (user && !item.inspectorName) {
      setItem((current) => ({ ...current, inspectorName: user.name?.trim() || user.email || "Não informado" }));
    }
  }, [user]);
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace("/login");
    const editing = Boolean(id || serverId);
    const allowed = user?.role === "admin" || (editing ? user?.permissions?.editInspections : user?.permissions?.createInspections);
    if (!authLoading && isAuthenticated && !allowed) router.replace("/");
  }, [authLoading, id, isAuthenticated, router, serverId, user]);

  const setProperty = (key: keyof Inspection["property"], value: string) => setItem((current) => ({ ...current, property: { ...current.property, [key]: value } }));
  const setQuestion = (key: keyof Inspection["questionnaire"], value: string) => setItem((current) => ({ ...current, questionnaire: { ...current.questionnaire, [key]: value } }));
  const progress = useMemo(() => Math.round((step / 8) * 100), [step]);

  const captureLocation = async () => {
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Localização necessária", "Permita o acesso à localização para georreferenciar o imóvel.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setItem((value) => ({ ...value, location: { latitude: current.coords.latitude, longitude: current.coords.longitude, accuracy: current.coords.accuracy ?? undefined, capturedAt: new Date().toISOString() } }));
    } catch {
      Alert.alert("Não foi possível obter o GPS", "Verifique se a localização do dispositivo está ativada e tente novamente.");
    } finally {
      setLocationLoading(false);
    }
  };

  const addPhoto = async (environment: string, source: "camera" | "gallery" = "gallery") => {
    setPhotoLoading(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "gallery") {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.82, allowsMultipleSelection: false });
      } else {
        result = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.82, exif: true });
      }
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const persistentUri = await persistMediaUri(asset.uri);
      const environmentPhotoCount = item.photos.filter((photo) => photo.environment === environment).length;
      const photo: InspectionPhoto = { id: `photo-${Date.now()}`, uri: persistentUri, caption: `${environment} · Foto ${String(environmentPhotoCount + 1).padStart(2, "0")}`, environment, note: "", takenAt: new Date().toISOString(), latitude: item.location?.latitude, longitude: item.location?.longitude };
      const nextItem = { ...item, photos: [...item.photos, photo], updatedAt: new Date().toISOString() };
      setItem(nextItem);
      await saveInspection(nextItem);
    } catch {
      Alert.alert("Não foi possível anexar a foto", "Tente novamente ou use a biblioteca de imagens do aparelho.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const openCamera = async (environment: string) => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) { Alert.alert("Câmera necessária", "Permita o acesso à câmera para tirar a foto."); return; }
    setPhotoChooser(null);
    setCameraEnvironment(environment);
  };

  const takeCameraPhoto = async () => {
    if (!cameraRef.current || !cameraEnvironment) return;
    setPhotoLoading(true);
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.82, exif: true });
      if (!captured?.uri) return;
      const persistentUri = await persistMediaUri(captured.uri);
      setCameraEnvironment(null);
      const environmentPhotoCount = item.photos.filter((photo) => photo.environment === cameraEnvironment).length;
      const photo: InspectionPhoto = { id: `photo-${Date.now()}`, uri: persistentUri, caption: `${cameraEnvironment} · Foto ${String(environmentPhotoCount + 1).padStart(2, "0")}`, environment: cameraEnvironment, note: "", takenAt: new Date().toISOString(), latitude: item.location?.latitude, longitude: item.location?.longitude };
      const nextItem = { ...item, photos: [...item.photos, photo], updatedAt: new Date().toISOString() };
      setItem(nextItem);
      await saveInspection(nextItem);
    } catch { Alert.alert("Não foi possível tirar a foto", "Verifique a permissão da câmera e tente novamente."); } finally { setPhotoLoading(false); }
  };

  const chooseProjectImage = async () => {
    setProjectChooser(false);
    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.85 });
      if (result.canceled || !result.assets[0]) return;
      const projectDocumentUri = await persistMediaUri(result.assets[0].uri);
      const nextItem = { ...item, projectDocumentUri, updatedAt: new Date().toISOString() };
      setItem(nextItem);
      await saveInspection(nextItem);
    } catch {
      Alert.alert("Não foi possível anexar o projeto", "Tente novamente ou escolha outra imagem da galeria.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const openProjectCamera = async () => {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) { Alert.alert("Câmera necessária", "Permita o acesso à câmera para fotografar o projeto ou a planta."); return; }
    setProjectChooser(false);
    setProjectCameraOpen(true);
  };

  const takeProjectPhoto = async () => {
    if (!cameraRef.current) return;
    setPhotoLoading(true);
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.85, exif: true });
      if (!captured?.uri) return;
      const projectDocumentUri = await persistMediaUri(captured.uri);
      const nextItem = { ...item, projectDocumentUri, updatedAt: new Date().toISOString() };
      setProjectCameraOpen(false);
      setItem(nextItem);
      await saveInspection(nextItem);
    } catch {
      Alert.alert("Não foi possível fotografar o projeto", "Verifique a permissão da câmera e tente novamente.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const removeProjectDocument = () => setItem((current) => ({ ...current, projectDocumentUri: "", updatedAt: new Date().toISOString() }));

  const updateEntryAttempt = (index: number, patch: Partial<Inspection["entryAccess"]["attempts"][number]>) => setItem((current) => ({ ...current, entryAccess: { ...current.entryAccess, attempts: current.entryAccess.attempts.map((attempt, attemptIndex) => attemptIndex === index ? { ...attempt, ...patch } : attempt) }, updatedAt: new Date().toISOString() }));
  const chooseEntryAttemptImage = async () => {
    const index = entryPhotoChooser;
    setEntryPhotoChooser(null);
    if (index === null) return;
    setPhotoLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.82 });
      if (result.canceled || !result.assets[0]) return;
      const photoUri = await persistMediaUri(result.assets[0].uri);
      const nextItem = { ...item, entryAccess: { ...item.entryAccess, attempts: item.entryAccess.attempts.map((attempt, attemptIndex) => attemptIndex === index ? { ...attempt, photoUri } : attempt) }, updatedAt: new Date().toISOString() };
      setItem(nextItem);
      await saveInspection(nextItem);
    } catch {
      Alert.alert("Não foi possível anexar a foto", "Escolha outra imagem da galeria e tente novamente.");
    } finally {
      setPhotoLoading(false);
    }
  };
  const openEntryAttemptCamera = async () => {
    const index = entryPhotoChooser;
    if (index === null) return;
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!permission.granted) { Alert.alert("Câmera necessária", "Permita o acesso à câmera para registrar a tentativa de entrada."); return; }
    setEntryPhotoChooser(null);
    setEntryCameraAttempt(index);
  };
  const takeEntryAttemptPhoto = async () => {
    const index = entryCameraAttempt;
    if (!cameraRef.current || index === null) return;
    setPhotoLoading(true);
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.82, exif: true });
      if (!captured?.uri) return;
      const photoUri = await persistMediaUri(captured.uri);
      const nextItem = { ...item, entryAccess: { ...item.entryAccess, attempts: item.entryAccess.attempts.map((attempt, attemptIndex) => attemptIndex === index ? { ...attempt, photoUri } : attempt) }, updatedAt: new Date().toISOString() };
      setEntryCameraAttempt(null);
      setItem(nextItem);
      await saveInspection(nextItem);
    } catch {
      Alert.alert("Não foi possível tirar a foto", "Verifique a permissão da câmera e tente novamente.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const removePhoto = (id: string) => setItem((value) => ({ ...value, photos: value.photos.filter((photo) => photo.id !== id) }));
  const updatePhoto = (id: string, patch: Partial<InspectionPhoto>) => setItem((value) => ({ ...value, photos: value.photos.map((photo) => photo.id === id ? { ...photo, ...patch } : photo) }));

  const finish = async (status: "Em elaboração" | "Concluído") => {
    if (!item.property.address.trim()) {
      Alert.alert("Endereço obrigatório", "Informe o endereço do imóvel antes de salvar a vistoria.");
      setStep(1);
      return;
    }
    setSaving(true);
    let next = markUpdated({ ...item, status, inspectorName: item.inspectorName || user?.name?.trim() || user?.email || "Não informado", opinion: item.opinion || buildOpinion(item) });
    await saveInspection(next);
    if (isAuthenticated) {
      try {
        next = await uploadInspectionMedia(next, (input) => cloudUpload.mutateAsync(input));
        const remote = next.serverId
          ? await cloudUpdate.mutateAsync({ id: next.serverId, status, propertyAddress: next.property.address, propertyType: next.property.propertyType, payload: next })
          : await cloudCreate.mutateAsync({ status, propertyAddress: next.property.address, propertyType: next.property.propertyType, payload: next });
        if (!remote) throw new Error("Vistoria não encontrada no servidor");
        next = { ...next, serverId: remote.id, code: remote.sequentialCode, property: { ...next.property, sequentialCode: remote.sequentialCode } };
        await saveInspection(next);
      } catch {
        Alert.alert("Salvo no dispositivo", "A vistoria foi salva localmente, mas não foi possível sincronizá-la com o painel. Tente novamente quando houver conexão.");
      }
    }
    setSaving(false);
    router.replace(`/inspection/${next.id}`);
  };

  const goNext = () => {
    if (step === 1 && !item.property.address.trim()) {
      Alert.alert("Endereço obrigatório", "Informe pelo menos o endereço do imóvel para continuar.");
      return;
    }
    if (step === 5 && item.environments.length === 0) {
      Alert.alert("Selecione um ambiente", "Escolha pelo menos um ambiente vistoriado para abrir as fichas e adicionar as fotos.");
      return;
    }
    if (step < 8) setStep((value) => (value + 1) as Step);
    else finish("Concluído");
  };

  return <ScreenContainer edges={["top", "bottom", "left", "right"]} style={styles.screen}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topbar}><IconButton icon="chevron.left" label={step > 1 ? "Etapa anterior" : "Voltar"} onPress={goPrevious} color={colors.foreground} /><View style={styles.topbarCopy}><Text style={styles.topbarOverline}>NOVA VISTORIA</Text><Text style={styles.topbarTitle}>{item.code}</Text></View><StatusPill label={`${progress}%`} color="#2E7D62" /></View>
      <View style={styles.stepTrack}><View style={[styles.stepFill, { width: `${progress}%` }]} /></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {step === 1 ? <StepOne item={item} setProperty={setProperty} setItem={setItem} colors={colors} openEntryPhotoChooser={setEntryPhotoChooser} /> : null}
        {step === 2 ? <StepTwoLocation item={item} captureLocation={captureLocation} locationLoading={locationLoading} /> : null}
        {step === 3 ? <StepTwo item={item} setItem={setItem} /> : null}
        {step === 4 ? <StepThreeExternal item={item} setItem={setItem} addPhoto={addPhoto} openPhotoChooser={setPhotoChooser} photoLoading={photoLoading} removePhoto={removePhoto} updatePhoto={updatePhoto} /> : null}
        {step === 5 ? <StepThree item={item} setItem={setItem} colors={colors} addPhoto={addPhoto} openPhotoChooser={setPhotoChooser} photoLoading={photoLoading} removePhoto={removePhoto} updatePhoto={updatePhoto} /> : null}
        {step === 6 ? <StepFiveVulnerability item={item} setItem={setItem} /> : null}
        {step === 7 ? <StepSixOccupant item={item} setItem={setItem} openProjectChooser={() => setProjectChooser(true)} removeProjectDocument={removeProjectDocument} /> : null}
        {step === 8 ? <StepFour item={item} setItem={setItem} setQuestion={setQuestion} colors={colors} /> : null}
        <View style={styles.bottomActions}>{step > 1 ? <PrimaryButton label="Voltar" icon="chevron.left" onPress={goPrevious} variant="outline" disabled={saving || locationLoading || photoLoading} /> : null}<PrimaryButton label={step === 8 ? "Concluir vistoria" : "Continuar"} icon={step === 8 ? "checkmark.seal.fill" : "chevron.right"} onPress={goNext} disabled={saving || locationLoading || photoLoading} /><Pressable onPress={() => finish("Em elaboração")} style={({ pressed }) => [styles.draftButton, pressed && { opacity: 0.65 }]}><Text style={styles.draftText}>{saving ? "Salvando…" : "Salvar em elaboração"}</Text></Pressable></View>
      </ScrollView>
      <Modal visible={Boolean(photoChooser)} transparent animationType="fade" onRequestClose={() => setPhotoChooser(null)}><View style={styles.photoChooserBackdrop}><View style={styles.photoChooserCard}><Text style={styles.photoChooserTitle}>Adicionar foto</Text><Text style={styles.photoChooserText}>{photoChooser}</Text><PrimaryButton label="Tirar foto com a câmera" icon="camera.fill" onPress={() => photoChooser && openCamera(photoChooser)} /><PrimaryButton label="Escolher da galeria" icon="photo.fill" variant="soft" onPress={() => { const environment = photoChooser; setPhotoChooser(null); if (environment) addPhoto(environment, "gallery"); }} /><Pressable onPress={() => setPhotoChooser(null)} style={styles.photoChooserCancel}><Text style={styles.photoChooserCancelText}>Cancelar</Text></Pressable></View></View></Modal>
      <Modal visible={Boolean(cameraEnvironment)} animationType="slide" onRequestClose={() => setCameraEnvironment(null)}><View style={styles.cameraModal}><CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" /><View style={styles.cameraControls}><Pressable onPress={() => setCameraEnvironment(null)} style={styles.cameraSecondary}><Text style={styles.cameraSecondaryText}>Cancelar</Text></Pressable><Pressable onPress={takeCameraPhoto} style={styles.cameraShutter}><View style={styles.cameraShutterInner} /></Pressable><View style={styles.cameraSpacer} /></View></View></Modal>
      <Modal visible={projectChooser} transparent animationType="fade" onRequestClose={() => setProjectChooser(false)}><View style={styles.photoChooserBackdrop}><View style={styles.photoChooserCard}><Text style={styles.photoChooserTitle}>Adicionar projeto ou planta</Text><Text style={styles.photoChooserText}>Tire uma foto do documento ou escolha uma imagem da galeria.</Text><PrimaryButton label="Tirar foto com a câmera" icon="camera.fill" onPress={openProjectCamera} /><PrimaryButton label="Escolher da galeria" icon="photo.fill" variant="soft" onPress={chooseProjectImage} /><Pressable onPress={() => setProjectChooser(false)} style={styles.photoChooserCancel}><Text style={styles.photoChooserCancelText}>Cancelar</Text></Pressable></View></View></Modal>
      <Modal visible={projectCameraOpen} animationType="slide" onRequestClose={() => setProjectCameraOpen(false)}><View style={styles.cameraModal}><CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" /><View style={styles.cameraControls}><Pressable onPress={() => setProjectCameraOpen(false)} style={styles.cameraSecondary}><Text style={styles.cameraSecondaryText}>Cancelar</Text></Pressable><Pressable onPress={takeProjectPhoto} style={styles.cameraShutter}><View style={styles.cameraShutterInner} /></Pressable><View style={styles.cameraSpacer} /></View></View></Modal>
      <Modal visible={entryPhotoChooser !== null} transparent animationType="fade" onRequestClose={() => setEntryPhotoChooser(null)}><View style={styles.photoChooserBackdrop}><View style={styles.photoChooserCard}><Text style={styles.photoChooserTitle}>Foto da tentativa de entrada</Text><Text style={styles.photoChooserText}>Registre a porta ou o acesso no momento da tentativa.</Text><PrimaryButton label="Tirar foto com a câmera" icon="camera.fill" onPress={openEntryAttemptCamera} /><PrimaryButton label="Escolher da galeria" icon="photo.fill" variant="soft" onPress={chooseEntryAttemptImage} /><Pressable onPress={() => setEntryPhotoChooser(null)} style={styles.photoChooserCancel}><Text style={styles.photoChooserCancelText}>Cancelar</Text></Pressable></View></View></Modal>
      <Modal visible={entryCameraAttempt !== null} animationType="slide" onRequestClose={() => setEntryCameraAttempt(null)}><View style={styles.cameraModal}><CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" /><View style={styles.cameraControls}><Pressable onPress={() => setEntryCameraAttempt(null)} style={styles.cameraSecondary}><Text style={styles.cameraSecondaryText}>Cancelar</Text></Pressable><Pressable onPress={takeEntryAttemptPhoto} style={styles.cameraShutter}><View style={styles.cameraShutterInner} /></Pressable><View style={styles.cameraSpacer} /></View></View></Modal>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}

function StepOne({ item, setProperty, setItem, colors, openEntryPhotoChooser }: { item: Inspection; setProperty: (key: keyof Inspection["property"], value: string) => void; setItem: React.Dispatch<React.SetStateAction<Inspection>>; colors: any; openEntryPhotoChooser: (index: number) => void }) {
  const toggleInterference = (value: string) => setProperty("undergroundInterferences", item.property.undergroundInterferences.includes(value) ? item.property.undergroundInterferences.filter((entry) => entry !== value) as any : [...item.property.undergroundInterferences, value] as any);
  return <View><SectionTitle eyebrow="01 · ficha técnica de campo" title="Dados do imóvel" detail="Preencha a obra, a data, o código sequencial e os dados cadastrais conforme o modelo." />
    <Field label="OBRA" value={item.property.workName} onChangeText={(value) => setProperty("workName", value)} placeholder="Nome ou identificação da obra" />
    <View style={styles.row}><View style={styles.flexField}><Field label="DATA DA VISTORIA" value={item.property.inspectionDate} onChangeText={(value) => setProperty("inspectionDate", value)} placeholder="AAAA-MM-DD" /></View><View style={styles.flexField}><Field label="CÓDIGO SEQUENCIAL" value={item.property.sequentialCode} onChangeText={(value) => setProperty("sequentialCode", value)} placeholder="Ex.: 001" /></View></View>
    <View style={styles.row}><View style={styles.flexField}><Field label="ENDEREÇO *" value={item.property.address} onChangeText={(value) => setProperty("address", value)} placeholder="Rua, avenida ou logradouro" /></View><View style={styles.smallField}><Field label="Nº" value={item.property.number} onChangeText={(value) => setProperty("number", value)} placeholder="Nº" keyboardType="numeric" /></View></View>
    <View style={styles.row}><View style={styles.flexField}><Field label="BAIRRO" value={item.property.neighborhood} onChangeText={(value) => setProperty("neighborhood", value)} placeholder="Bairro" /></View><View style={styles.flexField}><Field label="CEP" value={item.property.cep} onChangeText={(value) => setProperty("cep", value)} placeholder="00000-000" keyboardType="numeric" /></View></View>
    <Field label="COMPL." value={item.property.complement} onChangeText={(value) => setProperty("complement", value)} placeholder="Complemento" />
    <EntryAccessBlock item={item} setItem={setItem} openEntryPhotoChooser={openEntryPhotoChooser} />
    <OptionGroup label="TIPO DE OCUPAÇÃO" value={item.property.occupancyType} options={["Residencial", "Comercial", "Misto", "Religioso", "Industrial", "Público", "Institucional", "Outras"]} onChange={(value) => setProperty("occupancyType", value)} />
    {item.property.occupancyType === "Outras" ? <Field label="DESCREVA OUTRA OCUPAÇÃO" value={item.property.occupancy} onChangeText={(value) => setProperty("occupancy", value)} placeholder="Informe o tipo de ocupação" /> : null}
    <Field label="NOME OFICIAL OU FANTASIA DO ESTABELECIMENTO" value={item.property.establishmentName} onChangeText={(value) => setProperty("establishmentName", value)} placeholder="Nome do estabelecimento" />
    <View style={styles.row}><View style={styles.flexField}><OptionGroup label="GARAGEM" value={item.property.garagePossession} options={["Possui", "Não possui"]} onChange={(value) => setProperty("garagePossession", value)} /></View><View style={styles.flexField}><OptionGroup label="NÚMERO DE VAGAS" value={item.property.garageSpaces} options={["1 vaga", "2 vagas", "3 ou mais"]} onChange={(value) => setProperty("garageSpaces", value)} /></View></View>
    <Text style={styles.inlineLabel}>INTERFERÊNCIAS SUBTERRÂNEAS</Text><Text style={styles.helper}>Marque todas as opções identificadas ou declaradas durante a vistoria.</Text><View style={styles.chips}>{["Reservatório enterrado", "Fossa séptica", "Poço normal", "Cisterna", "Poço artesiano", "Mina de água", "Sondagens ou furos diversos", "Não sabe", "Outros"].map((value) => <ChoiceChip key={value} label={value} selected={item.property.undergroundInterferences.includes(value)} onPress={() => toggleInterference(value)} />)}</View>
    {item.property.undergroundInterferences.includes("Poço normal") ? <Field label="PROFUNDIDADE DO POÇO NORMAL (m)" value={item.property.normalWellDepth} onChangeText={(value) => setProperty("normalWellDepth", value)} placeholder="Ex.: 12" keyboardType="numeric" /> : null}
    {item.property.undergroundInterferences.includes("Poço artesiano") ? <Field label="PROFUNDIDADE DO POÇO ARTESIANO (m)" value={item.property.artesianWellDepth} onChangeText={(value) => setProperty("artesianWellDepth", value)} placeholder="Ex.: 80" keyboardType="numeric" /> : null}
    {item.property.undergroundInterferences.includes("Outros") ? <Field label="DESCREVA OUTRA INTERFERÊNCIA" value={item.property.undergroundOther} onChangeText={(value) => setProperty("undergroundOther", value)} placeholder="Informe a interferência" /> : null}
    <OptionGroup label="IDADE APROXIMADA DO IMÓVEL" value={item.property.approximateAge} options={["Até 5 anos", "Entre 5 e 10 anos", "Entre 10 e 20 anos", "Mais de 20 anos", "Não sabe"]} onChange={(value) => setProperty("approximateAge", value)} />
    <OptionGroup label="IDADE APROXIMADA DA ÚLTIMA REFORMA" value={item.property.lastRenovationAge} options={["Não reformado", "Até 10 anos", "Mais de 10 anos", "Não sabe"]} onChange={(value) => setProperty("lastRenovationAge", value)} />
    <OptionGroup label="TIPO DE EDIFICAÇÃO" value={item.property.buildingType} options={["Edificação térrea", "Sobrado", "Edifício", "Galpão", "Outros"]} onChange={(value) => setProperty("buildingType", value)} />
    <OptionGroup label="SITUAÇÃO" value={item.property.situation} options={["Meio de quadra", "Esquina"]} onChange={(value) => setProperty("situation", value)} />
    <OptionGroup label="PAVIMENTOS DO IMÓVEL" value={item.property.propertyFloors} options={["1", "2", "3", "Outros"]} onChange={(value) => setProperty("propertyFloors", value)} otherNumber={item.property.propertyFloors === "Outros" ? item.property.propertyFloorsOther : ""} onOtherNumberChange={(value) => setProperty("propertyFloorsOther", value)} />
    <OptionGroup label="SUBSOLOS" value={item.property.basements} options={["Não tem", "1", "2", "3", "Mais do que 3 subsolos"]} onChange={(value) => setProperty("basements", value)} />
    <OptionGroup label="TOTAL DE PAVIMENTOS DA EDIFICAÇÃO" value={item.property.totalBuildingFloors} options={["1", "2", "3", "Outros"]} onChange={(value) => setProperty("totalBuildingFloors", value)} otherNumber={item.property.totalBuildingFloors === "Outros" ? item.property.totalBuildingFloorsOther : ""} onOtherNumberChange={(value) => setProperty("totalBuildingFloorsOther", value)} />
    <Field label="OUTRAS INFORMAÇÕES FORNECIDAS DURANTE A VISTORIA" value={item.property.additionalInformation} onChangeText={(value) => setProperty("additionalInformation", value)} placeholder="1.\n2." multiline />
  </View>;
}

function OptionGroup({ label, value, options, onChange, otherNumber, onOtherNumberChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; otherNumber?: string; onOtherNumberChange?: (value: string) => void }) {
  return <View style={styles.optionGroup}><Text style={styles.inlineLabel}>{label}</Text><View style={styles.chips}>{options.map((option) => <ChoiceChip key={option} label={option} selected={value === option} onPress={() => onChange(option)} />)}</View>{value === "Outros" && onOtherNumberChange ? <Field label="Informe o número" value={otherNumber} onChangeText={onOtherNumberChange} placeholder="Digite a quantidade" keyboardType="numeric" /> : null}</View>;
}

function SketchPad({ item, setItem }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>> }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>(item.sketch.strokes);
  const chooseImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const uri = await persistMediaUri(result.assets[0].uri);
      setItem((current) => ({ ...current, sketch: { mode: "image", uri, strokes: [] } }));
    }
  };
  const open = () => { setDraft(item.sketch.strokes); setVisible(true); };
  const save = () => { setItem((current) => ({ ...current, sketch: { mode: draft.length ? "draw" : current.sketch.mode, uri: draft.length ? "" : current.sketch.uri, strokes: draft } })); setVisible(false); };
  return <View><Text style={styles.inlineLabel}>CROQUI DA PLANTA DO IMÓVEL</Text><Text style={styles.helper}>Abra a janela para desenhar com mais precisão, escolher uma imagem ou limpar o croqui.</Text><Pressable onPress={open} style={({ pressed }) => [styles.sketchSummary, pressed && { opacity: 0.72 }]}><IconSymbol name="pencil" size={25} color="#2E7D62" /><View style={styles.sketchSummaryCopy}><Text style={styles.sketchSummaryTitle}>{item.sketch.strokes.length ? "Croqui desenhado" : item.sketch.uri ? "Imagem do croqui anexada" : "Abrir área de croqui"}</Text><Text style={styles.sketchSummaryText}>Toque para abrir a janela de desenho</Text></View><IconSymbol name="chevron.right" size={20} color="#2E7D62" /></Pressable><Pressable onPress={chooseImage} style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.7 }]}><IconSymbol name="photo.fill" size={18} color="#2E7D62" /><Text style={styles.secondaryActionText}>Escolher imagem da galeria</Text></Pressable><DrawingModal visible={visible} title="Croqui da planta do imóvel" points={draft} onPointsChange={setDraft} onSave={save} onClose={() => setVisible(false)} onClear={() => setDraft([])} imageUri={item.sketch.mode === "image" ? item.sketch.uri : ""} onChooseImage={chooseImage} /></View>;
}

function StepTwoLocation({ item, captureLocation, locationLoading }: { item: Inspection; captureLocation: () => void; locationLoading: boolean }) {
  return <View><SectionTitle eyebrow="02 · localização do imóvel" title="Localização do imóvel" detail="Registre a posição por GPS. As coordenadas ficarão vinculadas à vistoria." /><View style={styles.locationCard}><View style={styles.locationIcon}><IconSymbol name="location.fill" size={24} color="#2E7D62" /></View><View style={styles.locationCopy}><Text style={styles.locationTitle}>{item.location ? "Ponto georreferenciado" : "GPS ainda não registrado"}</Text><Text style={styles.locationValue}>{item.location ? formatCoordinates(item.location) : "A precisão depende do sinal disponível no local."}</Text>{item.location?.accuracy ? <Text style={styles.locationAccuracy}>Precisão aproximada de {Math.round(item.location.accuracy)} m</Text> : null}</View></View><PrimaryButton label={locationLoading ? "Capturando localização…" : item.location ? "Atualizar localização" : "Registrar localização"} icon="location.fill" onPress={captureLocation} disabled={locationLoading} /><Text style={styles.helper}>A coordenada ficará vinculada à vistoria e será exibida no relatório.</Text></View>;
}

function StepTwo({ item, setItem }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>> }) {
  const [customEnvironment, setCustomEnvironment] = useState("");
  const availableEnvironments = Array.from(new Set([...ENVIRONMENTS, ...item.environments.filter((environment) => !ENVIRONMENTS.includes(environment))]));
  const addCustomEnvironment = () => {
    const name = customEnvironment.trim();
    if (!name) return;
    if (item.environments.some((environment) => environment.toLowerCase() === name.toLowerCase())) {
      Alert.alert("Ambiente já adicionado", "Escolha outro nome ou abra a ficha do ambiente já selecionado.");
      return;
    }
    setItem((current) => ({ ...current, environments: [...current.environments, name], environmentDetails: { ...current.environmentDetails, [name]: emptyEnvironmentDetail() } }));
    setCustomEnvironment("");
  };
  return <View><SectionTitle eyebrow="03 · croqui da planta" title="Croqui da planta do imóvel" detail="Desenhe o croqui, fotografe um desenho existente ou escolha uma imagem." /><SketchPad item={item} setItem={setItem} />
    <Text style={[styles.inlineLabel, { marginTop: 28 }]}>AMBIENTES VISTORIADOS</Text><Text style={styles.helper}>Selecione as áreas com acesso permitido ou cadastre outros tipos de ambiente.</Text><View style={styles.chips}>{availableEnvironments.map((environment) => <ChoiceChip key={environment} label={environment} selected={item.environments.includes(environment)} onPress={() => setItem((current) => ({ ...current, environments: current.environments.includes(environment) ? current.environments.filter((value) => value !== environment) : [...current.environments, environment], environmentDetails: current.environmentDetails[environment] ? current.environmentDetails : { ...current.environmentDetails, [environment]: emptyEnvironmentDetail() } }))} />)}</View>
    <View style={styles.customEnvironmentBox}><Field label="Adicionar outro ambiente" value={customEnvironment} onChangeText={setCustomEnvironment} placeholder="Ex.: Quarto 2, corredor, área técnica…" returnKeyType="done" onSubmitEditing={addCustomEnvironment} /><PrimaryButton label="Adicionar ambiente" icon="plus.circle.fill" onPress={addCustomEnvironment} variant="soft" disabled={!customEnvironment.trim()} /></View>
    <Field label="Metodologia / observações de acesso" value={item.methodNotes} onChangeText={(value) => setItem((current) => ({ ...current, methodNotes: value }))} placeholder="Registre limitações de acesso ou observações da vistoria." multiline />
  </View>;
}

function ChecklistSelector({ title, groups, values, onToggle }: { title: string; groups: { material: string[]; pathology: string[] }; values?: { material: string[]; pathology: string[] }; onToggle: (group: "material" | "pathology", value: string) => void }) {
  return <View style={styles.checklistCard}><Text style={styles.checklistTitle}>{title}</Text><View style={styles.checklistColumns}><View style={styles.checklistColumn}><Text style={styles.checklistLabel}>MATERIAL</Text>{groups.material.map((value) => <ChoiceChip key={`material-${value}`} label={value} selected={values?.material.includes(value) ?? false} onPress={() => onToggle("material", value)} />)}</View><View style={styles.checklistColumn}><Text style={styles.checklistLabel}>PATOLOGIA</Text>{groups.pathology.map((value) => <ChoiceChip key={`pathology-${value}`} label={value} selected={values?.pathology.includes(value) ?? false} onPress={() => onToggle("pathology", value)} />)}</View></View></View>;
}

function StepFiveVulnerability({ item, setItem }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>> }) {
  const choose = (score: number) => setItem((current) => ({ ...current, vulnerabilityScore: score, vulnerabilityLevel: score >= 50 ? "Alta" : score >= 25 ? "Média" : "Baixa" }));
  const toggleInternal = (element: string, group: "material" | "pathology", value: string) => setItem((current) => {
    const existing = current.internalChecklist[element] ?? { material: [], pathology: [] };
    const values = group === "pathology" ? toggleChecklistValue(existing[group], value, NO_PATHOLOGY) : toggleChecklistValue(existing[group], value);
    return { ...current, internalChecklist: { ...current.internalChecklist, [element]: { ...existing, [group]: values } } };
  });
  return <View><SectionTitle eyebrow="05 · checklist interno" title="Checklist dos ambientes internos" detail="Selecione os materiais e as patologias observadas nos elementos construtivos internos." /><Text style={styles.checklistHint}>Você pode marcar mais de uma opção em cada coluna.</Text>{Object.entries(INTERNAL_CHECKLIST).map(([element, groups]) => <ChecklistSelector key={element} title={element} groups={groups} values={item.internalChecklist[element]} onToggle={(group, value) => toggleInternal(element, group, value)} />)}<SectionTitle eyebrow="06 · índice de vulnerabilidade" title="Índice de vulnerabilidade" detail="Avalie os principais fatores da edificação. A pontuação é um apoio à análise técnica e deve ser revisada pelo responsável." /><OptionGroup label="COMPORTAMENTO ESTRUTURAL DO IMÓVEL" value={item.vulnerabilityScore >= 25 ? "Relevante" : "Sem destaque"} options={["Sem destaque", "Relevante"]} onChange={(value) => choose(value === "Relevante" ? 25 : 0)} /><OptionGroup label="ORIENTAÇÃO E POSIÇÃO DO IMÓVEL" value={item.vulnerabilityScore >= 40 ? "Desfavorável" : "Favorável"} options={["Favorável", "Desfavorável"]} onChange={(value) => choose((value === "Desfavorável" ? 15 : 0) + (item.vulnerabilityScore >= 25 ? 25 : 0))} /><OptionGroup label="FUNCIONALIDADE DO IMÓVEL" value={item.vulnerabilityScore >= 50 ? "Sensível" : "Normal"} options={["Normal", "Sensível", "Reduzida"]} onChange={(value) => choose((value === "Sensível" ? 10 : value === "Reduzida" ? 0 : 5) + (item.vulnerabilityScore >= 40 ? 40 : item.vulnerabilityScore >= 25 ? 25 : 0))} /><OptionGroup label="CONSERVAÇÃO DO IMÓVEL" value={item.conservation || "Não avaliado"} options={["Boa", "Razoável", "Mau", "Não avaliado"]} onChange={(value) => setItem((current) => ({ ...current, conservation: value }))} /><View style={styles.scoreCard}><Text style={styles.scoreLabel}>ÍNDICE PRELIMINAR</Text><Text style={styles.scoreValue}>{item.vulnerabilityScore} pontos · {item.vulnerabilityLevel}</Text><Text style={styles.helper}>O índice final deve ser confirmado após a análise das evidências e do relatório.</Text></View></View>;
}

function SurveyChoice({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <OptionGroup label={label} value={value} options={["Sim", "Não"]} onChange={onChange} />; }

function EntryAccessBlock({ item, setItem, openEntryPhotoChooser }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>>; openEntryPhotoChooser: (index: number) => void }) {
  const setAttempt = (index: number, patch: Partial<Inspection["entryAccess"]["attempts"][number]>) => setItem((current) => ({ ...current, entryAccess: { ...current.entryAccess, attempts: current.entryAccess.attempts.map((attempt, attemptIndex) => attemptIndex === index ? { ...attempt, ...patch } : attempt) } }));
  return <View style={styles.entryAccessCard}><Text style={styles.entryAccessTitle}>AUTORIZAÇÃO DE ENTRADA</Text><Text style={styles.entryAccessHint}>Informe se a vistoria pôde ser realizada. Se a entrada não foi autorizada, registre até três tentativas com data, horário e foto.</Text><OptionGroup label="FOI POSSÍVEL REALIZAR A VISTORIA?" value={item.entryAccess.status} options={["Autorizada", "Não foi possível"]} onChange={(value) => setItem((current) => ({ ...current, entryAccess: { ...current.entryAccess, status: value } }))} />{item.entryAccess.status === "Não foi possível" ? <View style={styles.entryAttempts}>{item.entryAccess.attempts.map((attempt, index) => <View key={`entry-attempt-${index}`} style={styles.entryAttemptCard}><Text style={styles.entryAttemptTitle}>{index + 1}ª tentativa</Text><View style={styles.row}><View style={styles.flexField}><Field label="Data" value={attempt.date} onChangeText={(value) => setAttempt(index, { date: value })} placeholder="DD/MM/AAAA" /></View><View style={styles.flexField}><Field label="Horário" value={attempt.time} onChangeText={(value) => setAttempt(index, { time: value })} placeholder="HH:MM" /></View></View>{attempt.photoUri ? <><Image source={{ uri: attempt.photoUri }} style={styles.entryAttemptPhoto} /><Pressable onPress={() => setAttempt(index, { photoUri: "" })} style={styles.entryAttemptRemove}><Text style={styles.entryAttemptRemoveText}>Remover foto</Text></Pressable></> : <View style={styles.projectDocumentEmpty}><IconSymbol name="camera.fill" size={21} color="#91A099" /><Text style={styles.environmentPhotoEmptyText}>Nenhuma foto registrada.</Text></View>}<PrimaryButton label="Tirar foto ou escolher da galeria" icon="camera.fill" variant="soft" onPress={() => openEntryPhotoChooser(index)} /></View>)}</View> : null}</View>;
}

function StepSixOccupant({ item, setItem, openProjectChooser, removeProjectDocument }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>>; openProjectChooser: () => void; removeProjectDocument: () => void }) {
  const survey = item.occupantSurvey;
  const setSurvey = (key: string, value: string) => setItem((current) => ({ ...current, occupantSurvey: { ...current.occupantSurvey, [key]: value } }));
  const documentFields = [["IPTU", "Número do contribuinte"], ["Conta de Água e Esgoto", "Número da instalação ou hidrômetro"]];
  return <View>
    <SectionTitle eyebrow="06 · questionário" title="Questionário com o ocupante" detail="Registre as informações documentais, construtivas e as reclamações relatadas durante a vistoria." />
    {documentFields.map(([label, detail]) => <View key={label} style={styles.surveyCard}><SurveyChoice label={label} value={survey[`${label}-present`] || ""} onChange={(value) => setSurvey(`${label}-present`, value)} /><Field label={detail} value={survey[`${label}-number`] || ""} onChangeText={(value) => setSurvey(`${label}-number`, value)} placeholder="Informe se disponível" /><SurveyChoice label="É possível disponibilizar o documento para cópia?" value={survey[`${label}-copy`] || ""} onChange={(value) => setSurvey(`${label}-copy`, value)} /></View>)}
    <View style={styles.surveyCard}><Text style={styles.checklistTitle}>Projeto ou planta aprovada pela Prefeitura</Text><SurveyChoice label="O projeto ou planta está disponível?" value={survey["Projeto ou Planta aprovada pela Prefeitura-present"] || ""} onChange={(value) => setSurvey("Projeto ou Planta aprovada pela Prefeitura-present", value)} /><Field label="Número e data do documento" value={survey["Projeto ou Planta aprovada pela Prefeitura-number"] || ""} onChangeText={(value) => setSurvey("Projeto ou Planta aprovada pela Prefeitura-number", value)} placeholder="Informe se disponível" /><SurveyChoice label="É possível disponibilizar o documento para cópia?" value={survey["Projeto ou Planta aprovada pela Prefeitura-copy"] || ""} onChange={(value) => setSurvey("Projeto ou Planta aprovada pela Prefeitura-copy", value)} /><Text style={styles.helper}>Tire uma foto do documento ou escolha uma imagem da galeria.</Text>{item.projectDocumentUri ? <><Image source={{ uri: item.projectDocumentUri }} style={styles.projectDocumentPreview} /><Pressable onPress={removeProjectDocument} style={styles.projectDocumentRemove}><Text style={styles.projectDocumentRemoveText}>Remover imagem</Text></Pressable></> : <View style={styles.projectDocumentEmpty}><IconSymbol name="photo.fill" size={22} color="#91A099" /><Text style={styles.environmentPhotoEmptyText}>Nenhuma imagem anexada.</Text></View>}<PrimaryButton label="Fotografar ou escolher imagem" icon="camera.fill" variant="soft" onPress={openProjectChooser} /></View>
    <OptionGroup label="OS OCUPANTES DO IMÓVEL SÃO" value={survey.occupants || ""} options={["Proprietários", "Inquilinos", "Herdeiros"]} onChange={(value) => setSurvey("occupants", value)} />
    <Field label="ANO DE CONSTRUÇÃO (SE SOUBER)" value={survey.buildYear || ""} onChangeText={(value) => setSurvey("buildYear", value)} keyboardType="numeric" placeholder="Ano" />
    <OptionGroup label="O IMÓVEL FOI REFORMADO?" value={survey.renovated || ""} options={["Sim", "Não"]} onChange={(value) => setSurvey("renovated", value)} />
    {survey.renovated === "Sim" ? <View><Field label="QUANTAS VEZES FOI REFORMADO?" value={survey.renovationCount || ""} onChangeText={(value) => setSurvey("renovationCount", value)} keyboardType="numeric" /><Field label="ANO DA ÚLTIMA REFORMA" value={survey.lastRenovationYear || ""} onChangeText={(value) => setSurvey("lastRenovationYear", value)} keyboardType="numeric" /><Field label="ALTERAÇÕES REALIZADAS" value={survey.renovationChanges || ""} onChangeText={(value) => setSurvey("renovationChanges", value)} placeholder="Descreva as alterações, ampliações, trocas ou adequações realizadas." multiline /></View> : null}
    <OptionGroup label="SABE O TIPO DE FUNDAÇÃO?" value={survey.foundationKnown || ""} options={["Sim", "Não"]} onChange={(value) => setSurvey("foundationKnown", value)} />{survey.foundationKnown === "Sim" ? <OptionGroup label="TIPO DE FUNDAÇÃO" value={survey.foundationType || ""} options={["Direta", "Sapatas", "Estacas", "Brocas", "Tubulões", "Radier", "Outro"]} onChange={(value) => setSurvey("foundationType", value)} /> : null}
    <Field label="ANOMALIAS SIGNIFICATIVAS / RECLAMAÇÕES" value={survey.anomalies || ""} onChangeText={(value) => setSurvey("anomalies", value)} placeholder="Erosão, recalque, infiltrações, deslocamento de contenções ou outras" multiline /><Field label="PROJETOS DISPONÍVEIS" value={survey.projects || ""} onChangeText={(value) => setSurvey("projects", value)} placeholder="Arquitetura, estrutura, fundação, hidráulica, elétrica…" multiline /><Field label="RESPONSÁVEL PELAS INFORMAÇÕES — NOME / RG" value={survey.responsible || ""} onChangeText={(value) => setSurvey("responsible", value)} placeholder="Nome completo e RG" /><OptionGroup label="O OCUPANTE PREENCHEU E ENTREGOU O QUESTIONÁRIO?" value={survey.completed || ""} options={["Sim", "Parcialmente", "Não"]} onChange={(value) => setSurvey("completed", value)} />
  </View>;
}

function StepThreeExternal({ item, setItem, addPhoto, openPhotoChooser, photoLoading, removePhoto, updatePhoto }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>>; addPhoto: (environment: string) => void; openPhotoChooser: (environment: string) => void; photoLoading: boolean; removePhoto: (id: string) => void; updatePhoto: (id: string, patch: Partial<InspectionPhoto>) => void }) {
  const toggle = (area: string, group: "material" | "pathology", value: string) => setItem((current) => { const existing = current.externalArea.items[area] ?? { material: [], pathology: [] }; const values = group === "pathology" ? toggleChecklistValue(existing[group], value, NO_PATHOLOGY) : toggleChecklistValue(existing[group], value); return { ...current, externalArea: { ...current.externalArea, enabled: true, items: { ...current.externalArea.items, [area]: { ...existing, [group]: values } } } }; });
  const externalPhotos = item.photos.filter((photo) => photo.environment === "Área externa");
  return <View><SectionTitle eyebrow="03 · área externa" title="Checklist da área externa" detail="A área externa é opcional. Se houver, marque os materiais e patologias observados." /><OptionGroup label="A ÁREA EXTERNA FOI VISTORIADA?" value={item.externalArea.enabled ? "Sim" : "Não"} options={["Sim", "Não"]} onChange={(value) => setItem((current) => ({ ...current, externalArea: { ...current.externalArea, enabled: value === "Sim" } }))} />{item.externalArea.enabled ? <View>{Object.entries(EXTERNAL_CHECKLIST).map(([area, groups]) => <View key={area} style={styles.externalCard}><Text style={styles.environmentTitle}>{area}</Text><Text style={styles.inlineLabel}>MATERIAL</Text><View style={styles.chips}>{groups.material.map((value) => <ChoiceChip key={value} label={value} selected={item.externalArea.items[area]?.material.includes(value)} onPress={() => toggle(area, "material", value)} />)}</View><Text style={styles.inlineLabel}>PATOLOGIA</Text><View style={styles.chips}>{groups.pathology.map((value) => <ChoiceChip key={value} label={value} selected={item.externalArea.items[area]?.pathology.includes(value)} onPress={() => toggle(area, "pathology", value)} />)}</View></View>)}<PrimaryButton label={photoLoading ? "Selecionando foto…" : "Adicionar foto da área externa"} icon="camera.fill" variant="soft" disabled={photoLoading} onPress={() => openPhotoChooser("Área externa")} />{externalPhotos.length ? <View style={styles.environmentPhotos}>{externalPhotos.map((photo, index) => <View key={photo.id} style={styles.photoCard}><Image source={{ uri: photo.uri }} style={styles.photo} /><View style={styles.photoInfo}><View style={styles.photoHeader}><Text style={styles.photoCaption}>Área externa · Foto {String(index + 1).padStart(2, "0")}</Text><Pressable onPress={() => removePhoto(photo.id)}><IconSymbol name="trash" size={18} color="#C2413B" /></Pressable></View><Field label="Legenda" value={photo.caption} onChangeText={(value) => updatePhoto(photo.id, { caption: value })} placeholder="Identificação da foto" /><Field label="Observação da foto" value={photo.note} onChangeText={(value) => updatePhoto(photo.id, { note: value })} placeholder="Descreva o registro" multiline /></View></View>)}</View> : <View style={styles.environmentPhotoEmpty}><IconSymbol name="photo.fill" size={22} color="#91A099" /><Text style={styles.environmentPhotoEmptyText}>Nenhuma foto da área externa.</Text></View>}<Field label="OBSERVAÇÕES" value={item.externalArea.observations} onChangeText={(value) => setItem((current) => ({ ...current, externalArea: { ...current.externalArea, observations: value } }))} placeholder="Registre observações da área externa" multiline /></View> : <View style={styles.emptyNotice}><Text style={styles.helper}>Nenhum checklist externo será incluído nesta vistoria.</Text></View>}</View>;
}

function StepThree({ item, setItem, colors, addPhoto, openPhotoChooser, photoLoading, removePhoto, updatePhoto }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>>; colors: any; addPhoto: (environment: string) => void; openPhotoChooser: (environment: string) => void; photoLoading: boolean; removePhoto: (id: string) => void; updatePhoto: (id: string, patch: Partial<InspectionPhoto>) => void }) {
  const [openEnvironment, setOpenEnvironment] = useState(item.environments[0] ?? "");
  const updateEnvironment = (environment: string, patch: Partial<EnvironmentDetail>) => {
    setItem((current) => ({
      ...current,
      environmentDetails: {
        ...current.environmentDetails,
        [environment]: { ...emptyEnvironmentDetail(), ...(current.environmentDetails?.[environment] ?? {}), ...patch },
      },
    }));
  };
  const toggleEnvironmentChecklist = (environment: string, element: string, group: "material" | "pathology", value: string) => {
    const current = item.environmentDetails?.[environment] ?? emptyEnvironmentDetail();
    const existing = current.checklist[element] ?? { material: [], pathology: [] };
    const values = group === "pathology" ? toggleChecklistValue(existing[group], value, NO_PATHOLOGY) : toggleChecklistValue(existing[group], value);
    updateEnvironment(environment, { checklist: { ...current.checklist, [element]: { ...existing, [group]: values } } });
  };

  return <View><SectionTitle eyebrow="03 · ambientes e evidências" title="Preencha cada ambiente" detail="Cada área possui observações próprias e aceita quantas fotos forem necessárias." />
    <View style={styles.photoAction}><View><Text style={styles.photoActionTitle}>{item.environments.length} ambiente(s) aberto(s)</Text><Text style={styles.photoActionSubtitle}>{item.photos.length ? `${item.photos.length} foto(s) no total` : "Adicione fotos dentro de cada ambiente"}</Text></View><View style={styles.photoActionIcon}><IconSymbol name="camera.fill" size={21} color="#FFFFFF" /></View></View>
    {photoLoading ? <View style={styles.loadingLine}><Text style={styles.helper}>Abrindo câmera e preparando a foto…</Text></View> : null}

    <Text style={styles.environmentOpenHint}>Toque em um ambiente para abrir a ficha individual.</Text>
    <View style={styles.environmentList}>
      {item.environments.map((environment, environmentIndex) => {
        const detail = item.environmentDetails?.[environment] ?? emptyEnvironmentDetail();
        const environmentPhotos = item.photos.filter((photo) => photo.environment === environment);
        const isOpen = openEnvironment === environment;
        return <View key={environment} style={[styles.environmentCard, isOpen && styles.environmentCardOpen]}>
          <Pressable onPress={() => setOpenEnvironment(isOpen ? "" : environment)} style={({ pressed }) => [styles.environmentHeader, pressed && { opacity: 0.72 }]}>
            <View style={styles.environmentTitleGroup}><View style={styles.environmentNumber}><Text style={styles.environmentNumberText}>{String(environmentIndex + 1).padStart(2, "0")}</Text></View><View><Text style={styles.environmentTitle}>{environment}</Text><Text style={styles.environmentMeta}>{environmentPhotos.length} {environmentPhotos.length === 1 ? "foto registrada" : "fotos registradas"}</Text></View></View>
            <View style={styles.environmentOpenAction}><Text style={styles.environmentOpenActionText}>{isOpen ? "Fechar" : "Abrir ficha"}</Text><IconSymbol name="chevron.right" size={18} color="#2E7D62" style={isOpen ? styles.environmentChevronOpen : undefined} /></View>
          </Pressable>

          {isOpen ? <View>
            <Text style={styles.checklistHint}>Marque uma ou mais opções observadas no ambiente. Os campos ficam separados entre material e patologia.</Text>
            {Object.entries(INTERNAL_CHECKLIST).map(([element, groups]) => <ChecklistSelector key={element} title={element} groups={groups} values={detail.checklist[element]} onToggle={(group, value) => toggleEnvironmentChecklist(environment, element, group, value)} />)}
            <Field label="INSTALAÇÕES ELÉTRICAS" value={detail.electricalInstallations} onChangeText={(value) => updateEnvironment(environment, { electricalInstallations: value })} placeholder="Descreva o padrão, quadro, tomadas, fiação ou anomalias observadas." multiline />
            <Field label="INSTALAÇÕES HIDRÁULICAS" value={detail.hydraulicInstallations} onChangeText={(value) => updateEnvironment(environment, { hydraulicInstallations: value })} placeholder="Descreva tubulações, pontos hidráulicos, vazamentos ou anomalias observadas." multiline />
            <Field label="OBSERVAÇÕES" value={detail.observations} onChangeText={(value) => updateEnvironment(environment, { observations: value })} placeholder={`Descreva o estado geral de ${environment.toLowerCase()}.`} multiline />
            <Field label="Acabamentos observados" value={detail.finishes} onChangeText={(value) => updateEnvironment(environment, { finishes: value })} placeholder="Pisos, revestimentos, esquadrias, pintura…" multiline />
            <Field label="Patologias / anomalias visíveis" value={detail.pathologies} onChangeText={(value) => updateEnvironment(environment, { pathologies: value })} placeholder="Trincas, fissuras, umidade, desplacamento…" multiline />

            <View style={styles.environmentPhotoHeader}><View><Text style={styles.environmentPhotoTitle}>Fotos de {environment}</Text><Text style={styles.environmentPhotoHint}>Você pode tirar várias fotos neste ambiente.</Text></View></View>
            <PrimaryButton label={photoLoading ? "Selecionando foto…" : `Adicionar foto em ${environment}`} icon="camera.fill" onPress={() => openPhotoChooser(environment)} variant="soft" disabled={photoLoading} />

            {environmentPhotos.length ? <View style={styles.environmentPhotos}>{environmentPhotos.map((photo, photoIndex) => <View key={photo.id} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <View style={styles.photoInfo}>
                <View style={styles.photoHeader}><Text style={styles.photoCaption}>{environment} · Foto {String(photoIndex + 1).padStart(2, "0")}</Text><Pressable onPress={() => removePhoto(photo.id)} style={({ pressed }) => pressed && { opacity: 0.55 }}><IconSymbol name="trash" size={18} color="#C2413B" /></Pressable></View>
                <Field label="Legenda" value={photo.caption} onChangeText={(value) => updatePhoto(photo.id, { caption: value })} placeholder="Identificação da foto" />
                <Field label="Observação da foto" value={photo.note} onChangeText={(value) => updatePhoto(photo.id, { note: value })} placeholder="Ex.: fissura horizontal junto à janela" multiline />
              </View>
            </View>)}</View> : <View style={styles.environmentPhotoEmpty}><IconSymbol name="photo.fill" size={22} color="#91A099" /><Text style={styles.environmentPhotoEmptyText}>Nenhuma foto neste ambiente.</Text></View>}
          </View> : null}
        </View>;
      })}
    </View>

    <Text style={styles.inlineLabel}>ÍNDICE DE VULNERABILIDADE · CLASSIFICAÇÃO PRELIMINAR</Text><View style={styles.riskRow}>{VULNERABILITY_LEVELS.map((level) => <ChoiceChip key={level} label={level} selected={item.vulnerabilityLevel === level} color={vulnerabilityColor(level)} onPress={() => setItem((current) => ({ ...current, vulnerabilityLevel: level }))} />)}</View><Text style={[styles.riskCopy, { color: vulnerabilityColor(item.vulnerabilityLevel) }]}>{vulnerabilityCopy(item.vulnerabilityLevel)}</Text>
  </View>;
}

function DrawingModal({ visible, title, points, onPointsChange, onSave, onClose, onClear, imageUri, onChooseImage }: { visible: boolean; title: string; points: string[]; onPointsChange: (points: string[]) => void; onSave: () => void; onClose: () => void; onClear: () => void; imageUri?: string; onChooseImage?: () => void }) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><View style={styles.drawingModal}><View style={styles.drawingHeader}><View><Text style={styles.drawingEyebrow}>CAPTURA MANUSCRITA</Text><Text style={styles.drawingTitle}>{title}</Text></View><Pressable onPress={onClose} style={styles.drawingClose}><Text style={styles.drawingCloseText}>×</Text></Pressable></View><Text style={styles.drawingHint}>Use o dedo, mouse ou uma caneta. O traço é separado a cada novo toque.</Text><DrawingSurface points={points} onChange={onPointsChange} imageUri={imageUri} style={styles.drawingCanvas} /><View style={styles.drawingActions}><Pressable onPress={onClear} style={({ pressed }) => [styles.modalAction, styles.modalActionOutline, pressed && { opacity: 0.65 }]}><Text style={styles.modalActionOutlineText}>Limpar</Text></Pressable>{onChooseImage ? <Pressable onPress={onChooseImage} style={({ pressed }) => [styles.modalAction, styles.modalActionSoft, pressed && { opacity: 0.65 }]}><Text style={styles.modalActionSoftText}>Escolher imagem</Text></Pressable> : null}<Pressable onPress={onSave} style={({ pressed }) => [styles.modalAction, styles.modalActionPrimary, pressed && { opacity: 0.75 }]}><Text style={styles.modalActionPrimaryText}>Salvar</Text></Pressable></View></View></Modal>;
}

function SignaturePad({ title, value, onChange }: { title: string; value: string[]; onChange: (value: string[]) => void }) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const open = () => { setDraft(value); setVisible(true); };
  const save = () => { onChange(draft); setVisible(false); };
  return <View style={styles.signatureBlock}><Text style={styles.inlineLabel}>{title}</Text><Pressable onPress={open} style={({ pressed }) => [styles.signatureSummary, pressed && { opacity: 0.72 }]}><IconSymbol name="pencil" size={22} color="#2E7D62" /><View style={styles.sketchSummaryCopy}><Text style={styles.sketchSummaryTitle}>{value.length ? "Assinatura registrada" : "Abrir campo de assinatura"}</Text><Text style={styles.sketchSummaryText}>Toque para assinar em uma janela maior</Text></View><IconSymbol name="chevron.right" size={19} color="#2E7D62" /></Pressable><Pressable onPress={() => onChange([])} style={({ pressed }) => [styles.clearSignature, pressed && { opacity: 0.6 }]}><Text style={styles.clearSignatureText}>Limpar assinatura</Text></Pressable><DrawingModal visible={visible} title={title} points={draft} onPointsChange={setDraft} onSave={save} onClose={() => setVisible(false)} onClear={() => setDraft([])} /></View>;
}

function StepFour({ item, setItem, setQuestion, colors }: { item: Inspection; setItem: React.Dispatch<React.SetStateAction<Inspection>>; setQuestion: (key: keyof Inspection["questionnaire"], value: string) => void; colors: any }) {
  return <View><SectionTitle eyebrow="04 · ocupante e parecer" title="Feche a ficha de campo" detail="Registre as informações declaradas e deixe uma síntese para revisão técnica." />
    <OptionGroup label="ESTADO DE CONSERVAÇÃO" value={item.conservation} options={["Ótimo", "Bom", "Regular", "Ruim"]} onChange={(value) => setItem((current) => ({ ...current, conservation: value }))} />
    <OptionGroup label="PADRÃO CONSTRUTIVO" value={item.constructionStandard} options={["Alto", "Médio", "Baixo"]} onChange={(value) => setItem((current) => ({ ...current, constructionStandard: value }))} />
    <OptionGroup label="TIPO DE ESTRUTURA" value={item.structureType} options={["Concreto armado", "Metálica", "Alvenaria estrutural", "Madeira", "Mista: alvenaria com pilaretes e cintas"]} onChange={(value) => setItem((current) => ({ ...current, structureType: value }))} />
    <OptionGroup label="TIPO DE COBERTURA" value={item.roofType} options={["Telha de fibrocimento", "Telha metálica", "Telha cerâmica", "Telha sanduíche", "Laje impermeabilizada", "Laje"]} onChange={(value) => setItem((current) => ({ ...current, roofType: value }))} />
    <Field label="Nome do ocupante / acompanhante" value={item.questionnaire.occupantName} onChangeText={(value) => setQuestion("occupantName", value)} placeholder="Nome de quem acompanhou a vistoria" />
    <Field label="Houve obras anteriores no imóvel?" value={item.questionnaire.priorWorks} onChangeText={(value) => setQuestion("priorWorks", value)} placeholder="Descreva ou informe não" multiline />
    <Field label="Já havia trincas, fissuras ou danos?" value={item.questionnaire.priorCracks} onChangeText={(value) => setQuestion("priorCracks", value)} placeholder="Relato do ocupante" multiline />
    <Field label="Foi observada vibração ou ruído anormal?" value={item.questionnaire.observedVibration} onChangeText={(value) => setQuestion("observedVibration", value)} placeholder="Relato do ocupante" multiline />
    <Field label="Comentários adicionais" value={item.questionnaire.comments} onChangeText={(value) => setQuestion("comments", value)} placeholder="Outras informações relevantes" multiline />
    <SignaturePad title="ASSINATURA DO RESPONSÁVEL PELAS INFORMAÇÕES" value={item.signatures.responsible} onChange={(value) => setItem((current) => ({ ...current, signatures: { ...current.signatures, responsible: value } }))} />
    <SignaturePad title="ASSINATURA DO OCUPANTE" value={item.signatures.occupant} onChange={(value) => setItem((current) => ({ ...current, signatures: { ...current.signatures, occupant: value } }))} />
    <View style={styles.opinionBlock}><View style={styles.opinionHeader}><View><Text style={styles.inlineLabel}>PARECER PRELIMINAR</Text><Text style={styles.opinionHint}>Você poderá revisar este texto antes da emissão do relatório.</Text></View><IconSymbol name="checkmark.seal.fill" size={23} color="#2E7D62" /></View><Field label="Síntese técnica" value={item.opinion || buildOpinion(item)} onChangeText={(value) => setItem((current) => ({ ...current, opinion: value }))} placeholder="Parecer" multiline /></View>
    <View style={styles.readyCard}><IconSymbol name="info.circle.fill" size={18} color="#2E7D62" /><Text style={styles.readyText}>Ao concluir, a vistoria fica pronta para revisão e futura geração do relatório técnico no formato do modelo.</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F7F8F4" },
  flex: { flex: 1 },
  topbar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  topbarCopy: { flex: 1 },
  topbarOverline: { color: "#738078", fontSize: 10, letterSpacing: 1.1, fontWeight: "800" },
  topbarTitle: { color: "#1D2924", fontSize: 16, fontWeight: "800", marginTop: 2 },
  stepTrack: { height: 4, backgroundColor: "#E0E9E2", marginHorizontal: 20, borderRadius: 10, overflow: "hidden" },
  stepFill: { height: 4, backgroundColor: "#2E7D62", borderRadius: 10 },
  content: { padding: 20, paddingTop: 26, paddingBottom: 28 },
  row: { flexDirection: "row", gap: 10 },
  flexField: { flex: 1 },
  smallField: { width: 72 },
  inlineLabel: { color: "#56625B", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginBottom: 9 },
  optionGroup: { marginBottom: 6 },
  helper: { color: "#738078", fontSize: 12, lineHeight: 18, marginTop: -3, marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
  sketchPad: { height: 250, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 16, overflow: "hidden", marginBottom: 12 },
  sketchDot: { position: "absolute", width: 7, height: 7, borderRadius: 7, backgroundColor: "#2E7D62" },
  sketchImage: { position: "absolute", width: "100%", height: "100%", resizeMode: "contain" },
  sketchPlaceholder: { color: "#91A099", fontSize: 13, textAlign: "center", marginTop: 112 },
  externalCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 16, padding: 14, marginBottom: 12 },
  emptyNotice: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderStyle: "dashed", borderRadius: 15, padding: 16, marginBottom: 15 },
  scoreCard: { backgroundColor: "#E7F2EC", borderRadius: 16, padding: 16, marginTop: 10, marginBottom: 14 },
  scoreLabel: { color: "#527466", fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  scoreValue: { color: "#1D2924", fontSize: 20, fontWeight: "800", marginTop: 5, marginBottom: 3 },
  surveyCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 16, padding: 14, marginBottom: 12 },
  entryAccessCard: { backgroundColor: "#FFF9ED", borderWidth: 1, borderColor: "#EAD9AF", borderRadius: 16, padding: 14, marginBottom: 14 },
  entryAccessTitle: { color: "#8A6519", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 6 },
  entryAccessHint: { color: "#76684B", fontSize: 12, lineHeight: 18, marginBottom: 8 },
  entryAttempts: { gap: 10, marginTop: 4 },
  entryAttemptCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7DFC9", borderRadius: 13, padding: 12 },
  entryAttemptTitle: { color: "#314139", fontSize: 14, fontWeight: "800", marginBottom: 5 },
  entryAttemptPhoto: { width: "100%", height: 150, borderRadius: 10, backgroundColor: "#F1F5F2", resizeMode: "cover", marginBottom: 4 },
  entryAttemptRemove: { alignItems: "center", paddingVertical: 7 },
  entryAttemptRemoveText: { color: "#C2413B", fontSize: 12, fontWeight: "700" },
  projectDocumentPreview: { width: "100%", height: 190, borderRadius: 12, backgroundColor: "#F1F5F2", resizeMode: "contain", marginBottom: 9 },
  projectDocumentEmpty: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#DCE5DE", borderStyle: "dashed", borderRadius: 13, minHeight: 62, marginVertical: 11 },
  projectDocumentRemove: { alignItems: "center", paddingVertical: 8, marginBottom: 6 },
  projectDocumentRemoveText: { color: "#C2413B", fontSize: 12, fontWeight: "700" },
  customEnvironmentBox: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 16, padding: 14, marginBottom: 14 },
  bottomActions: { gap: 11, marginTop: 12 },
  draftButton: { alignItems: "center", paddingVertical: 11 },
  draftText: { color: "#738078", fontSize: 13, fontWeight: "700" },
  locationCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#E7F2EC", borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 17, padding: 16, marginBottom: 13 },
  locationIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  locationCopy: { flex: 1 },
  locationTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800" },
  locationValue: { color: "#527466", fontSize: 12, marginTop: 4, lineHeight: 18 },
  locationAccuracy: { color: "#2E7D62", fontSize: 11, fontWeight: "700", marginTop: 5 },
  photoAction: { backgroundColor: "#203C31", borderRadius: 17, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  photoActionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  photoActionSubtitle: { color: "#C4D7CD", fontSize: 12, marginTop: 3 },
  photoActionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#2E7D62", alignItems: "center", justifyContent: "center" },
  loadingLine: { paddingVertical: 8 },
  environmentList: { gap: 16, marginBottom: 24 },
  environmentCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 19, padding: 15 },
  environmentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#EEF2EF", paddingBottom: 13, marginBottom: 15 },
  environmentCardOpen: { borderColor: "#B9D7C8" },
  environmentOpenHint: { color: "#738078", fontSize: 12, marginBottom: 10 },
  environmentOpenAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  environmentOpenActionText: { color: "#2E7D62", fontSize: 11, fontWeight: "800" },
  environmentChevronOpen: { transform: [{ rotate: "90deg" }] },
  environmentTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  environmentNumber: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#E7F2EC", alignItems: "center", justifyContent: "center" },
  environmentNumberText: { color: "#2E7D62", fontSize: 11, fontWeight: "800" },
  environmentTitle: { color: "#1D2924", fontSize: 17, fontWeight: "800" },
  environmentMeta: { color: "#738078", fontSize: 11, marginTop: 2 },
  environmentPhotoHeader: { marginTop: 2, marginBottom: 10 },
  environmentPhotoTitle: { color: "#314139", fontSize: 13, fontWeight: "800" },
  environmentPhotoHint: { color: "#738078", fontSize: 11, marginTop: 3 },
  environmentPhotos: { gap: 11, marginTop: 13 },
  environmentPhotoEmpty: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#DCE5DE", borderStyle: "dashed", borderRadius: 13, minHeight: 62, marginTop: 11 },
  environmentPhotoEmptyText: { color: "#7C8981", fontSize: 11, fontWeight: "600" },
  photoEmpty: { borderWidth: 1, borderColor: "#D7E3D9", borderStyle: "dashed", backgroundColor: "#FFFFFF", borderRadius: 17, padding: 23, alignItems: "center", marginBottom: 18 },
  photoEmptyTitle: { color: "#1D2924", fontSize: 15, fontWeight: "800", marginTop: 9, marginBottom: 4 },
  photoGrid: { gap: 12, marginBottom: 18 },
  photoCard: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 17, overflow: "hidden" },
  photo: { width: "100%", height: 180, backgroundColor: "#E7EEE9" },
  photoInfo: { padding: 14 },
  photoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  photoCaption: { color: "#1D2924", fontSize: 14, fontWeight: "800" },
  riskRow: { flexDirection: "row", marginBottom: 6 },
  riskCopy: { fontSize: 12, fontWeight: "700", marginBottom: 18 },
  opinionBlock: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D9E8DD", borderRadius: 17, padding: 16, marginTop: 6 },
  opinionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 6 },
  opinionHint: { color: "#738078", fontSize: 11, lineHeight: 16, maxWidth: 260 },
  readyCard: { flexDirection: "row", gap: 9, backgroundColor: "#E7F2EC", padding: 14, borderRadius: 14, marginTop: 14 },
  readyText: { color: "#527466", fontSize: 12, lineHeight: 18, flex: 1 },
  signatureBlock: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E1E7E2", borderRadius: 16, padding: 14, marginBottom: 12 },
  signaturePad: { height: 120, backgroundColor: "#FCFDFC", borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 12, overflow: "hidden" },
  signatureDot: { position: "absolute", width: 5, height: 5, borderRadius: 5, backgroundColor: "#1D2924" },
  signaturePlaceholder: { color: "#91A099", textAlign: "center", marginTop: 52, fontSize: 12 },
  clearSignature: { alignSelf: "flex-end", paddingTop: 9 },
  clearSignatureText: { color: "#C2413B", fontSize: 11, fontWeight: "700" },
  sketchSummary: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#E7F2EC", borderWidth: 1, borderColor: "#B9D7C8", borderRadius: 16, padding: 15, marginBottom: 10 },
  signatureSummary: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#F7F8F4", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 13, padding: 13 },
  sketchSummaryCopy: { flex: 1 },
  sketchSummaryTitle: { color: "#1D2924", fontSize: 14, fontWeight: "800" },
  sketchSummaryText: { color: "#738078", fontSize: 11, marginTop: 3 },
  secondaryAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, marginBottom: 14 },
  secondaryActionText: { color: "#2E7D62", fontSize: 12, fontWeight: "700" },
  drawingModal: { flex: 1, backgroundColor: "#F7F8F4", padding: 20, paddingTop: 26 },
  drawingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  drawingEyebrow: { color: "#738078", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  drawingTitle: { color: "#1D2924", fontSize: 19, fontWeight: "800", marginTop: 3 },
  drawingClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E1EAE3", alignItems: "center", justifyContent: "center" },
  drawingCloseText: { color: "#314139", fontSize: 27, lineHeight: 30, fontWeight: "300" },
  drawingHint: { color: "#738078", fontSize: 12, lineHeight: 18, marginBottom: 16 },
  drawingCanvas: { flex: 1, minHeight: 300, backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#9FC9B3", borderRadius: 18, overflow: "hidden" },
  drawingSvg: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  drawingImage: { position: "absolute", width: "100%", height: "100%", resizeMode: "contain" },
  drawingDot: { position: "absolute", width: 8, height: 8, borderRadius: 8, backgroundColor: "#15241D" },
  drawingPlaceholder: { color: "#A0ADA5", fontSize: 14, textAlign: "center", marginTop: 145 },
  drawingActions: { flexDirection: "row", gap: 9, paddingTop: 15, paddingBottom: 8 },
  modalAction: { flex: 1, minHeight: 48, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  modalActionOutline: { borderWidth: 1, borderColor: "#C7D4CA", backgroundColor: "#FFFFFF" },
  modalActionSoft: { backgroundColor: "#E7F2EC" },
  modalActionPrimary: { backgroundColor: "#2E7D62" },
  modalActionOutlineText: { color: "#56625B", fontSize: 12, fontWeight: "800" },
  modalActionSoftText: { color: "#2E7D62", fontSize: 12, fontWeight: "800" },
  modalActionPrimaryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  checklistHint: { color: "#738078", fontSize: 12, lineHeight: 18, marginBottom: 12 },
  checklistCard: { backgroundColor: "#F7F8F4", borderWidth: 1, borderColor: "#DCE5DE", borderRadius: 14, padding: 12, marginBottom: 10 },
  checklistTitle: { color: "#1D2924", fontSize: 14, fontWeight: "800", marginBottom: 10 },
  checklistColumns: { flexDirection: "row", gap: 10 },
  checklistColumn: { flex: 1, gap: 6 },
  checklistLabel: { color: "#2E7D62", fontSize: 10, fontWeight: "800", letterSpacing: 0.7, marginBottom: 2 },
  photoChooserBackdrop: { flex: 1, backgroundColor: "rgba(20, 33, 27, 0.48)", alignItems: "center", justifyContent: "center", padding: 20 },
  photoChooserCard: { width: "100%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, gap: 10 },
  photoChooserTitle: { color: "#1D2924", fontSize: 20, fontWeight: "800" },
  photoChooserText: { color: "#738078", fontSize: 13, marginBottom: 4 },
  photoChooserCancel: { alignItems: "center", paddingVertical: 10 },
  photoChooserCancelText: { color: "#738078", fontSize: 13, fontWeight: "700" },
  cameraModal: { flex: 1, backgroundColor: "#101512" },
  cameraPreview: { flex: 1 },
  cameraControls: { height: 100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28 },
  cameraSecondary: { width: 92, alignItems: "center", paddingVertical: 12 },
  cameraSecondaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  cameraShutter: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  cameraShutterInner: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#FFFFFF" },
  cameraSpacer: { width: 92 },
});
