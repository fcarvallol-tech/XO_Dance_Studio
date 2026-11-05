# PRD-0024 — Revocar créditos a una alumna

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Aprobado por Felipe el 05/11/2026**, con el §8.6 decidido. **Implementado en la rama `prd-0024-revocar-creditos`, sin publicar.** Migración escrita, con `--dry-run`, **sin aplicar** |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 4 de noviembre de 2026 |
| **Hito** | Hito 2 — Venta de clases (créditos) |
| **PRDs relacionados** | PRD-0023 (regalar créditos, el espejo) · PRD-0017 (créditos y el libro) · PRD-0010 parte 2 (el variable de la profesora) · ROADMAP, "Pedidos de Felipe mientras usa el sitio", pedidos 5 y 7 |

---

## 1. Problema

Desde PRD-0023 se pueden **dar** créditos y no hay cómo **quitarlos**. El caso es **regaló de
más** y hay que corregirlo. Y mientras no exista el **pack de amigas** (pedido 7, PRD-0026), se
atiende a mano: a quien compró el pack de 2 se le quita un crédito y se le regala a la amiga.

> **"Fue a clase y no reservó" quedó afuera** (Felipe, 05/11/2026). Ese caso no se resuelve
> revocando: con una revocación la profesora no cobraría una clase que sí hizo. **Es una reserva
> que falta, no un crédito de más.** Va como pieza aparte (§4).

Hoy la única vía es SQL suelto contra producción, que necesita aprobación caso a caso y **no puede
registrar quién lo hizo**: corre como `postgres`, sin perfil que poner en `creado_por`. PRD-0023 §4
lo dejó dicho: "si pasa seguido, se construye después". Pasa.

## 2. Usuario y contexto de uso

**Solo el owner** (Felipe, 04/11/2026; no admin), desde el computador o el teléfono, cuando
detecta el error o cuando una alumna escribe. Una operación de un minuto que **le quita algo que
pagó a una alumna**: tiene que quedar a quién, cuánto, de qué lote, por qué y quién lo hizo.

## 3. Alcance

1. **Función `revocar_creditos()`**, el espejo de `regalar_creditos()`, en **una sola
   transacción**:
   - baja `cantidad_disponible` de los lotes vigentes de la alumna, **del que vence primero al que
     vence último** —el mismo orden en que `reservar()` los consume—;
   - escribe en `movimientos_credito` **un movimiento negativo por cada lote tocado**, con el tipo
     nuevo `revocacion`, su `saldo_resultante`, el `motivo` y `creado_por`;
   - **no borra ni edita nada**: el regalo o la compra originales quedan como estaban en el libro.
2. **Motivo escrito obligatorio**, de al menos 5 caracteres, como el regalo.
3. **Solo owner**, verificado adentro por jerarquía (`nivel_rol >= owner`). Concedida solo a
   `service_role` y llamada desde una acción de servidor que además verifica la sesión.
4. **Si no alcanza el saldo, no revoca nada** (§8.2).
5. **Candado de duplicados**, igual que el regalo (§8.3).
6. **Pantalla en Personas** (`/admin`): un botón **Quitar** en la fila, visible solo para el owner,
   con un diálogo que pide cantidad y motivo y muestra el saldo vigente. Debajo, **Créditos
   quitados recientes**, como los regalos.
7. **Escenario antes del dry-run** (§9): revocar con saldo de sobra, exactamente lo que hay y de
   más, comprobando saldo y libro en los tres. *Corrió en una base local con todas las migraciones,
   porque esa noche tocar staging estaba prohibido (§12).*
8. **`revocadas` en el tablero, como línea propia** (Felipe, 05/11/2026): se suma a
   `metricas_resumen` y **no se resta de `vendidas`**. Vendidas es lo que se vendió, y eso no cambia
   porque después se quite un crédito.

## 4. Fuera de alcance

