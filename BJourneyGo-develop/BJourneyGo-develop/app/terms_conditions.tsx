import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function TermsConditions() {
	return (
		<ScrollView contentContainerStyle={styles.container}>
			<Text style={styles.title}>Términos y condiciones</Text>
			<Text style={styles.body}>Aquí van los términos y condiciones de la aplicación.</Text>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { padding: 20 },
	title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
	body: { fontSize: 14, color: '#334155' },
});
