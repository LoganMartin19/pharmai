import { StyleSheet } from 'react-native';
import { colors, radius, type } from '../../theme';
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    brandMark:{width:62,height:62,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand,marginBottom:16},
    title:{...type.title,color:colors.ink,marginBottom:34},
    hero:{...type.hero,color:colors.ink,textAlign:'center',maxWidth:330},
    subtitle:{...type.body,color:colors.inkMuted,textAlign:'center',maxWidth:340,marginTop:12,marginBottom:36},
    button: {
      backgroundColor: colors.brand,
      paddingVertical: 15,
      paddingHorizontal: 32,
      borderRadius: radius.pill,
      marginVertical: 6,
      width: '100%',
      alignItems: 'center',
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor:colors.surface,
    },
    buttonText: {
      color: '#fff',
      ...type.label,
    },
    outlineText: {
      color: colors.ink,
    },
    trust:{...type.caption,color:colors.inkMuted,marginTop:24},
  });

  export default styles;
