/**
 * React Native Godot Example
 * Demonstrates embedding Godot Engine into a React Native app
 */

import React, {useState, useCallback} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import {
  RTNGodot,
  RTNGodotView,
  runOnGodotThread,
} from '@borndotcom/react-native-godot';
import * as FileSystem from 'react-native-fs';

function App(): React.JSX.Element {
  const [isGodotRunning, setIsGodotRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Godot not started');

  const initGodot = useCallback(() => {
    runOnGodotThread(() => {
      'worklet';
      if (Platform.OS === 'android') {
        RTNGodot.createInstance([
          '--verbose',
          '--path',
          '/main',
          '--rendering-driver',
          'opengl3',
          '--rendering-method',
          'gl_compatibility',
          '--display-driver',
          'embedded',
        ]);
      } else {
        // iOS configuration
        RTNGodot.createInstance([
          '--verbose',
          '--main-pack',
          FileSystem.MainBundlePath + '/GodotTest.pck',
          '--rendering-driver',
          'opengl3',
          '--rendering-method',
          'gl_compatibility',
          '--display-driver',
          'embedded',
        ]);
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

  const accessGodotAPI = useCallback(() => {
    if (!isGodotRunning) {
      setStatusMessage('Start Godot first!');
      return;
    }

    runOnGodotThread(() => {
      'worklet';
      // Access the Godot API
      const Godot = RTNGodot.API();

      // Create a Vector2
      const vector = Godot.Vector2();
      vector.x = 100.0;
      vector.y = 200.0;

      // Access the engine and scene tree
      const engine = Godot.Engine;
      const sceneTree = engine.get_main_loop();

      if (sceneTree) {
        const root = sceneTree.get_root();
        console.log('Root node:', root);
      }
    });
    setStatusMessage('Godot API accessed - check console');
  }, [isGodotRunning]);

  const createGodotButton = useCallback(() => {
    if (!isGodotRunning) {
      setStatusMessage('Start Godot first!');
      return;
    }

    runOnGodotThread(() => {
      'worklet';
      const Godot = RTNGodot.API();

      // Create a button in Godot
      const button = Godot.Button();
      button.set_text('Hello from React Native!');

      // Connect to the pressed signal
      button.pressed.connect(() => {
        console.log('Godot button pressed!');
      });

      // Add button to the scene
      const sceneTree = Godot.Engine.get_main_loop();
      if (sceneTree) {
        const root = sceneTree.get_root();
        root.add_child(button);
      }
    });
    setStatusMessage('Button created in Godot scene');
  }, [isGodotRunning]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      <View style={styles.header}>
        <Text style={styles.title}>React Native Godot</Text>
        <Text style={styles.subtitle}>Embedded Game Engine Demo</Text>
      </View>

      {/* Godot View - This is where the Godot engine renders */}
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
            {backgroundColor: isGodotRunning ? '#4ade80' : '#ef4444'},
          ]}
        />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>

      {/* Control buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={isGodotRunning ? destroyGodot : initGodot}>
          <Text style={styles.buttonText}>
            {isGodotRunning ? 'Stop Godot' : 'Start Godot'}
          </Text>
        </TouchableOpacity>

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

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.tertiaryButton,
            !isGodotRunning && styles.disabledButton,
          ]}
          onPress={accessGodotAPI}
          disabled={!isGodotRunning}>
          <Text style={styles.buttonText}>Access API</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.tertiaryButton,
            !isGodotRunning && styles.disabledButton,
          ]}
          onPress={createGodotButton}
          disabled={!isGodotRunning}>
          <Text style={styles.buttonText}>Create Button</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Note: You need a Godot project exported as .pck file{'\n'}
          Place main.pck in assets (Android) or bundle (iOS)
        </Text>
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
  tertiaryButton: {
    backgroundColor: '#0891b2',
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
  infoContainer: {
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    color: '#6b6b8a',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default App;
