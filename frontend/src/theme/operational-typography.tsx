import { useFonts } from 'expo-font';
import {
  createContext,
  useContext,
  type PropsWithChildren,
} from 'react';
import {
  Text as NativeText,
  type TextProps as NativeTextProps,
} from 'react-native';

const OperationalFontsContext = createContext(false);

export function OperationalTypographyProvider({ children }: PropsWithChildren) {
  const [fontsLoaded] = useFonts({
    Manrope: require('../../assets/fonts/Manrope-Variable.ttf'),
    WorkSans: require('../../assets/fonts/WorkSans-Variable.ttf'),
  });

  return (
    <OperationalFontsContext.Provider value={fontsLoaded}>
      {children}
    </OperationalFontsContext.Provider>
  );
}

export interface OperationalTextProps extends NativeTextProps {
  fontRole?: 'body' | 'heading';
}

export function OperationalText({
  fontRole = 'body',
  style,
  ...props
}: OperationalTextProps) {
  const fontsLoaded = useContext(OperationalFontsContext);
  const fontFamily = fontRole === 'heading' ? 'Manrope' : 'WorkSans';

  return (
    <NativeText
      {...props}
      style={[style, fontsLoaded && { fontFamily }]}
    />
  );
}
