/**
 * Tests del resolvedor de ofertas (PRD-0020, §7 y §8.1).
 *
 * Lo que se fija acá es **el contrato de la oferta**, que es la pieza que hace
 * que mañana un link de promoción no sea otra página: si `ofertaDePlan` deja de
 * llenar alguno de estos campos, la vitrina empieza a mentir.
 *
 * Escritos antes que el código.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { diaEnSantiago } from "../semana.ts";

import { esParaAmiga, ofertaDePlan, porClaseDeOferta, promoVigente } from "./ofertas.ts";

const PACK_4 = {
  slug: "pack-4",
  nombre: "4 clases",
  clases: 4,
  precio: 28_000,
  promo: null,
  promoNombre: null,
  promoHasta: null,
  vigenciaDias: 60,
  clasesParaAmiga: 0,
};

test("ofertaDePlan: sin promoción, el precio vigente es el de lista y no hay nada que tachar", () => {
  const o = ofertaDePlan(PACK_4);
  assert.equal(o.precioClp, 28_000);
  assert.equal(o.precioNormalClp, null);
  assert.equal(o.vigenteHasta, null);
});

test("ofertaDePlan: con promoción, el vigente es el de promo y el normal queda para tacharlo", () => {
  const o = ofertaDePlan({
    ...PACK_4,
    promo: 24_000,
    promoNombre: "Lanzamiento",
    promoHasta: "lunes 31 de agosto",
  });
  assert.equal(o.precioClp, 24_000);
  assert.equal(o.precioNormalClp, 28_000);
  assert.equal(o.vigenteHasta, "lunes 31 de agosto");
  assert.equal(o.titulo, "Lanzamiento");
});

test("ofertaDePlan: sin promoción el título es el del plan", () => {
  assert.equal(ofertaDePlan(PACK_4).titulo, "4 clases");
});

test("ofertaDePlan: el slug de la URL y el del plan son distintos campos, aunque hoy coincidan", () => {
  const o = ofertaDePlan(PACK_4);
  assert.equal(o.slug, "pack-4");
  assert.equal(o.planSlug, "pack-4");
  // Es la razón de §8.1: mañana `/comprar/verano-2x1` resuelve al plan pack-4.
});

test("ofertaDePlan: pasa las clases y la vigencia sin tocarlas", () => {
  const o = ofertaDePlan(PACK_4);
  assert.equal(o.clases, 4);
  assert.equal(o.vigenciaDias, 60);
});

test("ofertaDePlan: una promo igual al precio de lista no se tacha", () => {
  // Tachar $28.000 y escribir $28.000 al lado se ve como un error del sitio.
  const o = ofertaDePlan({ ...PACK_4, promo: 28_000, promoHasta: "el domingo" });
  assert.equal(o.precioClp, 28_000);
  assert.equal(o.precioNormalClp, null);
});

test("porClaseDeOferta: el precio vigente repartido entre las clases", () => {
  assert.equal(porClaseDeOferta(ofertaDePlan(PACK_4)), 7_000);
  assert.equal(
    porClaseDeOferta(ofertaDePlan({ ...PACK_4, promo: 24_000 })),
    6_000,
  );
});

test("porClaseDeOferta: una oferta de una clase no divide por cero ni infla el número", () => {
  const suelta = ofertaDePlan({ ...PACK_4, slug: "suelta", nombre: "Clase suelta", clases: 1, precio: 8_500 });
  assert.equal(porClaseDeOferta(suelta), 8_500);
});

// --- promoVigente: el último día cuenta entero, en Santiago ----------------
test("promoVigente: el martes 3 a las 23:30 de Santiago la promo hasta el 3 sigue", () => {
  // 23:30 en Santiago (UTC−3) ya es miércoles 4 en UTC.
  const hoy = diaEnSantiago(new Date("2026-11-04T02:30:00Z"));
  assert.equal(hoy, "2026-11-03");
  assert.equal(promoVigente(26_000, "2026-11-03", hoy), true);
});

test("promoVigente: el miércoles 4 a las 00:01 de Santiago ya no", () => {
  assert.equal(promoVigente(26_000, "2026-11-03", diaEnSantiago(new Date("2026-11-04T03:01:00Z"))), false);
});

test("promoVigente: sin precio o sin fecha, no hay promo", () => {
  assert.equal(promoVigente(null, "2026-11-03", "2026-11-01"), false);
  assert.equal(promoVigente(26_000, null, "2026-11-01"), false);
});

// PRD-0026 — el pack de amigas es un plan más; lo único distinto es que una
// parte de las clases va a otra cuenta, y eso la oferta lo tiene que llevar
// hasta la vitrina y el paso de transferir.

const PACK_AMIGAS = {
  ...PACK_4,
  slug: "pack-amigas",
  nombre: "Pack de amigas",
  clases: 2,
  precio: 16_000,
  vigenciaDias: 30,
  clasesParaAmiga: 1,
};

test("ofertaDePlan: el pack de amigas lleva cuántas clases van a la amiga", () => {
  const o = ofertaDePlan(PACK_AMIGAS);
  assert.equal(o.clasesParaAmiga, 1);
  assert.equal(esParaAmiga(o), true);
  assert.equal(o.precioClp, 16_000);
  // El precio por clase es el del pack entero: $8.000 cada una, la tuya y la de ella.
  assert.equal(porClaseDeOferta(o), 8_000);
});

test("esParaAmiga: un pack normal no lo es", () => {
  assert.equal(esParaAmiga(ofertaDePlan(PACK_4)), false);
});
