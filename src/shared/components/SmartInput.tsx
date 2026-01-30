import React, { FC, forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Platform } from 'react-native';
import { KeyboardToolbar, KeyboardControllerView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';

// Using basic colors for now, should integrate with Theme later
const COLORS = {
    inputBg: '#F2F0E9',
    text: '#1E293B',
    placeholder: '#94A3B8'
};

interface SmartInputProps extends TextInputProps {
    onSend?: (text: string) => void;
}

export const SmartInput = React.forwardRef<TextInput, SmartInputProps>(({ onSend, style, ...props }, ref) => {
    return (
        <KeyboardControllerView style={styles.container}>
            <View style={styles.inputContainer}>
                <TextInput
                    ref={ref}
                    style={[styles.input, style]}
                    placeholderTextColor={COLORS.placeholder}
                    {...props}
                />
                {onSend && (
                    <Ionicons
                        name="arrow-up-circle"
                        size={32}
                        color={COLORS.text}
                        onPress={() => onSend(props.value || '')}
                    />
                )}
            </View>
        </KeyboardControllerView>
    );
});

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 16,
        marginBottom: 8, // Safety margin
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        paddingVertical: 8,
        marginRight: 8,
    }
});
