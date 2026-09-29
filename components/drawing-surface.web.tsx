import { useEffect, useRef } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

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

function drawCanvas(canvas: HTMLCanvasElement, points: string[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.max(Math.round(rect.width * ratio), WIDTH);
  canvas.height = Math.max(Math.round(rect.height * ratio), HEIGHT);
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "#15241D";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const segment of segments(points)) {
    if (segment.length < 2) continue;
    const coords = segment.map((point) => point.split(",").map(Number));
    ctx.beginPath();
    ctx.moveTo(coords[0][0], coords[0][1]);
    for (const [x, y] of coords.slice(1)) ctx.lineTo(x, y);
    ctx.stroke();
  }
}

export function DrawingSurface({ points, onChange, imageUri, style }: DrawingSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const redraw = () => drawCanvas(canvas, points);
    redraw();
    window.addEventListener("resize", redraw);
    return () => window.removeEventListener("resize", redraw);
  }, [points]);
  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return `${Math.max(0, Math.min(WIDTH, Math.round(((event.clientX - rect.left) / Math.max(rect.width, 1)) * WIDTH)))},${Math.max(0, Math.min(HEIGHT, Math.round(((event.clientY - rect.top) / Math.max(rect.height, 1)) * HEIGHT)))}`;
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; const next = [...pointsRef.current, `S:${getPoint(event)}`]; pointsRef.current = next; onChange(next); };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { event.preventDefault(); if (!drawing.current) return; const next = [...pointsRef.current, getPoint(event)]; pointsRef.current = next; onChange(next); };
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => { event.preventDefault(); drawing.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <View style={[styles.surface, style as any]}>{imageUri ? <Image source={{ uri: imageUri }} style={styles.image as any} /> : null}<canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} style={canvasCss} /></View>;
}

const canvasCss: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "block", touchAction: "none", userSelect: "none", cursor: "crosshair", zIndex: 2 };
const styles = StyleSheet.create({ surface: { overflow: "hidden", position: "relative", backgroundColor: "#FFFFFF" }, image: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, width: "100%", height: "100%", resizeMode: "contain" }, });
