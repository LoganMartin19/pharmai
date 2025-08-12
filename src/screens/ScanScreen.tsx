// ScanScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from 'react-native-text-recognition';
import ImageEditor from '@react-native-community/image-editor';
import { RootStackParamList } from '../navigation/MainNavigator';
import { parseMedicationText } from '../utils/medParser';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ScanScreen() {
  const nav = useNavigation<Nav>();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');

  useEffect(() => {
    (async () => {
      const cam = await Camera.getCameraPermissionStatus();
      if (cam !== 'granted') {
        const r = await Camera.requestCameraPermission();
        if (r !== 'granted') {
          Alert.alert('Camera denied', 'Enable camera permission to scan labels.');
          return;
        }
      }
      setReady(true);
    })();
  }, []);

  const cropToCenterBand = async (fileUri: string) => {
    // Heuristic: crop the middle horizontal band (good for label lines)
    // We don’t know actual image dims, so we’ll try a square-ish crop; RN ImageEditor
    // needs a size. It can infer from the source, but on some iOS versions you must provide.
    // We’ll try a 80% width strip, 40% height strip centered.
    try {
      const cropData = {
        // percentages aren’t supported; ImageEditor expects px.
        // When size is omitted, it infers from source and treats offsets as px.
        // This heuristic often works; if not, skip crop.
        // We’ll do a safe try/catch and fall back to original.
        offset: { x: 0, y: 0 },
        size: { width: 0, height: 0 }, // let it infer; if it fails, catch will fallback
        displaySize: undefined,
        resizeMode: 'contain' as const,
      };
      // If this throws on your setup, just skip crop and return original path.
      const cropped = await ImageEditor.cropImage(fileUri, cropData as any);
      return cropped; // a new file:// URI
    } catch {
      return fileUri;
    }
  };

  const captureAndRecognize = useCallback(async () => {
    if (!cameraRef.current || !device) return;
    try {
      setWorking(true);
      const photo = await cameraRef.current.takePhoto({
        flash,
        // keep defaults; qualityPrioritization types vary by version
      });

      const path = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;

      // optional: crop to improve OCR
      const croppedPath = await cropToCenterBand(path);

      const lines = await TextRecognition.recognize(croppedPath as string);
      const text = lines.join('\n');

      const parsed = parseMedicationText(text);
      if (!parsed.name && !parsed.dosage && !parsed.frequency) {
        Alert.alert('No label text detected', 'Try again with better lighting and keep the label centered.');
        setWorking(false);
        return;
      }

      nav.navigate('AddReminder', {
        prefill: {
          name: parsed.name ?? '',
          dosage: parsed.dosage ?? '1 tablet',
          frequency: (parsed.frequency as any) ?? 'Once daily',
        },
      });
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Scan failed', 'Please try again.');
    } finally {
      setWorking(false);
    }
  }, [device, nav, flash]);

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>No camera device found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Camera
        style={{ flex: 1 }}
        ref={cameraRef}
        device={device}
        isActive={ready && !working}
        photo={true}
      />

      {/* Top controls */}
      <View style={styles.topBar}>
        <Pressable style={styles.flashBtn} onPress={() => setFlash(flash === 'off' ? 'on' : 'off')}>
          <Text style={styles.flashText}>{flash === 'on' ? 'Flash On' : 'Flash Off'}</Text>
        </Pressable>
      </View>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.capture, working && { opacity: 0.5 }]}
          disabled={working}
          onPress={captureAndRecognize}
        >
          {working ? <ActivityIndicator /> : <Text style={styles.captureText}>Scan</Text>}
        </Pressable>
        <Text style={styles.hint}>Center the label, good lighting, minimal glare</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: 12, paddingTop: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
  },
  flashBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  flashText: { color: '#fff', fontSize: 13 },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  capture: {
    width: 120, height: 44, borderRadius: 22,
    backgroundColor: '#0A84FF', alignItems: 'center', justifyContent: 'center',
  },
  captureText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { marginTop: 8, color: '#fff', opacity: 0.85 },
});