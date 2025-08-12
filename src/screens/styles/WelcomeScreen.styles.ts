import { StyleSheet } from 'react-native';
const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    title: {
      fontSize: 36,
      fontWeight: 'bold',
      marginBottom: 40,
    },
    button: {
      backgroundColor: '#1e90ff',
      paddingVertical: 12,
      paddingHorizontal: 32,
      borderRadius: 8,
      marginVertical: 10,
      width: '80%',
      alignItems: 'center',
    },
    outlineButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#1e90ff',
    },
    buttonText: {
      color: '#fff',
      fontSize: 18,
    },
    outlineText: {
      color: '#1e90ff',
    },
  });

  export default styles;