ALTER TABLE public.caso_equivalencia
    DROP CONSTRAINT IF EXISTS ck_caso_estado_calculo;

ALTER TABLE public.caso_equivalencia
    ADD CONSTRAINT ck_caso_estado_calculo
    CHECK (
        estado_calculo IN (
            'SIN_CALCULAR',
            'EN_CALCULO',
            'CALCULADO',
            'ERROR',
            'NO_APLICA'
        )
    );