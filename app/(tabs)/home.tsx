import { useFonts } from 'expo-font';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';

export default function HomeScreen() {

  const [fontsLoaded] = useFonts({
    BlackHans: require("@/assets/fonts/BlackHanSans-Regular.ttf"),
  });

  return (
    <View>
      <View style={styles.topHeader}>
        <Text style={styles.headerText}>BJOURNEYGO</Text>
      </View>

      <View style={styles.rectangle}>
        <Image
          source={require('@/assets/images/spyglass.png')}
          style={{ width: 30, height: 32, marginRight: 20 }}
        />
        <TextInput
          style={styles.input}
          placeholder="Buscar destino"
          placeholderTextColor={"#CCCCCC"}
        />
      </View>

      <View style={styles.titleContainer}>
        <Text style={{ fontSize: 24, fontFamily: "BlackHans", marginBottom: 10 }}>
          Explora nuevas{"\n"}rutas en bus
        </Text>
      </View>

      <View style={styles.WhiteContainer}>
        <View style={styles.horizontalImages}>

          <View style={styles.item}>
            <Image
              source={require('@/assets/images/bus-1.png')}
              style={styles.image}
            />
            <Text style={styles.label}>Explora nuevas rutas</Text>
          </View>

          <View style={styles.item}>
            <Image
              source={require('@/assets/images/bus-2.png')}
              style={styles.image}
            />
            <Text style={styles.label}>Nuevas ofertas</Text>
          </View>

        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: '#F0833F',
    height: 100,
    width: '100%',
    paddingTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    color: '#fff',
    fontFamily: "BlackHans"
  },
  rectangle: {
    backgroundColor: '#FFFFFF',
    height: 87,
    width: '100%',
    elevation: 20,
    justifyContent: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#CCCCCC',
    fontSize: 16,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    backgroundColor: '#ffffff',
    width: '80%',
    height: 130,
    justifyContent: 'center',
    paddingLeft: 20,
    alignSelf: "center",
    marginTop: 50,
    elevation: 10,
    borderRadius: 10,
  },
  WhiteContainer: {
    backgroundColor: '#ffffff',
    width: '80%',
    height: 260,
    marginTop: 60,
    alignSelf: "center",
    elevation: 10,
    borderRadius: 10,
    paddingVertical: 15,
    overflow: 'hidden',
  },

  horizontalImages: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 20, // separación uniforme
  },

  item: {
    width: '45%', // ambas ocupan el mismo ancho
    alignItems: 'center',
  },

  image: {
    marginTop: 20,
    width: '100%',
    height: 150,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: 8,
  },

  label: { textAlign: 'center', marginTop: 15, fontSize: 14, fontFamily: "BlackHans", color: "#000", }
});
