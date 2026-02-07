import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Index() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    BlackHans: require("@/assets/fonts/BlackHanSans-Regular.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>

      <View style={styles.topHalf}>
        <Image source={require('@/assets/images/logo.png')} style={styles.imageIcon} />

        <Text style={styles.brandText}>
          BJOURNEY
          <Text style={styles.goText}>GO</Text>
        </Text>
      </View>

      <View style={styles.bottomHalf}>  
        <Text style={styles.logintext}>Iniciar Sesion</Text>

        <View style={styles.whiteBox}>
          <Image source={require('@/assets/images/correo.png')} style={{ width: 22, height: 20 }} />
          <TextInput placeholder="Correo electrónico" placeholderTextColor={"#CCCCCC"} style={styles.input}></TextInput>
        </View>

        <View style={styles.whiteBox}>
          <Image source={require('@/assets/images/lock.png')} style={{ width: 20, height: 22 }} />
          <TextInput placeholder="Contraseña" placeholderTextColor={"#CCCCCC"} secureTextEntry={true} style={styles.input}></TextInput>
        </View>

        <TouchableOpacity style={[styles.ButtonStyle, {backgroundColor: '#F0833F'}]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/home')}>
          <Text style={styles.ButtonText}>Iniciar Sesion</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', marginTop: 20 }}>
          <Text>¿No tienes una cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/sign_up')}>
            <Text style={{ color: '#FF8C00', fontWeight: 'bold' }}>Regístrate</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topHalf: {
    flex: 0.9,
    backgroundColor: "#224F9A",
    justifyContent: "center",
    alignItems: "center"
  },
  bottomHalf: {
    flex: 1.4,
    backgroundColor: "#E6E6E6",
    alignItems: "center",
  },
  imageIcon: { 
    width: 152, 
    height: 147,
    marginEnd: 5,
    marginBottom: 35, 
  },
  brandText: {
    fontFamily: "BlackHans",
    fontSize: 36,
    color: "white",
    marginBottom: 20,
  },
  goText: {
    color: "#FF8C00"
  },
  logintext: {
    fontSize: 40,
    marginTop: 30,
    fontFamily: "BlackHans",
  },
  whiteBox: { 
    width: '70%',
    height: 60, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    paddingHorizontal: 15, 
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
  textBox: { 
    fontSize: 16, 
    color: '#CCCCCC',
    marginRight: 110,
  },
  input: { 
    flex: 1, 
    marginLeft: 10, 
    fontSize: 16, 
    color: "#000", 
  },
  ButtonStyle: { 
    marginTop: 50, 
    width: '70%',
    height: 60,
    borderRadius: 10,
    overflow: 'hidden',
  },
  ButtonText: {
    color: 'white', 
    fontSize: 18, 
    fontWeight: '600', 
    textAlign: 'center', 
    lineHeight: 50,
    marginTop: 5,
  },
});
