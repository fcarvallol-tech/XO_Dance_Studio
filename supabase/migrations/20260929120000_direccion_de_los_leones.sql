-- La dirección de Seducción Latina, con el local y el piso.
--
-- NO ejecutar a mano: se aplica con `supabase db push`, con aprobación.
--
-- "Av. Nueva Providencia 2260" deja fuera lo que hace falta para **encontrar la
-- sala**: es una galería, y sin el local y el piso alguien llega al edificio y
-- se queda dando vueltas. Felipe lo precisó el 29/09/2026 al escribir la
-- respuesta de "cómo llego" de la página de Ayuda, y el dato tiene que estar en
-- los dos lados: en esa respuesta y en el registro de la sede, que es de donde
-- lo saca el resto del sitio —la ficha de cada clase, la página de Nosotros y el
-- correo de confirmación de una reserva—.
--
-- Se actualiza solo la dirección: el nombre, la comuna y la referencia quedan.

update public.sedes
set direccion = 'Av. Nueva Providencia 2260, local 130, piso 3'
where slug = 'seduccion-latina';
