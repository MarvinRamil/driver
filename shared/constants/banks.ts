/**
 * Philippine banks and e-wallets that can receive a driver payout.
 *
 * GENERATED FILE — do not edit by hand.
 * Source: bee-backend/src/Modules/BeeLogistics.Modules.Payment/Application/Banks/PhBanks.json
 * Regenerate: bee-backend/scripts/sync-bank-catalog-to-driver.sh
 *
 * This is the offline fallback for the withdrawal picker. `useBanks()` prefers
 * GET /api/payments/banks so a corrected BIC ships without an app release.
 */

export interface PhBank {
  /** Stable identifier sent back to the API as `bankCode`. */
  code: string;
  name: string;
  /** SWIFT/BIC the payout is addressed to (InstaPay code where the two differ). */
  bic: string;
  /** PayMongo's registered name, when it differs from the display name above. */
  legalName?: string;
  /** Can receive on InstaPay: real-time, 24/7, max PHP 50,000 per transfer. */
  instapay: boolean;
  /** Can receive on PESONet: same or next banking day, max PHP 10,000,000. */
  pesonet: boolean;
  type: 'bank' | 'ewallet';
}

/** Per-transaction ceiling of each rail, per PayMongo. */
export const RAIL_LIMITS = {
  INSTAPAY: 50_000,
  PESONET: 10_000_000,
} as const;

/**
 * The most an institution can receive in one transfer.
 *
 * This is the HIGHEST-capacity rail it supports, not the fastest. A bank on both rails takes up to
 * PESONet's ceiling — anything over InstaPay's ₱50,000 simply routes over PESONet instead, which is
 * exactly what the backend's WithdrawalRailSelector does. Returning the InstaPay limit for such a
 * bank disabled it in the picker for amounts the server would have accepted.
 */
export function maxAmountFor(bank: Pick<PhBank, 'instapay' | 'pesonet'>): number {
  if (bank.pesonet) return RAIL_LIMITS.PESONET;
  return bank.instapay ? RAIL_LIMITS.INSTAPAY : 0;
}

/**
 * Which rail an amount will actually travel on, mirroring the backend's selection: InstaPay when
 * the institution supports it AND the amount fits, otherwise PESONet.
 */
export function railFor(
  bank: Pick<PhBank, 'instapay' | 'pesonet'>,
  amount: number | null | undefined
): 'instapay' | 'pesonet' | null {
  if (bank.instapay && (amount == null || amount <= RAIL_LIMITS.INSTAPAY)) return 'instapay';
  if (bank.pesonet) return 'pesonet';
  return bank.instapay ? 'instapay' : null;
}

