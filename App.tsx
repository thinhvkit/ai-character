/**
 * React Native Godot Example
 * Demonstrates embedding Godot Engine into a React Native app
*/

// @ts-ignore: Ignore missing types for react-native-godot
import React, { useState, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';

// @ts-ignore: Ignore missing types for @borndotcom/react-native-godot
import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@borndotcom/react-native-godot';
import * as FileSystem from 'react-native-fs';
import * as Device from "expo-device";


function App(): React.JSX.Element {
  const [isGodotRunning, setIsGodotRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Godot not started');
  const [animInput, setAnimInput] = useState('');

  const initGodot = useCallback(() => {
    const name = "GodotExample";
    if (RTNGodot.getInstance() != null) {
      console.log("Godot was already initialized.");
      setIsGodotRunning(true);
      setStatusMessage('Godot engine running');
      return;
    }
    console.log("Initializing Godot");

    runOnGodotThread(() => {
      "worklet";
      console.log("Running on Godot Thread");

      if (Platform.OS === "android") {
        RTNGodot.createInstance([
          "--verbose",
          "--path",
          "/" + name,
          "--rendering-driver",
          "opengl3",
          "--rendering-method",
          "gl_compatibility",
          "--display-driver",
          "embedded",
        ]);
      } else {
        let args = [
          "--verbose",
          "--main-pack",
          FileSystem.MainBundlePath + "/" + name + ".pck",
          "--display-driver",
          "embedded",
        ];

        if (Device.isDevice) {
          args.push(
            "--rendering-driver",
            "opengl3",
            "--rendering-method",
            "gl_compatibility"
          );
        } else {
          args.push(
            "--rendering-driver",
            "metal",
            "--rendering-method",
            "mobile"
          );
        }

        console.log("Godot Args: " + Device.modelName + " " + args.join(" "));
        RTNGodot.createInstance(args);
      }
    });

    setIsGodotRunning(true);
    setStatusMessage('Godot engine running');
  }, []);

  const destroyGodot = useCallback(() => {
    runOnGodotThread(() => {
      'worklet';
      RTNGodot.destroyInstance();
    });
    setIsGodotRunning(false);
    setIsPaused(false);
    setStatusMessage('Godot stopped');
  }, []);

  useEffect(() => {
    initGodot();
    return () => {
      destroyGodot();
    };
  }, []);

  const togglePause = useCallback(() => {
    runOnGodotThread(() => {
      'worklet';
      if (isPaused) {
        RTNGodot.resume();
      } else {
        RTNGodot.pause();
      }
    });
    setIsPaused(!isPaused);
    setStatusMessage(isPaused ? 'Godot resumed' : 'Godot paused');
  }, [isPaused]);

  const sendAnimation = useCallback((anim: string, audioPath: string = "res://assets/test-audio.wav") => {
    if (!isGodotRunning) {
      setStatusMessage('Start Godot first!');
      return;
    }
    const animName = anim.trim();
    if (!animName) return;

    runOnGodotThread(() => {
      'worklet';
      const Godot = RTNGodot.API();
      const sceneTree = Godot.Engine.get_main_loop();
      if (sceneTree) {
        const root = sceneTree.get_root();
        const sophiaSkin = root.get_node('Main/SophiaSkin');
        if (sophiaSkin) {
          switch (animName) {
            case 'talk_audio':
              sophiaSkin.call(animName, audioPath);
              break;
            default:
              sophiaSkin.call(animName);
              break;
          }
        }
      }
    });
    setStatusMessage(`Animation: ${animName}`);
  }, [isGodotRunning]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <View style={styles.header}>
        <Text style={styles.title}>React Native Godot</Text>
        <Text style={styles.subtitle}>Embedded Game Engine Demo</Text>
      </View>

      {/* Godot View */}
      <View style={styles.godotContainer}>
        <RTNGodotView style={styles.godotView} />
        {!isGodotRunning && (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Godot Engine View{'\n'}Press "Start Godot" to begin
            </Text>
          </View>
        )}
      </View>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: isGodotRunning ? '#4ade80' : '#ef4444' },
          ]}
        />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Control buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.secondaryButton,
            !isGodotRunning && styles.disabledButton,
          ]}
          onPress={togglePause}
          disabled={!isGodotRunning}>
          <Text style={styles.buttonText}>
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SophiaSkin animation control */}
      <View style={styles.animContainer}>
        <Text style={styles.animLabel}>SophiaSkin Animation</Text>
        <View style={styles.animRow}>
          <TextInput
            style={styles.animInput}
            value={animInput}
            onChangeText={setAnimInput}
            placeholder="fall / jump / walk_side / edge_grab / talk"
            placeholderTextColor="#4a4a6a"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.animSendButton, !isGodotRunning && styles.disabledButton]}
            onPress={() => sendAnimation(animInput)}
            disabled={!isGodotRunning}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonContainer}>
          {['idle', 'move', 'talk_audio'].map((anim) => (
            <TouchableOpacity
              key={anim}
              style={[styles.button, styles.animQuickButton, !isGodotRunning && styles.disabledButton]}
              onPress={() => sendAnimation(anim)}
              disabled={!isGodotRunning}>
              <Text style={styles.buttonText}>{anim}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#8b8b9e',
    marginTop: 4,
  },
  godotContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#16213e',
    position: 'relative',
  },
  godotView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16213e',
  },
  placeholderText: {
    color: '#4a4a6a',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4f46e5',
  },
  secondaryButton: {
    backgroundColor: '#7c3aed',
  },
  disabledButton: {
    backgroundColor: '#3f3f5a',
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  animContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  animLabel: {
    color: '#8b8b9e',
    fontSize: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  animRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  animInput: {
    flex: 1,
    backgroundColor: '#16213e',
    color: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  animSendButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animQuickButton: {
    backgroundColor: '#0f766e',
  },
});

export default App;
