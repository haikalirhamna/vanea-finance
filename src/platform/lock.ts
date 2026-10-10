/** The app lock: the phone's biometric or screen-lock prompt. It gates the screen only; the data key is not tied to it. */
import * as LocalAuthentication from 'expo-local-authentication';

/** Whether the phone has a screen lock or biometrics set up, so a lock can mean anything. */
export async function lockAvailable(): Promise<boolean> {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/** True when the user proved they are the owner (or when there is nothing to prove it with). */
export async function authenticate(reason: string): Promise<boolean> {
  if (!(await lockAvailable())) return true;
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason, disableDeviceFallback: false });
  return result.success;
}
