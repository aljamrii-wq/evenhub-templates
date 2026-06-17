import { EvenAppBridge, BridgeEvent } from '@evenrealities/even_hub_sdk'

export async function waitForEvenAppBridge(): Promise<EvenAppBridge> {
  const bridge = EvenAppBridge.getInstance()
  if (bridge.ready) return bridge

  return new Promise(resolve => {
    const onReady = () => {
      window.removeEventListener(BridgeEvent.BridgeReady, onReady)
      resolve(bridge)
    }
    window.addEventListener(BridgeEvent.BridgeReady, onReady)
  })
}