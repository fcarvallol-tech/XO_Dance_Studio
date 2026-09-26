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

import { ofertaDePlan, porClaseDeOferta } from "./ofertas.ts";

const PACK_4 = {
  slug: "pack-4",
  nombre: "4 clases",
  clases: 4,
  precio: 28_000,
  promo: null,
  promoNombre: null,
  promoHasta: null,
  vigenciaDias: 60,
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
