import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import { useState } from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';




export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const role = String(user?.role || '').toUpperCase();
  const canScan = Boolean(user?.scannerEnabled) || role === 'ADMIN' || role === 'SCANNER';
  const canManageScannerUsers = role === 'ADMIN';

  // Abrir galería
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:  ['images'], 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setSelectedImage(result. assets[0].uri);
      }
    } catch (error) {
      console.error('Error al seleccionar imagen:', error);
      alert('Hubo un error al seleccionar la imagen');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <Text style={styles.headerText}>MI PERFIL</Text>
      </View>

      <View style={styles.iconContainer}>
        <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
          <Image
            source={
              selectedImage
                ? { uri: selectedImage }
                : require('@/assets/images/circle-user-solid-full-_1_.png')
            }
            style={styles. icon}
            resizeMode="cover" 
          />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{user ? (user.username || user.email) : 'Usuario'}</Text>
        {user?.email ? <Text style={{ color: '#666' }}>{user.email}</Text> : null}
      </View>   
      
      <TouchableOpacity style={styles.whiteBox} activeOpacity={0.7} onPress={() => router.push('/terms_conditions')}>
        <Text style={styles.boxText}>Terminos y condiciones</Text>
        <Image source={require('@/assets/images/mayor.png')} style={{ width: 20, height: 20 }} />
      </TouchableOpacity>

      {canScan ? (
        <TouchableOpacity style={styles.whitebox2} activeOpacity={0.7} onPress={() => router.push('/(tabs)/scanner')}>
          <Text style={styles.boxText}>Escaner QR</Text>
          <Image source={require('@/assets/images/mayor.png')} style={styles.arrowIcon} />
        </TouchableOpacity>
      ) : null}

      {canManageScannerUsers ? (
        <TouchableOpacity style={styles.whitebox2} activeOpacity={0.7} onPress={() => router.push('/(tabs)/scanner-users')}>
          <Text style={styles.boxText}>Operadores escaner</Text>
          <Image source={require('@/assets/images/mayor.png')} style={styles.arrowIcon} />
        </TouchableOpacity>
      ) : null}
      
      <TouchableOpacity style={styles.whitebox2} activeOpacity={0.7} onPress={async () => { await logout(); router.replace('/login'); }}>
        <Text style={styles.boxText}>Cerrar Sesión</Text>
        <Image source={require('@/assets/images/mayor.png')} style={styles.arrowIcon} /> 
      </TouchableOpacity>     






    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: '#F07820',
    height: 110,
    width: '100%',
    paddingTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    backgroundColor: '#D9D9D9',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  icon: {
    width: 120,
    height: 120, 
    borderRadius: 60, 
  },
  whiteBox: { 
    width: '80%',
    height: 60, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    padding: 15, 
    alignSelf: 'center', 
    marginTop: 40, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3, // sombra en Android 

    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boxText: { 
    fontSize: 16, 
    color: '#333',
    marginTop: 2,
  },
  whitebox2: { 
    width: '80%', 
    backgroundColor: '#fff',
    borderRadius: 10,
    height: 60, 
    padding: 15, 
    alignSelf: 'center',
    marginTop: 30, 
    shadowColor: '#000', 
    shadowOpacity: 0.1,
    shadowRadius: 4, 
    elevation: 3, // sombra en Android
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowIcon: { width: 20, height: 20 },
  






  



});