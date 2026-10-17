// Appels Windows par FFI : registre (jeu lancé, chemins) et fenêtre toujours au premier plan.

const enc = (s: string) => {
  const u = new Uint16Array(s.length + 1);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return new Uint8Array(u.buffer);
};
const ptr = (n: bigint) => Deno.UnsafePointer.create(n);

export const HKCU = 0xFFFFFFFF80000001n;
export const HKLM = 0xFFFFFFFF80000002n;

let adv: ReturnType<typeof ouvrirAdvapi> | null = null;
function ouvrirAdvapi() {
  return Deno.dlopen("advapi32.dll", {
    RegGetValueW: { parameters: ["pointer", "buffer", "buffer", "u32", "pointer", "buffer", "buffer"], result: "i32" },
  });
}

/** Valeur DWORD du registre, ou null. */
export function regDword(racine: bigint, cle: string, valeur: string): number | null {
  adv ??= ouvrirAdvapi();
  const data = new Uint32Array(1), taille = new Uint32Array([4]);
  const r = adv.symbols.RegGetValueW(ptr(racine), enc(cle), enc(valeur), 0x10, null, new Uint8Array(data.buffer), new Uint8Array(taille.buffer));
  return r === 0 ? data[0] : null;
}

/** Valeur texte du registre (valeur "" = valeur par défaut), ou null. */
export function regTexte(racine: bigint, cle: string, valeur: string): string | null {
  adv ??= ouvrirAdvapi();
  const data = new Uint16Array(2048), taille = new Uint32Array([data.byteLength]);
  const r = adv.symbols.RegGetValueW(ptr(racine), enc(cle), valeur ? enc(valeur) : null, 0x2, null, new Uint8Array(data.buffer), new Uint8Array(taille.buffer));
  if (r !== 0) return null;
  const fin = data.indexOf(0);
  return String.fromCharCode(...data.subarray(0, fin < 0 ? data.length : fin));
}

let u32: ReturnType<typeof ouvrirUser32> | null = null;
function ouvrirUser32() {
  return Deno.dlopen("user32.dll", {
    FindWindowW: { parameters: ["buffer", "buffer"], result: "pointer" },
    SetWindowPos: { parameters: ["pointer", "pointer", "i32", "i32", "i32", "i32", "u32"], result: "i32" },
  });
}

/** Met la fenêtre dont le titre est exactement `titre` au premier plan (ou l'enlève). */
export function premierPlan(titre: string, oui: boolean): boolean {
  u32 ??= ouvrirUser32();
  // Classe des fenêtres de Chrome et Edge : évite les fenêtres cachées qui portent le même titre.
  const hwnd = u32.symbols.FindWindowW(enc("Chrome_WidgetWin_1"), enc(titre));
  if (!hwnd) return false;
  const apres = ptr(oui ? 0xFFFFFFFFFFFFFFFFn : 0xFFFFFFFFFFFFFFFEn); // HWND_TOPMOST / HWND_NOTOPMOST
  return u32.symbols.SetWindowPos(hwnd, apres, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010) !== 0; // NOSIZE | NOMOVE | NOACTIVATE
}
