
-- HU-3 RN7: límite global de 100 evaluaciones diarias.

CREATE TABLE public.control_evaluaciones_diarias (
    fecha DATE PRIMARY KEY,
    total INTEGER NOT NULL DEFAULT 0
        CHECK (total BETWEEN 0 AND 100)
);

-- Evitar el acceso directo desde usuarios del navegador.
ALTER TABLE public.control_evaluaciones_diarias
ENABLE ROW LEVEL SECURITY;

-- Reserva atómica de una evaluación.
CREATE FUNCTION public.reservar_evaluacion_diaria()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_fecha DATE;
    v_total INTEGER;
BEGIN
    v_fecha := (
        now() AT TIME ZONE 'America/El_Salvador'
    )::DATE;

    INSERT INTO public.control_evaluaciones_diarias
        AS control (fecha, total)
    VALUES (v_fecha, 1)
    ON CONFLICT (fecha)
    DO UPDATE
        SET total = control.total + 1
    WHERE control.total < 100
    RETURNING total INTO v_total;

    RETURN v_total IS NOT NULL;
END;
$$;

REVOKE ALL ON public.control_evaluaciones_diarias
FROM anon, authenticated;

REVOKE ALL ON FUNCTION
public.reservar_evaluacion_diaria()
FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.reservar_evaluacion_diaria()
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE
ON public.control_evaluaciones_diarias
TO service_role;

GRANT EXECUTE
ON FUNCTION public.reservar_evaluacion_diaria()
TO service_role;