- **Registrar que una alumna fue a una clase sin reservar** (Felipe, 05/11/2026). Con una
  revocación el crédito se quita, pero **la profesora no cobra su variable** y la asistencia no
  queda en ninguna clase. **Pieza aparte, anotada y no empezada:** que el owner pueda inscribir a
  una alumna en una clase ya pasada. Crearía una reserva `origen = 'admin'`, que consume el crédito
  como cualquier reserva. Es el mismo hueco que el pedido 1 de la lista. El diálogo de Quitar lo
  avisa: *"Si fue a una clase sin reservar, esto no es lo que corresponde"*.
- **Revocar créditos vencidos.** Ya no sirven: quitarlos no corrige nada y ensucia el libro.
- **Tocar reservas.** Un crédito ya usado en una reserva no está en el saldo; si hay que deshacer
  una reserva, se cancela la reserva, no se revoca.
- **El pack de amigas** como producto (pedido 7). Esto lo permite atender a mano; no lo construye.
- **Avisarle por correo a la alumna** (ver §8.6.b).

## 5. Flujo principal

1. El owner entra a **Personas**, busca a la alumna (PRD-0025) y aprieta **Quitar** en su fila.
2. Se abre un `<dialog>` nativo, como el de regalar:
   - a quién: nombre y correo;
   - **saldo vigente** hoy, y de qué lotes sale;
   - **cuántas** (1 hasta el saldo vigente);
   - **motivo** (obligatorio: "regalé 3 en vez de 2", "pack de amigas: 1 pasa a [amiga]").
3. Aprieta **Quitar N clases**. El servidor verifica sesión y rol y llama a la función.
4. Sale bien: el diálogo se cierra, la fila muestra el saldo nuevo y la revocación aparece en
   **Créditos quitados recientes**, con fecha, alumna, cantidad, motivo y quién lo hizo.
5. La alumna ve su saldo menor en Mis reservas.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Pide quitar más de lo que hay vigente | **Rechaza entero, sin tocar nada**: "Tiene N clases vigentes; no se pueden quitar M" (§8.2) |
| Pide quitar exactamente el saldo | Quita todo; el saldo queda en 0, nunca negativo |
| El saldo está repartido en varios lotes | Descuenta del que vence primero, sigue con el siguiente, y escribe **un movimiento por lote** |
| Hay un lote vencido con disponible | No se toca ni cuenta para el saldo: ya no se puede usar |
| La alumna tiene una reserva futura | No se toca: ese crédito ya salió del saldo al reservar |
| Una reserva llega al mismo tiempo | La función bloquea el perfil y los lotes (`for update`), igual que el regalo y `reservar()`: una de las dos espera, y la segunda ve el saldo ya descontado |
| Motivo vacío o de menos de 5 caracteres | Rechaza |
| Cantidad 0, negativa o no entera | Rechaza |
| Quien llama es admin, profesora o alumna | Rechaza: `42501`. No llega a escribir |
| Doble clic o reenvío del formulario | Rechaza una revocación idéntica en los últimos 2 minutos (§8.3) |
| Perfil que no existe o borrado | Rechaza: `P0002` |
| **Se anula una compra (`deleted_at`) que todavía tiene clases vigentes sin usar** | **Rechaza**, en cualquier compra. Ver abajo |

### Anular una compra: primero se quitan sus clases

**Lo que había:** nada en el sitio anula una compra. `deleted_at` solo se escribe a mano en el Table
Editor, y **no toca ningún lote**. Una compra "anulada" así deja sus clases vivas y reservables.

**Lo que hace la migración:** el disparador `compras_anular_sin_clases_vivas` **rechaza** marcar
`deleted_at` en cualquier compra que todavía tenga clases vigentes sin usar, en cualquiera de sus
lotes. El error dice cuántas son y que primero hay que quitarlas.

- **Para anular una compra aprobada, se quitan primero sus clases** con esta revocación, que deja
  movimiento y motivo. Después se marca la compra.
- **En un pack de amigas son dos lotes en dos cuentas:** se quita la clase de cada uno. Mientras
  quede una sola viva, la compra no se anula, así que "los dos o ninguno" se cumple sin estado
  intermedio.
- **Las clases que ya se usaron no se tocan.** Esas clases se bailaron.
- **Un lote vencido sin usar no bloquea:** esa clase ya no se puede tomar.
- Una compra **pendiente** (sin lotes) se puede anular igual que antes.

