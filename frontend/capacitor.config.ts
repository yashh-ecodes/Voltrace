import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'in.voltrace.app',
  appName: 'Voltrace',
  webDir: 'dist',
  android: { backgroundColor: '#F8FAFC' },
  plugins: {
    BluetoothLe: { displayStrings: { scanning: 'Scanning for battery BMS…', cancel: 'Cancel', availableDevices: 'Nearby BMS devices', noDeviceFound: 'No BMS found' } },
  },
}

export default config
