/**
 * The browser kiosk has no Hancom renderer. Client-supplied capability flags
 * cannot turn native document support on: advertising it would let a visitor
 * upload an HWP/HWPX file that the browser can never print.
 */
export function restrictBrowserPrintCapabilities<
  T extends {
    protocolVersion: number;
    kioskPublicKey: string;
    kioskPublicKeyFingerprint: string;
    supportsHwp?: boolean;
    supportsHwpx?: boolean;
    supportsBundle?: boolean;
  },
>(input: T) {
  return { ...input, supportsHwpx: false, supportsHwp: false, supportsBundle: true };
}
