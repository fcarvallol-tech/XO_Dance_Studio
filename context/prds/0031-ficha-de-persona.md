# PRD-0031 — La ficha de una persona: su libro de clases

| Campo | Valor |
|---|---|
| **Estado** | Borrador, espera a Felipe. **Solo el PRD: no se construye hasta que esté aprobado** |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 9 de noviembre de 2026 |
| **Hito** | Hito 2 — Venta de clases (créditos) |
| **PRDs relacionados** | ROADMAP, pedidos **1** (quiénes se inscribieron a una clase) y **3** (ficha de cada persona) · PRD-0023 (regalar) · PRD-0024 (revocar) · PRD-0025 (filtrar Personas) · PRD-0026 (pack de amigas) · PRD-0030 (reserva retroactiva; su parte 2, la deuda) · PRD-0008 (lo que se muestra de una alumna) |

---

## 1. Problema

Felipe ya no se acuerda de a quién le regaló las clases que debía de octubre, y **no quiere regalar
dos veces**. Hoy no tiene cómo comprobarlo:

- `/admin` es una tabla plana: nombre, correo, rol y saldo. **El nombre no se puede apretar.**
- "Regalos recientes" muestra los últimos 30 y **no se puede filtrar** por persona, por motivo ni
  por fecha.
- Las reservas no aparecen en ninguna parte del portal de administración (pedido 1).

**Contar reservas no responde la pregunta.** Una reserva no dice si la clase la pagó o se la
regalaron. Lo que responde es **su libro**: qué recibió, cuándo, de dónde salió y con qué motivo. El
diseño parte de ahí y no de las reservas.

## 2. Usuario y contexto de uso

- **Felipe (owner)**, desde el computador o el teléfono, cuando alguien le escribe o antes de
  regalar. Necesita la respuesta en menos de un minuto: "¿a esta le di sus clases de octubre?".
- **Carla y quien administre (admin)**, cuando una alumna pregunta por lo suyo: "transferí y no sé
  si quedé", "¿cuántas me quedan?".

Nadie más. Ni la profesora, ni la alumna, ni nadie sin sesión.

## 3. Alcance

### 3.1 La ficha: `/admin/personas/<id>`

Se llega apretando el nombre en `/admin`, en el listado de regalos, en la lista de una clase o en
la bandeja de compras. **En este orden:**

1. **Saldo hoy y qué se le vence cuándo.** El número grande y, debajo, cada lote vigente con sus
   disponibles y su fecha exacta: "3 clases vencen el miércoles 3 de diciembre".
2. **De dónde salió cada clase.** Un renglón por lote, el más nuevo arriba:
   - **Compra**: el plan, el monto, la fecha y el estado de la compra.
   - **Regalo**: el motivo tal cual se escribió, su categoría (§3.3), quién lo dio y la fecha.
   - **Pack de amigas**: "de la compra de <nombre de quien compró>", con su fecha.

   Y en cada lote, en qué terminó cada clase: **usadas, disponibles, vencidas y quitadas**. Es lo
   que contesta "¿ya se las di?" y "¿las usó?".
3. **Sus compras**, con estado (`pendiente`, `pagada`, `rechazada`) y fecha.
4. **Sus reservas, futuras y pasadas**, con la clase, la fecha, la sede y la profesora.
   - Dice **"reservó"**, nunca "asistió", porque **la asistencia no se registra**.
   - Las que se cargaron después con PRD-0030 dicen "registrada después por <quién>".
   - Las canceladas se ven con su estado, y dicen si el crédito volvió.
5. **Lo que debe**: aparece cuando exista la parte 2 del PRD-0030. Hasta entonces la sección no se
   muestra. No va vacía ni con un "0" que parezca un dato.
6. **El libro completo**: `movimientos_credito` en orden, con fecha, tipo, cantidad, saldo
   resultante, motivo y autor. Es la fuente de todo lo de arriba, y está para cuando algo no cuadre.

Las acciones que ya existen se ofrecen desde la ficha: **Regalar** (admin y owner) y **Quitar**
(solo owner). No se agrega ninguna acción nueva.

### 3.2 El listado de regalos: `/admin/regalos`

