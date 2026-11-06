import test from "node:test";
import assert from "node:assert/strict";

import { CATEGORIAS, ORDEN_CATEGORIAS, esCategoria } from "./categorias-clase.ts";

test("recuperativa: crédito, base más variable, cuelga de un horario, sin marketing", () => {
  const c = CATEGORIAS.recuperativa;
  assert.deepEqual(
    [c.pagaLaAlumna, c.cobraLaProfesora, c.cuelgaDeUnHorario, c.llevaMarketing],
    ["credito", "base_y_variable", true, false],
  );
});

test("especial: plata, la mitad de lo recaudado, sin horario, con marketing", () => {
  const c = CATEGORIAS.especial;
  assert.deepEqual(
    [c.pagaLaAlumna, c.cobraLaProfesora, c.cuelgaDeUnHorario, c.llevaMarketing],
    ["plata", "mitad_de_lo_recaudado", false, true],
  );
});

test("toda categoría definida se ofrece en el selector", () => {
  assert.deepEqual([...ORDEN_CATEGORIAS].sort(), Object.keys(CATEGORIAS).sort());
});

test("esCategoria no acepta lo que venga en la URL", () => {
  assert.equal(esCategoria("recuperativa"), true);
  assert.equal(esCategoria("constructor"), false);
  assert.equal(esCategoria(undefined), false);
});
