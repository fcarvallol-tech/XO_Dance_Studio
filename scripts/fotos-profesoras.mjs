/**
 * Las fotos de las profesoras: de `Assets/Fotos/profesoras/` (crudo) a
 * `public/profesoras/<slug>.webp` (publicado), todas con **el mismo encuadre**.
 *
 *   node scripts/fotos-profesoras.mjs
 *
 * **Mismo encuadre quiere decir la cara del mismo tamaño, y los ojos a la
 * misma altura.** Con solo la altura de ojos no alcanza: si una cara ocupa el
 * doble que otra, el aire sobre la cabeza cambia aunque los ojos calcen. Así
 * que el recorte se calcula desde dos medidas de cada foto, tomadas a mano
 * sobre el original con una grilla encima:
 *
 * - `ojos`: el punto medio entre las dos pupilas.
 * - `entre`: la distancia entre las pupilas. Es la escala de la cara.
 *
 * Todas quedan con la distancia entre pupilas en `ESCALA` del ancho y los ojos
 * a `ALTURA_OJOS` del alto. **La escala la fija la foto donde la cara ya ocupa
 * más**, porque esa no se puede alejar: hoy Carli, que en 1085 px de ancho ya
 * tiene un 9,7 %. Las demás se recortan más cerca para igualarla.
 *
 * Cuando la cara está pegada a un costado, el recorte se corre lo justo para
 * no salir de la foto y los ojos quedan fuera del centro: hoy Carli (69 %),
 * Drimy (33 %) e Isi (44 %, para dejar fuera a otra persona). Lo que no se
 * corre nunca es la altura.
 *
 * Si se cambia una foto, **hay que volver a medirla**: las coordenadas son de
 * ese archivo y de ningún otro. El script se niega a correr si el tamaño no
 * calza con el anotado.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const ESCALA = 0.097;
const ALTURA_OJOS = 0.28;
const SALIDA = { ancho: 960, alto: 1200 }; // 4:5, 1200 de lado largo

const FOTOS = {
  carli: { archivo: "carli.png", tamano: [1085, 1449], ojos: [748, 406], entre: 105 },
  drimy: { archivo: "drimy.jpg", tamano: [1080, 1620], ojos: [209, 638], entre: 62 },
  lina: { archivo: "lina.jpg", tamano: [1280, 1600], ojos: [672, 257], entre: 59 },
  pau: { archivo: "pau.jpg", tamano: [2773, 4160], ojos: [1462, 1215], entre: 160 },
  // Llegó en HEIC (05/10/2026) y se convirtió con `sips` de macOS:
  //   sips -s format jpeg -s formatOptions 95 isi.heic --out isi.jpg
  // A la izquierda hay otra persona desenfocada hasta x ≈ 860: el recorte
  // arranca desde 900 para que no entre ni un borde suyo.
  isi: { archivo: "isi.jpg", tamano: [4284, 5712], ojos: [2242, 1405], entre: 295, desdeX: 900 },
};

mkdirSync("public/profesoras", { recursive: true });

for (const [slug, f] of Object.entries(FOTOS)) {
  const origen = `Assets/Fotos/profesoras/${f.archivo}`;
  const meta = await sharp(origen).metadata();
  if (meta.width !== f.tamano[0] || meta.height !== f.tamano[1]) {
    throw new Error(
      `${origen} mide ${meta.width}x${meta.height} y lo anotado es ${f.tamano.join("x")}: ` +
        "la foto cambió y hay que volver a medir los ojos.",
    );
  }

  const ancho = Math.round(f.entre / ESCALA);
  const alto = Math.round(ancho * 1.25);
  if (ancho > meta.width || alto > meta.height) {
    throw new Error(`${slug}: la cara es demasiado grande para la escala ${ESCALA}.`);
  }

  // `desdeX`: un borde que el recorte no puede cruzar, para dejar fuera algo
  // que no es de la foto (otra persona). Corre los ojos, nunca la altura.
  const izquierda = Math.min(
    Math.max(Math.round(f.ojos[0] - ancho / 2), f.desdeX ?? 0),
    meta.width - ancho,
  );
  const arriba = Math.round(f.ojos[1] - ALTURA_OJOS * alto);
  if (arriba < 0 || arriba + alto > meta.height) {
    throw new Error(`${slug}: no hay aire suficiente arriba o abajo para los ojos al ${ALTURA_OJOS * 100} %.`);
  }

  await sharp(origen)
    .extract({ left: izquierda, top: arriba, width: ancho, height: alto })
    .resize(SALIDA.ancho, SALIDA.alto, { kernel: "lanczos3" })
    .webp({ quality: 80 })
    .toFile(`public/profesoras/${slug}.webp`);

  const factor = SALIDA.ancho / ancho;
  console.log(
    `${slug.padEnd(6)} recorte ${ancho}x${alto} desde (${izquierda},${arriba}) · ` +
      `${factor > 1 ? `agrandada ${factor.toFixed(2)}x` : `achicada ${factor.toFixed(2)}x`} · ` +
      `ojos al ${Math.round(((f.ojos[0] - izquierda) / ancho) * 100)} % del ancho`,
  );
}