Reemplaza a "Regalos recientes", que queda como un enlace "Ver todos". Una fila por regalo, con
persona, cantidad, motivo, categoría, quién y cuándo, y **en qué terminó**. **Cuatro filtros que se
combinan:**

1. **Por persona**: se elige de un buscador. En la dirección viaja su id, no su nombre (§8).
2. **Por motivo**: por **categoría** (§3.3), que es lo que separa la deuda de la cortesía, y además
   por texto dentro del motivo.
3. **Por fecha**: desde y hasta, de cuándo se regaló.
4. **Si se usó o se venció**:
   - **sin usar y vigente**;
   - **usado**, entero o en parte;
   - **vencido sin usar**;
   - **quitado** (PRD-0024).

   Un lote puede estar en más de un estado: 2 usadas y 1 vencida. Aparece en los dos filtros, y la
   fila lo dice con números.

Arriba del listado, **el total de lo que se ve**, por estado: "41 clases regaladas: 30 usadas, 8
vigentes, 3 vencidas".

### 3.3 La categoría del regalo

El motivo es texto libre. El 08/11, de 72 créditos vivos, 68 decían "clases de meses
anteriores" o "clases de meses pasados", **con variantes de redacción**, y uno decía "por lesión".
Filtrar por texto no separa bien la deuda de la cortesía, así que se agrega **una categoría
obligatoria** al regalar:

| Categoría | Para qué |
|---|---|
| `deuda` | Clases que XO debía de antes del sistema |
| `compensacion` | Una clase que XO canceló o falló |
| `cortesia` | Un regalo sin deuda: un concurso, una invitación |
| `otro` | Lo que no calce. El motivo lo explica |

- **Los regalos que ya existen se clasifican una vez**, con una lista que yo armo y **Felipe
  aprueba fila por fila** antes de que se escriba nada. No se infiere en silencio. La propuesta de
  partida: "meses anteriores" y "meses pasados" van a `deuda`, y el resto se revisa uno por uno.