**Nació en PRD-0026 y se movió acá** (Felipe, 05/11/2026). Es un candado sobre todas las compras y su
remedio es esta revocación: en la migración del pack, sin esta aplicada, habría dejado a Felipe sin
poder anular una compra con créditos vivos y sin herramienta para quitarlos. La alternativa, que
anular quitara las clases solo, es revocar sin motivo escrito.

### Las migraciones son independientes

`20261105130000_revocar_creditos.sql` y `20261105120000_pack_de_amigas.sql` **no dependen una de la
otra** y se pueden aplicar en cualquier orden, o una sin la otra. Comprobado en la base local: cada
una sola y las dos juntas, en los dos órdenes, con sus escenarios. El disparador solo lee
`creditos.compra_id`, que existe desde PRD-0017, y por eso su escenario arma a mano la compra con dos
lotes en vez de usar el pack.

## 7. Modelo de datos

**No hay tablas nuevas.** Un cambio de esquema:

```sql
-- El tipo nuevo. Hoy: compra, reserva, cancelacion, expiracion, ajuste, regalo.
alter table public.movimientos_credito drop constraint movimientos_credito_tipo_check;
alter table public.movimientos_credito add constraint movimientos_credito_tipo_check
  check (tipo in ('compra', 'reserva', 'cancelacion', 'expiracion', 'ajuste', 'regalo',
                  'revocacion'));
```

**Por qué un tipo propio y no `ajuste`**, que ya existe: `ajuste` no dice en qué sentido va ni por
qué, y se usó una vez a mano para anular la cuenta de prueba. `revocacion` es siempre negativa,
siempre con motivo y autor, y se puede listar sola.

### 7.1 La función

```
revocar_creditos(
  p_perfil_id uuid,       -- a quién
  p_cantidad int,         -- ≥ 1
  p_motivo text,          -- obligatorio, ≥ 5 caracteres tras recortar
  p_actor_user_id uuid    -- quién, desde la sesión
) returns int             -- cuántos lotes tocó
language plpgsql security definer set search_path = public
```

1. Actor por `user_id`; si no es owner, `42501`.
2. Valida destino, cantidad y motivo.
3. Bloquea el perfil (`for update`) y revisa el candado de duplicados.
4. Bloquea sus lotes vigentes con disponible, `order by fecha_vencimiento asc`, y suma.
5. Si la suma no alcanza, rechaza **antes de escribir nada**.
6. Recorre los lotes: baja lo que corresponde de cada uno e inserta un movimiento `revocacion`
   con `cantidad = −lo quitado de ese lote`, `credito_id` del lote,
   `saldo_resultante = saldo_creditos(perfil)` y el motivo.

**Permisos explícitos**: `revoke all ... from public, anon, authenticated;` y
`grant execute ... to service_role;`.

### 7.2 Lectura nueva

**`revocaciones_recientes()`**, como `regalos_recientes()`: `security definer` porque devuelve
`motivo`, que no se lee con sesión desde PRD-0023, y verifica el rol en la primera línea. Solo
owner, porque solo owner revoca.

### 7.3 Lo que una revocación toca en métricas y finanzas

Leído en la versión vigente de `metricas_resumen` (`20261004120000`):

| Indicador | Qué pasa |
|---|---|
| Ingresos, compras, ventas por plan | **Nada.** Salen de `compras` pagadas |
| Créditos vendidos y regalados del período | **Nada.** Filtran `tipo = 'compra'` y `'regalo'`: una revocación no "des-vende" ni "des-regala" |
| Consumidas | **Nada.** Filtra `reserva` y `cancelacion`. Una revocación no es un consumo |
| **Revocadas** (nuevo) | **Línea propia**, en positivo, del período, del anterior y desde siempre. En `/owner/metricas` como "Quitadas este mes", con su comparación |
| Tasa de utilización | Se calcula sobre **otorgadas menos revocadas**: una clase quitada ya no se puede tomar, y dejarla en el denominador bajaría la tasa sin que nadie haya dejado de venir |
| Pasivo vigente, vendido y regalado | **Baja**, porque sale de los lotes. Bien: es una obligación que dejó de existir |
| **Conciliación libro ↔ lotes** | **Sigue cuadrando**: el libro suma todos los tipos y la revocación baja el lote y escribe el negativo en la misma transacción |
| Variable de la profesora (`metricas_finanzas`) | **Nada.** Se cuenta desde las reservas de cada clase. Por eso "fue a clase y no reservó" no va por acá |

