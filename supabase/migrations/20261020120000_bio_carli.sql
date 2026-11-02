-- La bio real de Carli.
--
-- Qué resuelve: su perfil público (`/profesoras/carli`) mostraba el texto de
-- relleno `Acá la bio de "Carli"` desde PRD-0015. CLAUDE.md lo dejaba así a
-- propósito hasta que ella la mandara: no se inventa ni se rellena.
--
-- La mandó Felipe el 20/10/2026. Va tal cual la escribió, igual que las de Lina
-- e Isi: sin corregir ortografía y con sus emojis. El único cambio respecto del
-- original es "alumnos" → "alumnas", pedido por Felipe ese mismo día.
--
-- Idempotente: se puede volver a correr sin daño.

update public.profesoras
set bio = 'Holiii soy Carli💞, tengo 24 años, y bailo hace 7 años. Empecé en el baile con la danza contemporánea y ballet, luego me fui a NJ a una compañía a perfeccionarme en estilos como jazz y hip hop. Mi estilo de coreografías es bien sexy y coqueto💋, así que en mis clases siempre estaremos en ese mood🤭. Lo que más amo de dar clases es conocer a mis alumnas, que me tengan confianza y generar un espacio donde puedan ser ustedes, disfruten y tengan la actitud en el cielo✨. Mi curso está pensado para personas que siempre han querido empezar, pero no se habían atrevido, como también personas que ya habían bailado antes y quieren volver con todo😉. No se queden con las ganas de hacer algo que aman por miedo o vergüenza, esta es su oportunidad, nos vemos en clase🫵🏼💖.',
    updated_at = now()
where slug = 'carli'
  and bio is distinct from 'Holiii soy Carli💞, tengo 24 años, y bailo hace 7 años. Empecé en el baile con la danza contemporánea y ballet, luego me fui a NJ a una compañía a perfeccionarme en estilos como jazz y hip hop. Mi estilo de coreografías es bien sexy y coqueto💋, así que en mis clases siempre estaremos en ese mood🤭. Lo que más amo de dar clases es conocer a mis alumnas, que me tengan confianza y generar un espacio donde puedan ser ustedes, disfruten y tengan la actitud en el cielo✨. Mi curso está pensado para personas que siempre han querido empezar, pero no se habían atrevido, como también personas que ya habían bailado antes y quieren volver con todo😉. No se queden con las ganas de hacer algo que aman por miedo o vergüenza, esta es su oportunidad, nos vemos en clase🫵🏼💖.';
