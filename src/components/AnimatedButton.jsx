import React, { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

/**
 * AnimatedButton – remplace Pressable avec une animation de scale au toucher.
 *
 * Props:
 *   onPress    {function}       Handler appelé au relâchement du doigt
 *   disabled   {boolean}        Désactive le bouton (pas d'animation, opacité réduite)
 *   style      {object|array}   Styles appliqués au bouton (même interface que Pressable)
 *   children   {node}           Contenu du bouton
 *   scaleDown  {number}         Valeur de scale au press (défaut: 0.93)
 */
const AnimatedButton = ({
  onPress,
  disabled = false,
  style,
  children,
  scaleDown = 0.93,
  ...rest
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  // Sépare les styles de layout (flex, alignSelf…) qui doivent aller sur le
  // wrapper Animated.View, des styles visuels qui restent sur le Pressable.
  const flatStyle = Array.isArray(style)
    ? Object.assign({}, ...style.map((s) => s || {}))
    : style || {};

  const { flex, flexGrow, flexShrink, flexBasis, alignSelf, ...pressableStyle } = flatStyle;
  const wrapperLayoutStyle = { flex, flexGrow, flexShrink, flexBasis, alignSelf };

  return (
    <Animated.View
      style={[
        wrapperLayoutStyle,
        {
          transform: [{ scale: scaleAnim }],
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={pressableStyle}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

export default AnimatedButton;
