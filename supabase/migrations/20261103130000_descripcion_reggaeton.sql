-- La descripción del curso `reggaeton` de Drimy (Felipe, 03/11/2026).
--
-- NO ejecutar a mano en producción: se aplica con `supabase db push`, con
-- aprobación de Felipe en ese mismo mensaje.
--
-- Quedó vacía al crear el curso (20261102120000) porque no se inventa. Parte de
-- la de `reggaeton-femme`, que son cursos muy parecidos, pero **sin "bailado
-- desde lo femenino"**: eso es justo lo que distingue el de Pau. La copia
-- literal se descartó por eso (Felipe, 03/11/2026).
--
-- Pisa solo una descripción vacía o esa copia literal descartada, que alcanzó a
-- aplicarse en staging: no una que alguien haya escrito después.

update public.cursos
set descripcion = 'Reggaetón con fuerza, actitud y cadera. Se parte de cero y se arma la coreografía entre todas, hasta que el paso deja de pensarse y sale solo.',
    updated_at = now()
where slug = 'reggaeton'
  and descripcion in (
    '',
    'Reggaetón bailado desde lo femenino: fuerza, actitud y cadera. Se parte de cero y se arma la coreografía entre todas, hasta que el paso deja de pensarse y sale solo.'
  );

do $$
begin
  if not exists (
    select 1 from public.cursos
    where slug = 'reggaeton'
      and descripcion = 'Reggaetón con fuerza, actitud y cadera. Se parte de cero y se arma la coreografía entre todas, hasta que el paso deja de pensarse y sale solo.'
  ) then
    raise exception 'El curso reggaeton no quedó con su descripción.';
  end if;
end $$;
