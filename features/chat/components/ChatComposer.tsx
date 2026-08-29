import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/use-theme';

interface ChatComposerProps {
  disabled: boolean;
  disabledReason?: string;
  onSend: (text: string) => void;
}

export function ChatComposer({ disabled, disabledReason, onSend }: ChatComposerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}
    >
      {disabled && disabledReason ? (
        <Text style={[styles.disabledCaption, { color: theme.textMuted }]}>{disabledReason}</Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text },
          ]}
          placeholder={disabled ? 'Chat is unavailable' : 'Message...'}
          placeholderTextColor={theme.placeholder}
          value={text}
          onChangeText={setText}
          editable={!disabled}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: disabled || !text.trim() ? theme.border : theme.primary }]}
          onPress={handleSend}
          disabled={disabled || !text.trim()}
        >
          <Ionicons name="send" size={18} color={disabled || !text.trim() ? theme.textMuted : theme.primaryText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  disabledCaption: {
    fontSize: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
