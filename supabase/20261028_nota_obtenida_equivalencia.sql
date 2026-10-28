ALTER TABLE public.caso_equivalencia
    ADD COLUMN IF NOT EXISTS nota_obtenida NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS nota_maxima NUMERIC(6,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_caso_nota_obtenida'
          AND conrelid = 'public.caso_equivalencia'::regclass
    ) THEN
        ALTER TABLE public.caso_equivalencia
            ADD CONSTRAINT ck_caso_nota_obtenida
            CHECK (
                (nota_obtenida IS NULL AND nota_maxima IS NULL)
                OR (
                    nota_obtenida IS NOT NULL
                    AND nota_maxima IS NOT NULL
                    AND nota_obtenida >= 0
                    AND nota_maxima > 0
                    AND nota_obtenida <= nota_maxima
                )
            );
    END IF;
END $$;