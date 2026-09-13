/**
 * Contractbewaking voor GET /api/portal/dashboard (W-124, 13 sep 2026).
 *
 * portal-dashboard.v2.json is het vaste voorbeeld dat de Hub met een test
 * tegen zijn builder houdt (Stevin-Hub: src/contracts, dashboardContract.test.ts).
 * Hier wordt datzelfde bestand tegen de interface van de Overzichtspagina
 * gehouden: elke sleutel die de pagina eist, moet in het voorbeeld staan, en
 * andersom. Verdwijnt er een veld aan de Hub-kant (zoals "trend" op 13 sep),
 * dan faalt de typecheck hier, in plaats van de pagina in de browser.
 *
 * De vergelijking is op sleutels, niet op letterlijke unietypen: JSON geeft
 * "complete" als string, de interface als unie. Dat onderscheid vangt de
 * Hub-test af; dit bestand vangt de vorm.
 */
import voorbeeld from "./portal-dashboard.v2.json";
import type { DashboardData } from "../app/dashboard/page";

type Sleutels<T> = { [K in keyof Required<T>]: unknown };
type ExactSleutels<T, U> = Sleutels<T> & Record<Exclude<keyof U, keyof T>, never>;

// Bovenste laag: alle velden die de pagina kent moeten in het voorbeeld staan,
// en het voorbeeld mag geen velden dragen die de pagina niet kent.
export const dashboardContract: ExactSleutels<Omit<DashboardData, "message" | "reason">, typeof voorbeeld> = voorbeeld;

// Een kanaalrij.
type Kanaal = DashboardData["channels"][number];
export const kanaalContract: ExactSleutels<Kanaal, (typeof voorbeeld)["channels"][number]> = voorbeeld.channels[0];

// Dekking en periode.
export const kwaliteitContract: Sleutels<NonNullable<DashboardData["kwaliteit"]>> = voorbeeld.kwaliteit;
export const periodeContract: Sleutels<DashboardData["period"]> = voorbeeld.period;
export const vorigePeriodeContract: Sleutels<NonNullable<DashboardData["vorigePeriode"]>> = voorbeeld.vorigePeriode;
