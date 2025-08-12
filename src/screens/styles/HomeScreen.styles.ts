import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#f9f9f9',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  list: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  medName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  instructions: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  time: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#007aff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonTaken: {
    backgroundColor: '#d3e3fc',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonTextTaken: {
    color: '#007aff',
  },

  addButton: {
    position: 'absolute',
    bottom: 20, // ⬅️ was 20 or less before
    right: 20,
    backgroundColor: '#007aff',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    //shadowColor: '#000',
    //shadowOpacity: 0.2,
    //shadowRadius: 4,
    //shadowOffset: { width: 0, height: 2 },
  },

  trackerButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  trackerButtonText: {
    color: '#333',
    fontSize: 14,
  },
});

export default styles;