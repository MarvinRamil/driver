/**
 * Province codes PayMongo accepts for `address.state` when the country is PH.
 *
 * GENERATED from bee-backend `PhProvinces.cs` — keep the two in step. Anything not on this list
 * fails activation with "state must be a valid Philippine province code", and activation is
 * irreversible, so a free-text field here is a trap: the first live run failed exactly that way.
 */
export interface PhProvince {
  code: string;
  name: string;
}

export const PH_PROVINCES: readonly PhProvince[] = [
  { code: 'PH-MNL', name: 'Metro Manila' },
  { code: 'PH-ABR', name: 'Abra' },
  { code: 'PH-AGN', name: 'Agusan del Norte' },
  { code: 'PH-AGS', name: 'Agusan del Sur' },
  { code: 'PH-AKL', name: 'Aklan' },
  { code: 'PH-ALB', name: 'Albay' },
  { code: 'PH-ANT', name: 'Antique' },
  { code: 'PH-APA', name: 'Apayao' },
  { code: 'PH-AUR', name: 'Aurora' },
  { code: 'PH-BAS', name: 'Basilan' },
  { code: 'PH-BAN', name: 'Bataan' },
  { code: 'PH-BTN', name: 'Batanes' },
  { code: 'PH-BTG', name: 'Batangas' },
  { code: 'PH-BEN', name: 'Benguet' },
  { code: 'PH-BIL', name: 'Biliran' },
  { code: 'PH-BOH', name: 'Bohol' },
  { code: 'PH-BUK', name: 'Bukidnon' },
  { code: 'PH-BUL', name: 'Bulacan' },
  { code: 'PH-CAG', name: 'Cagayan' },
  { code: 'PH-CAN', name: 'Camarines Norte' },
  { code: 'PH-CAS', name: 'Camarines Sur' },
  { code: 'PH-CAM', name: 'Camiguin' },
  { code: 'PH-CAP', name: 'Capiz' },
  { code: 'PH-CAT', name: 'Catanduanes' },
  { code: 'PH-CAV', name: 'Cavite' },
  { code: 'PH-CEB', name: 'Cebu' },
  { code: 'PH-COM', name: 'Davao de Oro (Compostela Valley)' },
  { code: 'PH-NCO', name: 'Cotabato' },
  { code: 'PH-DAV', name: 'Davao del Norte' },
  { code: 'PH-DAS', name: 'Davao del Sur' },
  { code: 'PH-DVO', name: 'Davao Occidental' },
  { code: 'PH-DAO', name: 'Davao Oriental' },
  { code: 'PH-DIN', name: 'Dinagat Islands' },
  { code: 'PH-EAS', name: 'Eastern Samar' },
  { code: 'PH-GUI', name: 'Guimaras' },
  { code: 'PH-IFU', name: 'Ifugao' },
  { code: 'PH-ILN', name: 'Ilocos Norte' },
  { code: 'PH-ILS', name: 'Ilocos Sur' },
  { code: 'PH-ILI', name: 'Iloilo' },
  { code: 'PH-ISA', name: 'Isabela' },
  { code: 'PH-KAL', name: 'Kalinga' },
  { code: 'PH-LUN', name: 'La Union' },
  { code: 'PH-LAG', name: 'Laguna' },
  { code: 'PH-LAN', name: 'Lanao del Norte' },
  { code: 'PH-LAS', name: 'Lanao del Sur' },
  { code: 'PH-LEY', name: 'Leyte' },
  { code: 'PH-MAG', name: 'Maguindanao' },
  { code: 'PH-MAD', name: 'Marinduque' },
  { code: 'PH-MAS', name: 'Masbate' },
  { code: 'PH-MDC', name: 'Mindoro Occidental' },
  { code: 'PH-MDR', name: 'Mindoro Oriental' },
  { code: 'PH-MSC', name: 'Misamis Occidental' },
  { code: 'PH-MSR', name: 'Misamis Oriental' },
  { code: 'PH-MOU', name: 'Mountain Province' },
  { code: 'PH-NEC', name: 'Negros Occidental' },
  { code: 'PH-NER', name: 'Negros Oriental' },
  { code: 'PH-NSA', name: 'Northern Samar' },
  { code: 'PH-NUE', name: 'Nueva Ecija' },
  { code: 'PH-NUV', name: 'Nueva Vizcaya' },
  { code: 'PH-PLW', name: 'Palawan' },
  { code: 'PH-PAM', name: 'Pampanga' },
  { code: 'PH-PAN', name: 'Pangasinan' },
  { code: 'PH-QUE', name: 'Quezon' },
  { code: 'PH-QUI', name: 'Quirino' },
  { code: 'PH-RIZ', name: 'Rizal' },
  { code: 'PH-ROM', name: 'Romblon' },
  { code: 'PH-WSA', name: 'Samar (Western Samar)' },
  { code: 'PH-SAR', name: 'Sarangani' },
  { code: 'PH-SIG', name: 'Siquijor' },
  { code: 'PH-SOR', name: 'Sorsogon' },
  { code: 'PH-SCO', name: 'South Cotabato' },
  { code: 'PH-SLE', name: 'Southern Leyte' },
  { code: 'PH-SUK', name: 'Sultan Kudarat' },
  { code: 'PH-SLU', name: 'Sulu' },
  { code: 'PH-SUN', name: 'Surigao del Norte' },
  { code: 'PH-SUR', name: 'Surigao del Sur' },
  { code: 'PH-TAR', name: 'Tarlac' },
  { code: 'PH-TAW', name: 'Tawi-Tawi' },
  { code: 'PH-ZMB', name: 'Zambales' },
  { code: 'PH-ZAN', name: 'Zamboanga del Norte' },
  { code: 'PH-ZAS', name: 'Zamboanga del Sur' },
  { code: 'PH-ZSI', name: 'Zamboanga Sibugay' },
] as const;

export function provinceName(code: string | null | undefined): string | null {
  if (!code) return null;
  const hit = PH_PROVINCES.find((p) => p.code.toLowerCase() === code.trim().toLowerCase());
  return hit?.name ?? null;
}
