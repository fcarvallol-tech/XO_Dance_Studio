# PRD-0020 — Link de compra compartible

| Campo | Valor |
|---|---|
| **Estado** | **Borrador.** Propuesto el 26/09/2026 a pedido de Felipe. No se escribe código hasta que apruebe §8 |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 26 de septiembre de 2026 |
| **Hito** | Hito 2 — Venta de clases |
| **PRDs relacionados** | PRD-0017 (compras por transferencia) · PRD-0014 (precios en la landing) · PRD-0018 (la página de una especial, que es el patrón que se copia) · PRD-0012 (precios promocionales) · PRD-0013 (códigos de descuento) · PRD-0004 §12 (el bucle de redirección) · ADR-0003 (pasarela) |

---

## 1. Problema

Carla vende por Instagram. La conversación termina en *"te interesa el pack de 4"*, y ahí el
sistema no ayuda: **no hay un link que mandar.** Lo que hay es `/comprar`, que vive detrás de la
sesión y que además abre con un selector de packs, así que la persona recibe —en el mejor caso— un
muro de login y después tiene que volver a elegir lo que ya eligió conversando.

Medido el 26/09/2026 contra el sitio: un link con el plan en la query **no sobrevive**.

```
GET /comprar?plan=pack-4   (sin sesión)
→ 307  location: /entrar?volver=%2Fcomprar
```

El `?plan=pack-4` se pierde, porque el proxy guarda en `volver` **solo el pathname**. Y aunque no
se perdiera, `/comprar` ignora cualquier plan que venga en la URL: `FormularioCompra` arranca
siempre sin nada elegido.

Lo que se quiere es lo mismo que ya funciona para una clase especial: **un link que se pega en una
historia, se abre sin cuenta, muestra qué se está comprando y cuánto, y recién entonces pide
entrar.**

## 2. Usuario y contexto de uso

| Quién | Desde dónde | Cuándo | Qué necesita |
|---|---|---|---|
| **Carla** | Instagram, en el teléfono, mientras conversa | En medio de la conversación que ya está caliente | Copiar un link y pegarlo. Sin abrir el portal, sin pensar |
| **Visitante sin cuenta** | Teléfono, viniendo de un DM | En un minuto, con la plata a mano | Ver qué compra, cuánto es y qué incluye **antes** de que le pidan nada |
| **Alumna con sesión** | Teléfono | Lo mismo, sin volver a elegir | Entrar directo a transferir |

## 3. Alcance

1. **Una página pública por oferta**, en `/comprar/<oferta>`: qué es, cuántas clases, cuánto
   cuesta, qué incluye y hasta cuándo sirven. Se ve **sin cuenta**, como la de una clase especial.
2. **El paso de transferir, con sesión**, con la oferta **ya elegida**: no se vuelve a preguntar
   lo que el link ya dijo.
3. **La vuelta del login conserva la oferta**, porque va en la ruta y no en la query.
4. **`/comprar` sin oferta pasa a ser pública** y muestra los cuatro packs: hoy exige sesión para
   ver precios que ya están publicados en la landing.
5. **La oferta es un concepto, no un plan** (§8.1). Hoy `<oferta>` resuelve a un plan; mañana, a
   una promoción, sin rehacer la página.
6. **Open Graph propio**, para que el link pegado en WhatsApp muestre qué se está comprando.
7. Un **botón de copiar el link** en el portal de administración, al lado de cada plan. Carla no
   debería tener que acordarse de la URL.

## 4. Fuera de alcance

- **Pago en línea.** Sigue siendo transferencia declarada hasta que exista Flow (ADR-0003).
- **Códigos de descuento.** Son PRD-0013. Este PRD deja el riel puesto (§8.1) y no los construye.
- **Cambiar cómo se definen los precios o las promociones.** Eso es PRD-0012. Acá se **muestra**
  lo que ya hay.
- **Links de un solo uso, con vencimiento propio o nominativos.** Un link es público y reusable:
  quien lo tenga lo puede abrir. Si alguna vez hace falta un link personal, es otro PRD.
- **Métricas de conversión por link.** Sería lo natural después, pero primero tiene que existir el
  link.
- **Reservar una clase especial.** Ya está, y es el patrón que se copia (PRD-0018 §7).

## 5. Flujo principal

1. Carla abre `/admin/planes` —o la sección donde estén—, aprieta **Copiar link** en "4 clases" y
   lo pega en el DM.