## 8. Reglas de negocio

1. **Revocar es agregar, nunca deshacer.** Un movimiento negativo con su tipo; el positivo que lo
   originó queda intacto.
2. **Todo o nada.** Si la alumna no tiene saldo vigente suficiente, no se quita nada. **Por qué no
   quitar lo que haya:** el motivo se escribió para la cantidad pedida. Si se piden 3 y se quitan
   2 en silencio, el libro dice "regalé 3 en vez de 2" junto a un −2, y dentro de tres meses nadie
   sabe cuál de los dos números es el error. Además, que no alcance casi siempre significa algo
   que el owner tiene que saber —la alumna ya usó el crédito—, y eso se le dice en el momento, con
   el saldo real, para que decida.
3. **Nunca negativo.** Ningún lote baja de 0 —ya lo impide el `check` de `creditos`— y el saldo
   tampoco, por la regla anterior.
4. **Del lote que vence primero.** Es lo que ya hace `reservar()`, y es lo que menos le cuesta a la
   alumna: le quita lo que iba a perder antes.
5. **Motivo y autor obligatorios.** Es lo único que va a explicar dentro de tres meses por qué una
   alumna tiene un crédito menos.

### 8.3 El candado de duplicados: sí

**Conviene, y más que en el regalo.** Un regalo duplicado le da de más a una alumna; una revocación
duplicada **le quita algo que pagó**. Mismo criterio que PRD-0023: se rechaza una revocación con
el mismo perfil, cantidad, motivo y autor dentro de los últimos 2 minutos. Como una revocación
puede escribir varias filas (una por lote), el candado compara la **suma** de los movimientos
`revocacion` de ese perfil con ese motivo y autor en esa ventana, no fila por fila.

### 8.6 Decisiones (Felipe, 05/11/2026)

| # | Pregunta | Decidido |
|---|---|---|
| a | **El caso "fue a clase y no reservó"** | ✅ **Revocar es solo para revocar.** Ese caso es una reserva que falta, no un crédito de más, y con una revocación la profesora no cobraría la clase que dictó. Fuera de este PRD, como pieza aparte (§4) |
| b | ¿Se le avisa por correo a la alumna? | ✅ **No.** Ve el saldo nuevo en Mis reservas |
| c | ¿La alumna ve el motivo? | ✅ **No**, como en el regalo: es interno |
| d | ¿Tope por revocación? | ✅ **El tope es su saldo vigente** |
| e | ¿Cómo aparece en el tablero? | ✅ **Línea propia, `revocadas`**, sin restarse de `vendidas` |

## 9. Criterios de aceptación

**Escenario antes del dry-run** (pedido de Felipe). Corrió en la **base local con todas las
migraciones** (`scripts/base-local/escenario-revocar.mjs`, **25 de 25**), con una alumna sembrada
con dos lotes vigentes que vencen en fechas distintas y uno vencido:

- [x] **Saldo de sobra**: se quitan 3 de 5. Baja primero el lote que vence antes (2→0), después el
      otro (3→2), y el vencido no se toca. Quedan dos movimientos `revocacion` (−2 y −1), con motivo y
      autor.
- [x] **Exactamente lo que hay**: se quitan 2 de 2. El saldo vigente queda en 0 y ningún lote queda
      negativo.
- [x] **De más**: con saldo 0 se piden 1, y con saldo 2 se piden 3. Las dos se rechazan **y no
      cambia nada**: ni lotes ni libro.
- [x] **En los tres**: libro = lotes por persona, y el último `saldo_resultante` = `saldo_creditos()`.
- [x] Una revocación idéntica enseguida se rechaza y no quita dos veces.
- [x] **Permisos, preguntados con la sesión de cada rol**:
  - **Nadie con sesión llama la función directo**: ni owner, ni admin, ni alumna, ni anon.
  - Pasando su propio `user_id`, **admin y alumna son rechazados adentro**.
  - `revocaciones_recientes()`: el owner sí la lee; admin y alumna son rechazados; anon no tiene
    permiso.
  - La alumna ve sus movimientos de revocación, **pero no el motivo**. Otra alumna no los ve.
