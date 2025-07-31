import { useEffect, useState } from 'react';
import { Camera } from 'react-native-vision-camera';

export function useCameraPermissions() {
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  return hasPermission;
}