/** E-wallets first, then banks — the order the picker renders them in. */
export const PH_BANKS: readonly PhBank[] = [
  { code: 'ALIPAY', name: 'Alipay+', bic: 'AUBALIPHXXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'BANANAPAY_FINTECH_SERVICES', name: 'Bananapay Fintech Services', bic: 'BFSRPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'CIS_BAYAD_CENTER_INC', name: 'CIS Bayad Center, Inc.', bic: 'CIYCPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'COINS_PH', name: 'Coins.ph', bic: 'DCPHPHM1XXX', legalName: 'DCPay (Coins.ph)', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'EASY_PAY_GLOBAL_EMI_CORP', name: 'Easy Pay Global EMI Corp', bic: 'EAGMPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'GCASH', name: 'GCash', bic: 'GXCHPHM2XXX', legalName: 'G-Xchange, Inc.', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'GRABPAY', name: 'GrabPay', bic: 'GPNEPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'I_REMIT_INC', name: 'I-Remit Inc.', bic: 'IREMPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'LULU_FINANCIAL_SERVICES', name: 'Lulu Financial Services', bic: 'LFSHPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'MARCOPAY_INC', name: 'Marcopay Inc.', bic: 'MAYCPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'MAYA', name: 'Maya', bic: 'PAPHPHM1XXX', legalName: 'Maya Philippines, Inc.', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'OMNIPAY_INC', name: 'Omnipay, Inc.', bic: 'OMNPPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'PEPPERMINT_BIZMOTO_INC_PPBIPHM2', name: 'Peppermint Bizmoto, Inc.', bic: 'PPBIPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'PEPPERMINT_BIZMOTO_INC_PEBZPHM2', name: 'PEPPERMINT BIZMOTO, INC.', bic: 'PEBZPHM2XXX', instapay: false, pesonet: true, type: 'ewallet' },
  { code: 'PHILIPPINE_DIGITAL_ASSET_EXCHANGE', name: 'Philippine Digital Asset Exchange', bic: 'PDAXPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'PPS_PEPP_FINANCIAL_SERVICES_CORPORATION', name: 'PPS-PEPP Financial Services Corporation', bic: 'PPSFPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'SHOPEEPAY_PHILIPPINES_INC', name: 'ShopeePay Philippines, Inc.', bic: 'SHPHPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'SPEEDYPAY_INC', name: 'SpeedyPay Inc.', bic: 'SPEYPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'STARPAY_CORPORATION', name: 'Starpay Corporation', bic: 'SRCPPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'TAYOCASH_INC', name: 'Tayocash Inc.', bic: 'TAYOPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'TOKTOK_WALLET_INC', name: 'TokTok Wallet Inc.', bic: 'TOKTPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'TOPJUAN_TECH_CORPORATION', name: 'Topjuan Tech Corporation', bic: 'TOPJPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'TRAXION_PAY_INC', name: 'Traxion Pay Inc.', bic: 'TRXPPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'USSC_MONEY_SERVICES_INC', name: 'USSC Money Services, Inc', bic: 'USMEPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'WISE_PILIPINAS_INC', name: 'Wise Pilipinas, Inc.', bic: 'TRWIPHM2XXX', instapay: true, pesonet: true, type: 'ewallet' },
  { code: 'ZYBI_TECH_INC', name: 'Zybi Tech Inc.', bic: 'ZBTEPHM2XXX', instapay: true, pesonet: false, type: 'ewallet' },
  { code: 'AGRIBUSINESS_BANKING_CORP_A_RURAL_BANK', name: 'AGRIBUSINESS BANKING CORP - A RURAL BANK', bic: 'AGBUPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'AL_AMANAH_ISLAMIC_BANK', name: 'AL-AMANAH ISLAMIC BANK', bic: 'AIIPPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'ALLBANK_INC_OPDVPHM1', name: 'AllBank (A Thrift Bank), Inc.', bic: 'OPDVPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'ALLBANK_INC_ALKBPHM2', name: 'ALLBANK , INC. (A THRIFT BANK)', bic: 'ALKBPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'ASIA_UNITED_BANK_CORPORATION_HELLO_MONEY', name: 'Asia United Bank Corporation/Hello Money', bic: 'AUBKPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'AUSTRALIA_NEW_ZEALAND_BANK', name: 'AUSTRALIA & NEW ZEALAND BANK', bic: 'ANZBPHMXXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANGKO_KABAYAN_INC', name: 'BANGKO KABAYAN INC.', bic: 'KARUPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANGKO_MABUHAY', name: 'BANGKO MABUHAY (A Rural Bank, Inc.)', bic: 'MRTCPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANGKO_NUESTRA_SENORA_DEL_PILAR', name: 'BANGKO NUESTRA SENORA DEL PILAR', bic: 'NSPRPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANGKOK_BANK_PUBLIC_CO_LTD', name: 'BANGKOK BANK PUBLIC CO., LTD.', bic: 'BKKBPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANK_OF_AMERICA_NAT_L_ASS_N', name: 'BANK OF AMERICA, NAT\'L. ASS\'N.', bic: 'BOFAPH2XXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANK_OF_CHINA', name: 'Bank of China', bic: 'BKCHPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'BANK_OF_COMMERCE', name: 'Bank of Commerce', bic: 'PABIPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'BANK_OF_FLORIDA', name: 'BANK OF FLORIDA', bic: 'BORRPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BANK_OF_MAKATI', name: 'BANK OF MAKATI', bic: 'MKRUPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BPI', name: 'Bank of the Philippine Islands / BPI Family', bic: 'BOPIPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'BAYANIHAN_BANK_INC', name: 'Bayanihan Bank Inc.', bic: 'RUATPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'BDO_NETWORK_BANK', name: 'BDO Network Bank', bic: 'ONNRPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'BDO', name: 'BDO Unibank, Inc.', bic: 'BNORPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'BINAN_RURAL_BANK_INC', name: 'BINAN RURAL BANK, INC', bic: 'BIURPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'BPI_DIRECT_BANKO', name: 'BPI Direct BanKo', bic: 'BPDIPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CAMALIG_BANK_INC', name: 'Camalig Bank, Inc. (A Rural Bank)', bic: 'RUCAPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CANTILAN_BANK_INC', name: 'Cantilan Bank Inc.', bic: 'CNRLPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CARD_BANK_INC', name: 'CARD BANK Inc.', bic: 'CBMFPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'CARD_MRI_RIZAL_BANK_INC', name: 'CARD MRI Rizal Bank Inc.', bic: 'CAMZPHM2XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'CARD_SME_BANK_INC_A_THRIFT_BANK', name: 'CARD SME Bank, Inc., A Thrift Bank', bic: 'CRMHPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'CATHAY_UNITED_BANK_CO_LTD', name: 'CATHAY UNITED BANK CO LTD', bic: 'UWCBPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'CEBUANA_LHUILLIER_RURAL_BANK_INC', name: 'Cebuana Lhuillier Rural Bank, Inc', bic: 'CELRPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CHINA_BANK_SAVINGS_INC', name: 'China Bank Savings, Inc.', bic: 'CHSVPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CHINABANK', name: 'China Banking Corporation', bic: 'CHBKPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CIMB_PHILIPPINES_INC', name: 'CIMB Philippines, Inc.', bic: 'CIPHPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'CITIBANK_N_A', name: 'CITIBANK, N. A.', bic: 'CITIPHMXXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'CITY_SAVINGS_BANK_INC', name: 'City Savings Bank Inc.', bic: 'CIVAPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'COMMUNITY_RURAL_BANK_OF_ROMBLON_INC', name: 'Community Rural Bank of Romblon, Inc.', bic: 'CUOBPHM2XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'COOPERATIVE_BANK_OF_QUEZON_PROVINCE', name: 'COOPERATIVE BANK OF QUEZON PROVINCE', bic: 'CBQPPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'CTBC_BANK_CORPORATION', name: 'CTBC Bank (Philippines) Corporation', bic: 'CTCBPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'DEUTSCHE_BANK', name: 'DEUTSCHE BANK', bic: 'DEUTPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'DEVELOPMENT_BANK_OF_THE_PHILIPPINES', name: 'Development Bank of the Philippines', bic: 'DBPHPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'DUMAGUETE_CITY_DEVELOPMENT_BANK', name: 'Dumaguete City Development Bank', bic: 'DCDEPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'DUNGGANON_BANK_INC', name: 'Dungganon Bank (A Rural Bank), Inc.', bic: 'DUMTPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'EASTWEST', name: 'East West Banking Corporation', bic: 'EWBCPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'EAST_WEST_RURAL_BANK', name: 'East West Rural Bank', bic: 'EAWRPHM2XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'EQUICOM_SAVINGS_BANK_INC', name: 'Equicom Savings Bank, Inc.', bic: 'EQSNPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'FIRST_CONSOLIDATED_BANK', name: 'FIRST CONSOLIDATED BANK', bic: 'FIOOPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'GATEWAY_RURAL_BANK_INC', name: 'GATEWAY RURAL BANK, INC.', bic: 'GARKPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'GOTYME_BANK_CORPORATION', name: 'GoTyme Bank Corporation', bic: 'GOTYPHM2XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'GUAGUA_RURAL_BANK_INC', name: 'GUAGUA RURAL BANK, INC.', bic: 'GRBUPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'INDUSTRIAL_AND_COMMERCIAL_BANK_OF_CHINA', name: 'INDUSTRIAL AND COMMERCIAL BANK OF CHINA', bic: 'ICBKPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'INDUSTRIAL_BANK_OF_KOREA_MANILA', name: 'INDUSTRIAL BANK OF KOREA - MANILA', bic: 'IBKOPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'ING_BANK_N_V', name: 'ING Bank N.V.', bic: 'INGBPHMMRTL', instapay: true, pesonet: false, type: 'bank' },
  { code: 'INNOVATIVE_BANK_INC', name: 'INNOVATIVE BANK, INC. (A Rural Bank)', bic: 'IORUPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'ISLA_BANK_INC', name: 'ISLA Bank (A Thrift Bank), Inc.', bic: 'ISTHPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'JPMORGAN_CHASE_BANK', name: 'JPMORGAN CHASE BANK', bic: 'CHASPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'KEB_HANA_BANK', name: 'KEB HANA BANK', bic: 'KOEXPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'LAGUNA_PRESTIGE_BANKING_CORPORATION', name: 'Laguna Prestige Banking Corporation (A Rural Bank)', bic: 'LPCRPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'LANDBANK', name: 'Land Bank of The Philippines', bic: 'TLBPPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'LEGAZPI_SAVINGS_BANK', name: 'Legazpi Savings Bank', bic: 'LESIPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'LOLC_BANK_PHILIPPINES_INC', name: 'LOLC BANK PHILIPPINES INC. (A THRIFT BANK)', bic: 'LOLPPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'LUZON_DEVELOPMENT_BANK', name: 'Luzon Development Bank', bic: 'LUDVPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'MALARAYAT_RURAL_BANK_INC', name: 'MALARAYAT RURAL BANK,INC.', bic: 'MLRUPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'MALAYAN_BANK_SAVINGS_AND_MORTGAGE_BANK_INC', name: 'Malayan Bank Savings and Mortgage Bank, Inc.', bic: 'MAARPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'MARIBANK_PHILIPPINES_INC', name: 'MariBank Philippines, Inc.', bic: 'LAUIPHM2XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'MAYA_BANK_INC_MYDBPHM2', name: 'MAYA BANK, INC', bic: 'MYDBPHM2XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'MAYA_BANK_INC_MYYAPHM2', name: 'MAYA BANK, INC.', bic: 'MYYAPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'MAYBANK_PHILIPPINES_INC', name: 'Maybank Philippines, Inc.', bic: 'MBBEPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'MEGA_INTL_COMML_BANK_CO_LTD', name: 'MEGA INTL COMML BANK CO. LTD', bic: 'ICBCPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'METROBANK', name: 'Metropolitan Bank and Trust Company', bic: 'MBTCPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'MINDANAO_CONSOLIDATED_COOPERATIVE_BANK', name: 'Mindanao Consolidated Cooperative Bank', bic: 'MIOCPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'MIZUHO_BANK_LTD', name: 'MIZUHO BANK,LTD.', bic: 'MHCBPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'MONEY_MALL_RURAL_BANK_INC', name: 'MONEY MALL RURAL BANK, INC.', bic: 'MOMLPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'MUFG_BANK_LTD', name: 'MUFG BANK, LTD', bic: 'BOTKPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'MVSM_BANK_INC', name: 'MVSM Bank, Inc.', bic: 'MVRSPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'NEW_RURAL_BANK_OF_SAN_LEONARDO_INC', name: 'NEW RURAL BANK OF SAN LEONARDO (NUEVA ECIJA), INC.', bic: 'NRSLPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'OWN_BANK_THE_RURAL_BANK_OF_CAVITE_CITY_INC_OWNBPHM2', name: 'OWN BANK THE RURAL BANK OF CAVITE CITY INC.', bic: 'OWNBPHM2XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'OWN_BANK_THE_RURAL_BANK_OF_CAVITE_CITY_INC_OWNOPHM2', name: 'OWN BANK, THE RURAL BANK OF CAVITE CITY, INC.', bic: 'OWNOPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'PACIFIC_ACE_SAVINGS_BANK_INC', name: 'Pacific Ace Savings Bank, Inc.', bic: 'PASVPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'PARTNER_RURAL_BANK_INC', name: 'Partner Rural Bank (Cotabato), Inc.', bic: 'PRTOPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'PAYMONGO_PAYMENTS_INC', name: 'PAYMONGO PAYMENTS, INC.', bic: 'PAEYPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'PHILIPPINE_BANK_OF_COMMUNICATIONS', name: 'Philippine Bank of Communications', bic: 'CPHIPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'PHILIPPINE_BUSINESS_BANK', name: 'Philippine Business Bank', bic: 'PPBUPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'PNB', name: 'Philippine National Bank', bic: 'PNBMPHMMTOD', instapay: true, pesonet: true, type: 'bank' },
  { code: 'PHILIPPINE_SAVINGS_BANK', name: 'Philippine Savings Bank', bic: 'PHSBPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'PHILIPPINE_VETERANS_BANK', name: 'Philippine Veterans Bank', bic: 'PHVBPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'PHILTRUST_BANK', name: 'PhilTrust Bank', bic: 'PHTBPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'PRODUCERS_SAVINGS_BANK_CORPORATION', name: 'Producers Savings Bank Corporation', bic: 'PSCOPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'QUEEN_CITY_DEVELOPMENT_BANK_INC', name: 'Queen City Development Bank, Inc.', bic: 'QCDFPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'RANG_AY_BANK_A_RURAL_BANK_INC', name: 'RANG-AY BANK A Rural Bank Inc', bic: 'RARLPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'RBT_BANK_INC_A_RURAL_BANK', name: 'RBT BANK, INC., A Rural Bank', bic: 'RBRUPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RCBC', name: 'Rizal Commercial Banking Corporation', bic: 'RCBCPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'ROBINSONS_BANK_CORPORATION', name: 'Robinsons Bank Corporation', bic: 'ROBPPHMQXXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'RURAL_BANK_OF_ANGELES_INC', name: 'RURAL BANK OF ANGELES, INC.', bic: 'RUANPH22XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_BACOLOD_CITY_INC', name: 'RURAL BANK OF BACOLOD CITY, INC.', bic: 'RUBCPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_BAUANG_INC', name: 'RURAL BANK OF BAUANG, INC', bic: 'RUBUPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_DIGOS_INC', name: 'RURAL BANK OF DIGOS, INC.', bic: 'RUDIPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_GUINOBATAN_INC', name: 'Rural Bank of Guinobatan, Inc.', bic: 'RUGUPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_LA_PAZ_INC', name: 'RURAL BANK OF LA PAZ, INC.', bic: 'RUPZPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_LEBAK_INC', name: 'RURAL BANK OF LEBAK (SULTAN KUDARAT), INC.', bic: 'RLSKPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_MANGALDAN_INC', name: 'RURAL BANK OF MANGALDAN, INC.', bic: 'RUMNPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_MONTALBAN_INC', name: 'RURAL BANK OF MONTALBAN, INC.', bic: 'RUMTPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_PORAC_INC', name: 'RURAL BANK OF PORAC (PAMP), INC.', bic: 'RUPPPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_ROSARIO_INC', name: 'RURAL BANK OF ROSARIO (LA UNION), INC.', bic: 'RURUPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_SAGAY_INC', name: 'RURAL BANK OF SAGAY, INC.', bic: 'RUSYPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_SAN_NARCISO_INC', name: 'RURAL BANK OF SAN NARCISO, INC.', bic: 'RSNAPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_SILAY_CITY_INC', name: 'RURAL BANK OF SILAY CITY, INC.', bic: 'RUSTPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'RURAL_BANK_OF_STA_IGNACIA_INC', name: 'RURAL BANK OF STA. IGNACIA, INC.', bic: 'RUSGPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'SALMON_BANK_INC', name: 'SALMON BANK (RURAL BANK), INC.', bic: 'SLRNPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'SEC', name: 'Security Bank Corporation', bic: 'SETCPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'SECURITY_BANK_CORPORATION_2', name: 'Security Bank Corporation 2', bic: 'SETCPHMM000', instapay: true, pesonet: false, type: 'bank' },
  { code: 'SHINHAN_BANK', name: 'SHINHAN BANK', bic: 'SHBKPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'SOUTHEAST_COUNTRY_BANK_INC_SECBPHM2', name: 'Southeast Country Bank, Inc. (A Rural Bank)', bic: 'SECBPHM2XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'SOUTHEAST_COUNTRY_BANK_INC_SCUAPHM2', name: 'SOUTHEAST COUNTRY BANK, INC. (A RURAL BANK)', bic: 'SCUAPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'STANDARD_CHARTERED_BANK', name: 'Standard Chartered Bank', bic: 'SCBLPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'STERLING_BANK_OF_ASIA_INC_A_SAVINGS_BANK', name: 'Sterling Bank of Asia, Inc., A Savings Bank', bic: 'STLAPH22XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'SUMITOMO_MITSUI_BANKING_CORP', name: 'SUMITOMO MITSUI BANKING CORP', bic: 'SMBCPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'SUMMIT_BANK', name: 'SUMMIT BANK (Rural Bank of Tublay, Inc.)', bic: 'RUBTPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'THE_HONG_KONG_AND_SHANGHAI_BANKING_CORPORATION_LIMITED_PHILIPPINE_BRANCH', name: 'The Hong Kong and Shanghai Banking Corporation Limited, Philippine Branch', bic: 'HSBCPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'TONIK_DIGITAL_BANK', name: 'Tonik Digital Bank', bic: 'TDBIPHM2XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'TONIK_DIGITAL_BANK_INC', name: 'TONIK DIGITAL BANK, INC.', bic: 'TODGPHM2XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'TOP_BANK_PHILIPPINES_INC', name: 'Top Bank Philippines, Inc. (A Rural Bank)', bic: 'COUKPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'TOYOTA_FINANCIAL_SERVICES_PHILIPPINES_CORPORATION', name: 'Toyota Financial Services Philippines Corporation (TFSPH)', bic: 'TFSHPHM1XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'UCPB_SAVINGS_BANK', name: 'UCPB SAVINGS BANK', bic: 'UCSVPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'UBP', name: 'Union Bank of the Philippines', bic: 'UBPHPHMMXXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'UNION_DIGITAL_BANK', name: 'Union Digital Bank', bic: 'UNODPHM2XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'UNITED_COCONUT_PLANTERS_BANK', name: 'United Coconut Planters Bank', bic: 'UCPBPHMMXXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'UNITED_OVERSEAS_BANK_PHILS', name: 'UNITED OVERSEAS BANK PHILS.', bic: 'UOVBPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'UNOBANK_INC', name: 'UnoBank Inc.', bic: 'UNOBPHM2XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'VBANK_RURAL_BANKING_INC', name: 'VBANK RURAL BANKING INC', bic: 'VGBCPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'VIGAN_BANCO_RURAL_INCORPORADA', name: 'VIGAN BANCO RURAL INCORPORADA', bic: 'VBRIPHM2XXX', instapay: true, pesonet: false, type: 'bank' },
  { code: 'WEALTH_DEVELOPMENT_BANK_CORPORATION', name: 'Wealth Development Bank Corporation', bic: 'WEDVPHM1XXX', instapay: true, pesonet: true, type: 'bank' },
  { code: 'YUANTA_SAVINGS_BANK_INC', name: 'YUANTA SAVINGS BANK,INC.', bic: 'TYBKPHMMXXX', instapay: false, pesonet: true, type: 'bank' },
  { code: 'ZAMBALES_RURAL_BANK_INC', name: 'ZAMBALES RURAL BANK, INC.', bic: 'ZARUPHM1XXX', instapay: false, pesonet: true, type: 'bank' },
] as const;

export const PH_BANKS_BY_CODE: ReadonlyMap<string, PhBank> = new Map(
  PH_BANKS.map((bank) => [bank.code, bank]),
);