- [x] `metricas_resumen` antes y después: vendidas, regaladas, consumidas e ingresos quedan iguales;
      `revocadas` sube en 5; el pasivo regalado baja en 5; el libro concilia.
- [x] Anular una compra con clases sin usar se rechaza y no toca lotes; con una de las dos quitada,
      sigue rechazado; con las dos quitadas, se anula y libro = lotes. Pendiente sin lotes, o con un
      lote vencido: se anula.
- [x] `--dry-run` contra producción: **solo** `20261105130000_revocar_creditos.sql`.
- [ ] **Concurrencia con `reservar()`**, con dos conexiones. *La base local es de una sola
      conexión: queda para staging.*
- [ ] Desde la pantalla, a 375 px y en escritorio: el botón solo aparece para el owner, quita, y la
      revocación aparece en la lista. *Necesita staging con la migración.*

## 10. Métrica de éxito

Que en noviembre ninguna corrección de créditos —regalos de más, pack de amigas, asistencias sin
reserva— pase por SQL a mano.

## 11. Riesgos y supuestos

- **Le quita algo que pagó a una alumna.** Por eso solo owner, todo o nada, motivo obligatorio,
  candado de duplicados y la cantidad escrita en el botón de confirmar.
- **Concurrencia con `reservar()`**: si la alumna reserva justo mientras se revoca, una espera a la
  otra por el bloqueo de lotes. Se prueba en staging con dos conexiones, no se supone.
- **Supuesto**: el volumen es bajo. Si el pack de amigas se vuelve frecuente, lo correcto es
  construirlo (pedido 7), no revocar y regalar a mano cada vez.

## 12. Notas de implementación

**05/11/2026, rama `prd-0024-revocar-creditos`.** `reservar()` no se tocó.

| Fase | Qué | Estado |
|---|---|---|
| 1 | Migración `20261105130000_revocar_creditos.sql`: tipo `revocacion`, `revocar_creditos`, `revocaciones_recientes`, `metricas_resumen` con `revocadas`, candado `compras_anular_sin_clases_vivas` (viene de PRD-0026) | ✅ Escrita · `--dry-run` contra producción lista solo esta · **sin aplicar** |
| 2 | Escenario en la base local | ✅ **25 de 25** |
| 3 | Acción `revocarCreditos` (owner) y botón **Quitar** en Personas, solo para el owner, con su diálogo | ✅ |
| 4 | "Clases quitadas recientes" en Personas, solo owner | ✅ |
| 5 | "Quitadas este mes" en `/owner/metricas`, con la utilización neta de lo revocado | ✅ |
| 6 | Prueba desde la página y la concurrencia, en staging | ⏳ Necesita la migración en staging |

**Detalles que no estaban en el borrador:**

- **Un `check` nuevo, `movimientos_revocacion_completa`.** Una revocación siempre es negativa y
  siempre tiene motivo, autor y lote, también si alguien la escribe a mano.
- **El check de tipos se reconstruye buscándolo por definición**, no por nombre, como en
  20260910120000. Queda con nombre fijo: `movimientos_credito_tipo_valido`.
- **`revocaciones_recientes` devuelve una fila por revocación**, no por lote. Agrupa las filas del
  mismo instante, perfil, motivo y autor: son de la misma transacción y comparten `now()`.
- **El botón Quitar no aparece si la persona no tiene saldo vigente.**
- **El diálogo avisa** que no sirve para "fue a clase y no reservó".

**Cruce con PRD-0026 (pack de amigas):**

- Las dos migraciones son independientes (§6), y juntas los dos escenarios pasan.
- **Para anular un pack de amigas aprobado**, se quita la clase de cada lote con
  `revocar_creditos` y después se marca `deleted_at`. Mientras quede una clase viva en cualquiera de
  los dos lotes, la anulación se rechaza. Probado de punta a punta.
