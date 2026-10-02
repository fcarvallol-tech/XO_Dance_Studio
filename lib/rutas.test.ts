/**
 * Tests de `volverInterno`: el `?volver=` que viaja por todo el camino de
 * entrada —comprar, entrar, completar perfil— y termina en un redirect.
 *
 * Escritos antes que la función. Lo que cuidan es que ese parámetro, que llega
 * de la URL y lo puede escribir cualquiera, no convierta el login en un
 * redirector hacia otro sitio, ni en un bucle hacia la misma página que lo lee.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { volverInterno } from "./rutas.ts";

test("volverInterno: una ruta interna pasa tal cual, con su query", () => {
  assert.equal(volverInterno("/transferir/pack-4"), "/transferir/pack-4");
  assert.equal(volverInterno("/reservar?profe=carli"), "/reservar?profe=carli");
});

test("volverInterno: lo que no es una ruta interna no pasa", () => {
  for (const valor of [null, undefined, "", "transferir", "https://otro.cl/x"]) {
    assert.equal(volverInterno(valor), null, String(valor));
  }
});

test("volverInterno: //host y /\\host son otro sitio para el navegador", () => {
  // `//otro.cl` es una URL relativa al protocolo, y los navegadores leen `/\`
  // igual que `//`. Las dos sacarían a la persona del sitio.
  assert.equal(volverInterno("//otro.cl/phishing"), null);
  assert.equal(volverInterno("/\\otro.cl/phishing"), null);
});

test("volverInterno: nunca de vuelta a completar el perfil, que es quien lo lee", () => {
  assert.equal(volverInterno("/completar-perfil"), null);
  assert.equal(volverInterno("/completar-perfil?volver=%2Ftransferir%2Fpack-4"), null);
});

test("volverInterno: tampoco a las rutas de /auth, que gastan el enlace", () => {
  assert.equal(volverInterno("/auth/confirmar?token_hash=x&type=email"), null);
  assert.equal(volverInterno("/auth/salir"), null);
});
