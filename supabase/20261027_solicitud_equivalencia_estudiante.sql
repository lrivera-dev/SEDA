CREATE TABLE IF NOT EXISTS public.solicitud_equivalencia (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_universidad UUID NOT NULL
        REFERENCES public.universidad(id_universidad) ON DELETE RESTRICT,
    nombre_estudiante TEXT NOT NULL
        CHECK (length(btrim(nombre_estudiante)) > 0),
    codigo_institucional TEXT NOT NULL
        CHECK (length(btrim(codigo_institucional)) > 0),
    modalidad TEXT NOT NULL
        CHECK (modalidad IN ('MANUAL', 'AUTOMATICA')),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.caso_equivalencia
    ADD COLUMN IF NOT EXISTS id_solicitud UUID,
    ADD COLUMN IF NOT EXISTS porcentaje_propuesto NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS justificacion_manual TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_caso_solicitud_equivalencia'
    ) THEN
        ALTER TABLE public.caso_equivalencia
            ADD CONSTRAINT fk_caso_solicitud_equivalencia
            FOREIGN KEY (id_solicitud)
            REFERENCES public.solicitud_equivalencia(id_solicitud)
            ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_caso_porcentaje_propuesto'
    ) THEN
        ALTER TABLE public.caso_equivalencia
            ADD CONSTRAINT ck_caso_porcentaje_propuesto
            CHECK (
                porcentaje_propuesto IS NULL
                OR porcentaje_propuesto BETWEEN 0 AND 100
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_solicitud_equivalencia_universidad
    ON public.solicitud_equivalencia(id_universidad);

CREATE INDEX IF NOT EXISTS ix_caso_equivalencia_solicitud
    ON public.caso_equivalencia(id_solicitud);