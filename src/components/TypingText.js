import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const FULL_TEXT = 'VibeRevive';

export default function TypingText({ size = 50 }) {
  const [displayed, setDisplayed] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const indexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setShowCursor(v => !v), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function tick() {
      const i = indexRef.current;
      const deleting = isDeletingRef.current;
      if (!deleting) {
        setDisplayed(FULL_TEXT.slice(0, i + 1));
        indexRef.current = i + 1;
        if (i + 1 === FULL_TEXT.length) {
          isDeletingRef.current = true;
          timeoutRef.current = setTimeout(tick, 1800);
        } else {
          timeoutRef.current = setTimeout(tick, 110);
        }
      } else {
        setDisplayed(FULL_TEXT.slice(0, i - 1));
        indexRef.current = i - 1;
        if (i - 1 === 0) {
          isDeletingRef.current = false;
          timeoutRef.current = setTimeout(tick, 400);
        } else {
          timeoutRef.current = setTimeout(tick, 55);
        }
      }
    }
    timeoutRef.current = setTimeout(tick, 600);
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { fontSize: size }]}>
        {displayed}
        <Text style={[styles.cursor, { fontSize: size, opacity: showCursor ? 1 : 0 }]}>|</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', minHeight: 70 },
  text: { fontStyle: 'italic', color: '#1A1A2E', letterSpacing: -1, fontWeight: '300' },
  cursor: { color: '#7B5EA7', fontWeight: '300' },
});