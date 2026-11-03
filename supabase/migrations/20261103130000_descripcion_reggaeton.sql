-- La descripción del curso `reggaeton` de Drimy (Felipe, 02/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- Quedó vacía al crear el curso (20261102120000) porque no se inventa. Felipe
-- pidió copiar la de `reggaeton-femme` sacándole "Femme", porque son cursos muy
-- parecidos. La de `reggaeton-femme` **no tiene la palabra "Femme"**, así que
-- la copia es literal. ⚠️ Dice "bailado desde lo femenino": si eso no va para
-- Reggaeton, es la frase que hay que cambiar, y la decide Felipe.
--
-- Solo si sigue vacía: no pisa una descripción que alguien ya haya escrito.

update public.cursos
set descripcion = 'Reggaetón bailado desde lo femenino: fuerza, actitud y cadera. Se parte de cero y se arma la coreografía entre todas, hasta que el paso deja de pensarse y sale solo.',
    updated_at = now()
where slug = 'reggaeton' and descripcion = '';

do $$
begin
  if not exists (select 1 from public.cursos where slug = 'reggaeton' and descripcion <> '') then
    raise exception 'El curso reggaeton no quedó con descripción.';
  end if;
end $$;