- El regalo mixto del 08/11 ("Clase pasada, compensación por clase no realizada y ganadora de
  halloween") va a `otro`: un lote tiene una sola categoría. Si importa separarlo, se revoca y se
  regala en dos.

### 3.4 Una pieza para los pedidos 1 y 3

**Las reservas de una clase y las reservas de una persona son el mismo dato visto desde los dos
lados.** Se resuelven con **una sola función**, `reservas_para_admin(p_clase_id, p_perfil_id)`, que
devuelve siempre las mismas columnas: reserva, estado, clase, fecha, sede, profesora, persona, de
dónde salió el crédito y si volvió. Se llama con uno de los dos filtros:

- **La ficha** la llama con la persona.
- **El detalle de una clase** en el portal de administración la llama con la clase. Esto cierra el
  pedido 1: Felipe ve quiénes se inscribieron, con el nombre apretable hacia la ficha.

`inscritas_de_clase` queda como está, para la profesora y con su regla. No se le agrega una
excepción para admin: admin usa la otra función, que tiene su propio contrato de columnas.

## 4. Fuera de alcance

- **Saber lo que se debía.** Ver §11: es un límite del sistema, no algo pendiente de construir.
- **Registrar asistencia.** "Reservó" no es "asistió". La asistencia es otro PRD.
- **Editar el perfil desde la ficha** (pedido 4). Va con ese pedido.
- **Exportar o descargar** la ficha o el listado. Una ficha en un archivo es una ficha fuera de
  control.
- **Datos del apoderado, RUT, teléfono y observaciones médicas.** No están en la ficha, ni ocultos
  ni detrás de un botón.
- **La deuda en sí.** Es la parte 2 del PRD-0030. Esta ficha solo deja su lugar.

## 5. Flujo principal

1. Felipe va a regalarle 4 clases a Camila "por las de octubre".
2. Antes, abre `/admin/regalos`, filtra por persona "Camila" y categoría `deuda`.
3. Ve una fila: "4 clases · 'clases de meses anteriores' · 3/11 · Felipe · 3 usadas, 1 vigente".
4. Ya se las dio. Aprieta su nombre y la ficha confirma: el lote del 3/11 con 3 reservas, cada una
   con su clase y su profesora, y 1 clase que vence el 3/12.
5. No regala.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| La persona no existe o está borrada (`deleted_at`) | "Esa persona no está". **El mismo texto** para las dos, así la página no confirma si alguien existió |
| Una profesora o una alumna entra a la dirección | El layout de admin la saca, igual que hoy. Y la función rechaza igual (§8) |
| Una persona sin nada | Saldo 0, "Todavía no tiene compras, regalos ni reservas". Las secciones vacías no se dibujan |
| El perfil es de profesora | La ficha funciona igual. Las 5 profesoras tienen créditos de regalo (ROADMAP, pedido 10) |
| Lote del pack de amigas de una compra anulada | El lote dice "compra anulada" (PRD-0026 impide anular con clases vivas) |
| Un error al leer | `ErrorDeLectura`, como en el resto del portal. Nunca una ficha a medias que parezca completa |
| Más de 200 movimientos | El libro se pagina de a 100. El resto de la ficha no se pagina |

## 7. Modelo de datos

```sql
-- La categoría del regalo, obligatoria desde ahora. Nullable para los viejos
-- hasta que se clasifiquen con la lista aprobada.
alter table public.movimientos_credito
  add column categoria_regalo text
    check (categoria_regalo in ('deuda', 'compensacion', 'cortesia', 'otro'));
alter table public.movimientos_credito add constraint regalo_nuevo_con_categoria
  check (tipo <> 'regalo' or categoria_regalo is not null or created_at < '<fecha de la migración>');
-- regalar_creditos() recibe p_categoria. Es una firma nueva: hay que cambiar sus grants.

-- Lectura: funciones security definer, sin grants de tabla nuevos.
ficha_de_persona(p_perfil_id uuid) returns jsonb
  -- admin u owner, verificado adentro. El contrato es la lista de §8.2.
reservas_para_admin(p_clase_id uuid default null, p_perfil_id uuid default null)
  returns table (...)  -- exactamente uno de los dos, o rechaza
regalos_para_admin(p_perfil_id uuid, p_categoria text, p_desde date, p_hasta date,
                   p_estado text, p_texto text, p_limite int, p_desde_id uuid)
  returns table (...)  -- reemplaza a regalos_recientes, que queda como alias por un tiempo
```

- **Ninguna tabla abre una política nueva.** `movimientos_credito.motivo` ya está cerrado por
  columna para las sesiones (PRD-0023 §4), y sigue así: el motivo solo se lee por estas funciones.
- Todas con `revoke ... from public, anon` y `grant execute ... to authenticated, service_role`
  escritos, como pide `CLAUDE.md`.
- **Una llamada por ficha**: `ficha_de_persona` arma el jsonb completo. La página no hace ocho
  consultas.

## 8. Reglas de negocio

### 8.1 🔴 La pantalla más sensible del sistema

Junta nombre, correo, compras, montos y reservas de una persona que, en la mayoría de los casos, es
**menor de edad** (Ley 19.628 / 21.719). Y es la que más fácil termina en una captura de WhatsApp.
Por eso:

1. **Solo admin y owner.** Se comprueba en el layout, en la página y **dentro de cada función**.
   Una sola de las tres no alcanza.
2. **Nada identificable en la dirección.** La ficha es `/admin/personas/<uuid>`. El filtro por
   persona del listado viaja como `?persona=<uuid>`, **nunca como nombre ni correo**.
   - ⚠️ Hallazgo, sin arreglar: el buscador de `/admin` (PRD-0025) ya pone el nombre en la
     dirección (`?q=camila`), y eso queda en el historial del navegador y en los registros de
     Vercel. **Se corrige en este PRD**: la búsqueda pasa a enviarse con POST, o se limpia el `q` de
     la dirección al mostrar.
3. **Fuera de cualquier ruta pública**, con `robots: noindex` y respuesta `Cache-Control: private,
   no-store`. Nada de la ficha se genera en el build.
4. **El correo va enmascarado por defecto**, como `ca•••@gmail.com`, con un botón "Mostrar
   correo". La captura más común no lo lleva. El nombre sí se ve: sin nombre la ficha no sirve.
5. **El motivo de un regalo puede ser un dato de salud** ("por lesión"). Se muestra porque
   responde la pregunta, pero el campo de texto al regalar lleva una ayuda: "No escribas
   diagnósticos: basta con 'por lesión'".
6. **Nada de esto en los logs.** Los errores registran el id de la reserva o del lote, nunca el
   nombre ni el correo.

### 8.2 El contrato de la ficha

`ficha_de_persona` devuelve **solo**:
- nombre, correo, rol y fecha de registro;
- lotes, compras, reservas, movimientos y el motivo de los regalos.

**No devuelve** RUT, teléfono, apoderado, observaciones, `autoriza_uso_imagen` ni nada de la tabla
de perfiles que no esté en esa lista. La lista se comprueba con un test que compara las llaves del
jsonb.

### 8.3 Lo que se muestra se deriva del libro

- Usadas, vencidas y quitadas de un lote **se calculan** desde `movimientos_credito` y desde
  `fecha_vencimiento`. No se guardan en ninguna parte.
- La ficha comprueba que **el libro cuadre con los lotes** de esa persona. Si no cuadra, lo dice
  arriba en una línea: "El libro de esta persona no cuadra con sus lotes: avísale a Felipe". Es el
  mismo chequeo del tablero, pero de una sola persona.

## 9. Criterios de aceptación

- [ ] Desde `/admin`, el nombre de una alumna abre su ficha. La dirección no tiene ni su nombre ni
      su correo.
- [ ] La ficha de una alumna con compra, regalo, lote de amiga, reserva cancelada y reserva
      registrada después muestra las seis secciones en el orden de §3.1, y "reservó", nunca
      "asistió".
- [ ] En cada lote, usadas + disponibles + vencidas + quitadas = cantidad inicial.
- [ ] `/admin/regalos` filtra por persona, categoría, texto, fecha y estado, y los filtros se
      combinan. El total de arriba cuadra con las filas.
- [ ] Regalar sin categoría se rechaza en la página y en la base.
- [ ] El detalle de una clase en admin muestra sus inscritas con `reservas_para_admin`, y cada
      nombre lleva a la ficha.
- [ ] 🔴 **Preguntado con la sesión de cada rol**, en una transacción revertida
      (`scripts/verificar-rls-*.mjs`): owner y admin leen la ficha; **profesora, alumna y anon
      reciben rechazo**, también con el id de otra persona y también con su propio id. Lo mismo
      para `reservas_para_admin` y `regalos_para_admin`.
- [ ] `GET /rest/v1/` no expone ninguna función nueva a `anon`.
- [ ] Las llaves del jsonb de `ficha_de_persona` son exactamente las de §8.2.
- [ ] **Probado desde la página**, con la sesión de admin y en el teléfono a 375 px. No basta con
      llamar la función.
- [ ] La ficha hace **una** llamada a Supabase para los datos, más las de identidad que ya están
      memoizadas. Contado con el `fetch` instrumentado, y la instrumentación no se commitea.
- [ ] El buscador de `/admin` ya no deja el nombre en la dirección.

## 10. Métrica de éxito

En diciembre, **ningún regalo de categoría `deuda` a una persona que ya tenía uno igual de
octubre**, salvo que el motivo lo explique.

## 11. Riesgos y supuestos

- 🔴 **Lo que el sistema NO puede contestar: sabe lo que entregaste, no lo que debías.** La deuda
  de octubre vivía fuera del sistema. La ficha puede decir "a Camila se le regalaron 4 por
  'meses anteriores' el 3/11", pero **no puede decir si eran 4 o 6**. Es un límite conocido. **La
  lista de a quién se le debía cuántas la arma Felipe**, y se compara con el listado filtrado por
  `deuda`.
- **La clasificación de los regalos viejos depende de esa revisión.** Mientras no esté, el filtro
  por categoría deja fuera lo no clasificado. Para que no parezca que no existe, el listado ofrece
  "sin clasificar" como opción.
- **Supuesto:** que el libro cuadre. Si alguna corrección se hizo con SQL suelto antes de PRD-0024,
  la ficha lo va a mostrar como descuadre. Es mejor que esconderlo.
- **Riesgo de captura:** el correo enmascarado ayuda, pero el nombre, las compras y los montos se
  ven. No hay forma técnica de impedir una captura. La regla es de uso, y vale la pena decirla al
  dar acceso de admin.

## 12. Notas de implementación

Se llena al terminar.
