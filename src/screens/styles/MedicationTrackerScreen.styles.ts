import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  dayContainer: {
    marginBottom: 20,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
    color: '#333',
  },
  missed: {
    color: 'red',
  },
  progressBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#eee',
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#4CAF50',
  },
  progressText: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
});