2. La visitante lo abre en el teléfono, **sin cuenta**. Ve: "4 clases · $28.000 · $7.000 por
   clase · sirven para cualquier clase de la parrilla, con cualquier profe y en las dos salas ·
   tienes 60 días para usarlas". Si hay promoción vigente, ve el precio normal tachado y el de
   promoción, con hasta cuándo.
3. Aprieta **Comprar por $28.000**.
4. No tiene sesión: el proxy la manda a `/entrar?volver=/comprar/pack-4/transferir`, entra con el
   enlace del correo y **vuelve a la misma oferta**.
5. Ve los datos de transferencia y el monto, ya con el pack elegido, y declara la transferencia.
   De ahí en adelante es PRD-0017 sin cambios: compra `pendiente`, aviso a la academia, bandeja.
6. Si ya tenía sesión, el paso 4 no existe: del botón pasa directo a transferir.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| La oferta no existe o está inactiva | 404 con un texto que ofrece ver todos los planes. No una página en blanco |
| El plan existe pero se le cambió el precio entre que se compartió el link y se abrió | Se muestra **el precio vigente al abrir**, no el del momento de compartir. El link no congela precios; la compra sí, al declarar |
| La promoción venció entre compartir y abrir | Se muestra el precio normal. La página no miente por haber sido compartida antes |
| Llega con sesión de profesora, admin u owner | Puede comprar igual: los roles son acumulativos y una profesora también toma clases |
| Abre el link, entra, y en el camino el plan se desactiva | Al declarar, el servidor recalcula y rechaza con un mensaje claro. **El monto nunca viene del cliente** (PRD-0017) |
| Comparte el link de una oferta agotada o de temporada | No hay stock: un plan no se agota. Si se desactiva, es el primer caso |
| La visitante abre el link en un navegador y el correo en otro | El magic link por `token_hash` funciona entre dispositivos (PRD-0004 §13). Es el mismo camino ya probado |

## 7. Modelo de datos

**Ninguna tabla nueva, y eso es parte de la propuesta.** `planes` ya tiene `slug`, `nombre`,
`cantidad_clases`, `precio_clp`, `vigencia_dias` y las tres columnas provisionales de promoción que
PRD-0012 reemplazará. La página lee lo que ya existe.

Lo único que hace falta es un **resolvedor de ofertas** en el código:

```ts
// lib/ofertas.ts — el contrato que hace que un link de promoción no sea otra página.
export type Oferta = {
  slug: string;            // lo que va en la URL
  titulo: string;          // "4 clases", o el nombre de la promoción
  clases: number;
  precioClp: number;       // el vigente, ya con promoción aplicada
  precioNormalClp: number | null;  // para tacharlo, si difiere
  vigenteHasta: string | null;     // hasta cuándo dura la oferta
  vigenciaDias: number;    // cuánto duran las clases compradas
  planSlug: string;        // qué se compra de verdad
};
```

Hoy `resolverOferta(slug)` busca en `planes`. Cuando PRD-0012 traiga períodos o PRD-0013 códigos,
resuelve ahí también **y la página no cambia**. Es la única pieza que este PRD agrega.

## 8. Decisiones

### 8.1 La URL lleva una "oferta", no un plan

`/comprar/pack-4` de entrada, pero el segmento se llama `oferta` y no `plan` en el código y en el
tipo. Es la diferencia entre poder mandar mañana `/comprar/verano-2x1` sin tocar la página, y tener
que escribir otra.

Felipe lo pidió explícitamente el 26/09/2026: **el mismo trabajo tiene que servir para mandar el
link de una promoción, no solo de un plan.**

### 8.2 La oferta va en la ruta porque en la query se pierde

No es preferencia estética. El proxy escribe `volver` con `request.nextUrl.pathname`, sin query, y
eso está **verificado con una petición real** (§1). Un link de Instagram lo abre alguien sin
sesión, así que perder el parámetro en el login es perder el caso entero.

Cambiar el proxy para que conserve la query sería la otra salida, y se descarta: toca la pieza más
delicada del sistema —la que ya produjo un bucle de redirección (PRD-0004 §12)— para ganar algo que
la ruta da gratis.

### 8.3 La vitrina es pública y el paso de transferir tiene sesión

