import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type SplashProps = {
  size?: number;
  playAnimation?: boolean;
  progress?: number;
  backgroundColor?: string;
};

export function Splash({ size = Math.min(screenWidth * 0.4, screenHeight * 0.2), playAnimation = true, progress, backgroundColor }: SplashProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const spinnerRotate = useRef(new Animated.Value(0)).current;

  const logoSize = size;
  const logoContainerSize = logoSize + 40;
  const titleFontSize = Math.min(screenWidth * 0.08, 32);
  const spinnerSize = screenWidth * 0.15;
  const spinnerBorderWidth = screenWidth * 0.008;
  const spinnerBorderRadius = screenWidth * 0.075;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  useEffect(() => {
    if (!playAnimation) return;
    const spinnerAnimation = Animated.loop(
      Animated.timing(spinnerRotate, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
    );
    spinnerAnimation.start();
    return () => spinnerAnimation.stop();
  }, [playAnimation, spinnerRotate]);

  const spinnerRotation = spinnerRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.container, backgroundColor ? { backgroundColor } : {}]}>
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.logoContainer, { width: logoContainerSize, height: logoContainerSize }]}>
            <Image source={require('@/assets/images/logo.png')} style={{ width: logoSize, height: logoSize, resizeMode: 'contain' }} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
          <View style={styles.titleContainer}>
            <Text style={[styles.titleTextBJourney, { fontSize: titleFontSize }]}>BJOURNEY</Text>
            <Text style={[styles.titleTextGo, { fontSize: titleFontSize }]}>GO</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.spinnerContainer, { width: spinnerSize, height: spinnerSize, opacity: fadeAnim }, playAnimation && { transform: [{ rotate: spinnerRotation }] }]}>
          <View style={styles.spinner}>
            <View style={[styles.spinnerSegment, { borderWidth: spinnerBorderWidth, borderRadius: spinnerBorderRadius }]} />
            <View style={[styles.spinnerSegment, styles.spinnerSegment2, { borderWidth: spinnerBorderWidth, borderRadius: spinnerBorderRadius }]} />
            <View style={[styles.spinnerSegment, styles.spinnerSegment3, { borderWidth: spinnerBorderWidth, borderRadius: spinnerBorderRadius }]} />
            <View style={[styles.spinnerSegment, styles.spinnerSegment4, { borderWidth: spinnerBorderWidth, borderRadius: spinnerBorderRadius }]} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C3F7A' },
  contentContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: screenWidth * 0.1 },
  logoWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: screenHeight * 0.05 },
  logoContainer: { alignItems: 'center', justifyContent: 'center' },
  textContainer: { alignItems: 'center', marginBottom: screenHeight * 0.03 },
  titleContainer: { flexDirection: 'row', alignItems: 'baseline' },
  titleTextBJourney: { fontWeight: '600', color: '#FFFFFF', letterSpacing: 2 },
  titleTextGo: { fontWeight: '600', color: '#FF6B35', letterSpacing: 2 },
  spinnerContainer: { justifyContent: 'center', alignItems: 'center' },
  spinner: { width: '100%', height: '100%', position: 'relative' },
  spinnerSegment: { position: 'absolute', width: '100%', height: '100%', borderColor: 'transparent', borderTopColor: '#FFFFFF' },
  spinnerSegment2: { borderTopColor: 'transparent', borderRightColor: '#FFFFFF', opacity: 0.7 },
  spinnerSegment3: { borderTopColor: 'transparent', borderBottomColor: '#FFFFFF', opacity: 0.5 },
  spinnerSegment4: { borderTopColor: 'transparent', borderLeftColor: '#FFFFFF', opacity: 0.3 },
});

export default Splash;
