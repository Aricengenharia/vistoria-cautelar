import { Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useRef, useState } from "react";

const WIDTH = 700;
const HEIGHT = 420;

type DrawingSurfaceProps = {
  points: string[];
  onChange: (points: string[]) => void;
  imageUri?: string;
  style?: StyleProp<ViewStyle>;
};

function segments(points: string[]): string[][] {
  const output: string[][] = [];
  let current: string[] = [];
  for (const point of points) {
    const starts = point.startsWith("S:");
    const clean = starts ? point.slice(2) : point;
    if (starts && current.length) { output.push(current); current = []; }
    if (/^\d+(\.\d+)?,\d+(\.\d+)?$/.test(clean)) current.push(clean);
  }
  if (current.length) output.push(current);
  return output;
}

function nativePoint(event: any, size: { width: number; height: number }) {
  const native = event?.nativeEvent ?? event ?? {};
  const x = Number(native.locationX ?? 0);
  const y = Number(native.locationY ?? 0);
  return `${Math.max(0, Math.min(WIDTH, Math.round((x / Math.max(size.width, 1)) * WIDTH)))},${Math.max(0, Math.min(HEIGHT, Math.round((y / Math.max(size.height, 1)) * HEIGHT)))}`;
}

export function DrawingSurface({ points, onChange, imageUri, style }: DrawingSurfaceProps) {
  const drawing = useRef(false);
  const size = useRef({ width: WIDTH, height: HEIGHT });
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const start = (event: any) => { drawing.current = true; const next = [...pointsRef.current, `S:${nativePoint(event, size.current)}`]; pointsRef.current = next; onChange(next); };
  const move = (event: any) => { if (!drawing.current) return; const next = [...pointsRef.current, nativePoint(event, size.current)]; pointsRef.current = next; onChange(next); };
  const end = () => { drawing.current = false; };
  const onLayout = (event: LayoutChangeEvent) => { const { width, height } = event.nativeEvent.layout; if (width > 0 && height > 0) size.current = { width, height }; };
  return <View onLayout={onLayout} style={[styles.surface, style]} onStartShouldSetResponder={() => true} onResponderGrant={start} onResponderMove={move} onResponderRelease={end} onResponderTerminate={end}>
    {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} /> : null}
    {segments(points).length ? <Svg pointerEvents="none" style={styles.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">{segments(points).map((segment, index) => segment.length > 1 ? <Polyline key={index} points={segment.join(" ")} fill="none" stroke="#15241D" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" /> : null)}</Svg> : null}
  </View>;
}

const styles = StyleSheet.create({ surface: { overflow: "hidden", position: "relative", backgroundColor: "#FFFFFF" }, image: { ...StyleSheet.absoluteFill, resizeMode: "contain" }, svg: { ...StyleSheet.absoluteFill }, });