Dos páginas, como en las clases especiales: `/comprar/<oferta>` se ve sin cuenta y
`/comprar/<oferta>/transferir` la exige. Es lo que permite que la vitrina sea estática y rápida —no
toca cookies— y que el link sirva de verdad para alguien que todavía no es alumna.

⚠️ **Esto obliga a tocar `lib/rutas.ts`, que es zona delicada.** Hoy `RUTAS_DE_GRUPO.cuenta`
incluye `/comprar` y el guard compara **por prefijo** (`empiezaEn`), así que `/comprar/pack-4`
quedaría exigiendo sesión sin que nadie lo pida. Hay que pasar a distinguir la ruta exacta de sus
hijas, y hacerlo con la advertencia de PRD-0004 §12 a la vista: un guard que redirige hacia una
ruta que él mismo cubre es un bucle infinito. La prueba de esto no es que compile: es abrir el link
sin sesión y ver a dónde llega.

### 8.4 `/comprar` sin oferta pasa a ser pública

Hoy exige sesión para mostrar precios que la landing ya publica, lo que además obliga a entrar para
comparar packs. Pasa a ser la vitrina de los cuatro, con el mismo botón por plan.

### 8.5 El link no congela el precio

Se muestra el vigente al abrir. Congelar el precio en el link significaría que un link viejo
compromete a la academia a un precio que ya no existe, y no hay forma de saber cuántos links viejos
andan dando vueltas por Instagram. Lo que **sí** se congela, como siempre, es el monto de la compra
al declarar la transferencia (PRD-0017).

## 9. Reglas de negocio

1. El monto lo calcula **el servidor** desde el slug de la oferta. Nunca viaja en el formulario.
2. Una oferta inactiva o inexistente da 404, no un precio en blanco ni un cero.
3. La página pública **no** muestra datos de nadie: solo el catálogo. No hay nada que proteger ahí
   y por eso puede ser estática.
4. Los datos de transferencia se muestran solo con sesión, igual que hoy.
5. Si faltan los datos de transferencia en `parametros`, el paso de transferir **no deja declarar**
   y lo dice, como ya hace `/comprar` hoy.

## 10. Criterios de aceptación

Se prueban **con el artefacto real**: el link abierto en un teléfono, sin sesión.

- [ ] `/comprar/pack-4` se abre **sin cuenta** y muestra nombre, clases, precio vigente, precio por
      clase y los 60 días.
- [ ] Con promoción vigente, muestra el precio normal tachado, el de promoción y hasta cuándo.
- [ ] El link pegado en WhatsApp muestra una vista previa con qué se compra y cuánto.
- [ ] Sin sesión, "Comprar por $X" lleva a `/entrar`, y **al volver del enlace del correo** cae en
      el paso de transferir **con el pack ya elegido**.
- [ ] Con sesión, el botón lleva directo a transferir.
- [ ] Declarar desde ahí crea la compra `pendiente` con el monto correcto y aparece en la bandeja.
- [ ] Una oferta inexistente da 404 con salida a todos los planes.
- [ ] `/comprar` sin oferta se ve sin cuenta y ofrece los cuatro packs.
- [ ] Ninguna ruta de `(cuenta)` quedó accesible sin sesión por el cambio de `lib/rutas.ts`, y
      ninguna redirección quedó en bucle. Se verifica abriendo cada una sin sesión.
- [ ] `npm run build` y `npm test` en verde.

## 11. Métrica de éxito

**Compras declaradas que entraron por un link compartido**, en los primeros 30 días, contra las
que entraron navegando. Si nadie usa el link, el problema no era la falta de link.

## 12. Riesgos y supuestos

- **El riesgo real está en `lib/rutas.ts`**, no en las páginas nuevas. Cambiar cómo el guard decide
  qué exige sesión puede dejar una ruta privada abierta, y eso no se nota mirando la página que se
  estaba construyendo. Los criterios de §10 incluyen revisarlas todas.
- **Supuesto: el link se comparte por DM, no se indexa.** La página es pública igual, así que si
  Google la encuentra tampoco pasa nada.
- **La promoción vive en tres columnas provisionales** de `planes` (PRD-0017), que PRD-0012 va a
  reemplazar. `resolverOferta` es justamente el lugar donde ese cambio se absorbe.
- **Que Carla lo use depende de que copiar el link sea trivial.** Si hay que armarlo a mano, no se
  usa. De ahí el botón de copiar del §3.7.

## 13. Notas de implementación

Se llena al terminar.
