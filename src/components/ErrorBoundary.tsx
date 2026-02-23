import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        if (__DEV__) console.error("Uncaught error:", error, errorInfo);
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <View style={styles.container}>
                    <Text style={styles.title}>Something went wrong.</Text>
                    <Text style={styles.message}>{this.state.error?.message}</Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => this.setState({ hasError: false })}
                    >
                        <Text style={styles.buttonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        margin: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0'
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#e53e3e'
    },
    message: {
        fontSize: 14,
        color: '#4a5568',
        textAlign: 'center',
        marginBottom: 16
    },
    button: {
        backgroundColor: '#3182ce',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 4
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600'
    }
});
