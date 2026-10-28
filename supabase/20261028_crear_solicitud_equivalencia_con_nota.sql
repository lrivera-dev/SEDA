-- La descripción anterior deja de ser obligatoria:
-- en la modalidad automática no se solicitará una justificación manual.
ALTER TABLE public.caso_equivalencia
    ALTER COLUMN descripcion DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.crear_solicitud_equivalencia(
    p_id_universidad UUID,
    p_nombre_estudiante TEXT,
    p_codigo_institucional TEXT,
    p_modalidad TEXT,
    p_equivalencias JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_id_solicitud UUID;
    v_item JSONB;
    v_id_materia_origen UUID;
    v_id_materia_destino UUID;
    v_porcentaje NUMERIC(5,2);
    v_justificacion TEXT;
    v_nota_obtenida NUMERIC(6,2);
    v_nota_maxima NUMERIC(6,2);
    v_id_caso UUID;
    v_ids_caso UUID[] := ARRAY[]::UUID[];
    v_id_universidad_origen UUID;
    v_programa_origen TEXT;
    v_pensum_origen TEXT;
    v_programa_destino TEXT;
    v_pensum_destino TEXT;
BEGIN
    IF p_id_universidad IS NULL
        OR coalesce(btrim(p_nombre_estudiante), '') = ''
        OR coalesce(btrim(p_codigo_institucional), '') = '' THEN
        RAISE EXCEPTION 'DATOS_ESTUDIANTE_INVALIDOS';
    END IF;

    IF p_modalidad NOT IN ('MANUAL', 'AUTOMATICA') THEN
        RAISE EXCEPTION 'MODALIDAD_INVALIDA';
    END IF;

    IF jsonb_typeof(p_equivalencias) <> 'array'
        OR jsonb_array_length(p_equivalencias) = 0 THEN
        RAISE EXCEPTION 'SIN_EQUIVALENCIAS';
    END IF;

    INSERT INTO public.solicitud_equivalencia (
        id_universidad,
        nombre_estudiante,
        codigo_institucional,
        modalidad
    )
    VALUES (
        p_id_universidad,
        btrim(p_nombre_estudiante),
        btrim(p_codigo_institucional),
        p_modalidad
    )
    RETURNING id_solicitud INTO v_id_solicitud;

    FOR v_item IN
        SELECT elemento
        FROM jsonb_array_elements(p_equivalencias) AS items(elemento)
    LOOP
        v_id_materia_origen :=
            nullif(v_item->>'id_materia_origen', '')::UUID;
        v_id_materia_destino :=
            nullif(v_item->>'id_materia_destino', '')::UUID;

        IF v_id_materia_origen IS NULL OR v_id_materia_destino IS NULL THEN
            RAISE EXCEPTION 'MATERIAS_INVALIDAS';
        END IF;

        IF v_id_materia_origen = v_id_materia_destino THEN
            RAISE EXCEPTION 'MATERIAS_IGUALES';
        END IF;

        SELECT
            carrera.id_universidad,
            materia.programa_url,
            carrera.pensum_url
        INTO
            v_id_universidad_origen,
            v_programa_origen,
            v_pensum_origen
        FROM public.materia AS materia
        JOIN public.carrera AS carrera
            ON carrera.id_carrera = materia.id_carrera
        WHERE materia.id_materia = v_id_materia_origen;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'MATERIA_ORIGEN_NO_EXISTE';
        END IF;

        IF v_id_universidad_origen <> p_id_universidad THEN
            RAISE EXCEPTION 'MATERIA_ORIGEN_AJENA';
        END IF;

        SELECT
            materia.programa_url,
            carrera.pensum_url
        INTO
            v_programa_destino,
            v_pensum_destino
        FROM public.materia AS materia
        JOIN public.carrera AS carrera
            ON carrera.id_carrera = materia.id_carrera
        WHERE materia.id_materia = v_id_materia_destino;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'MATERIA_DESTINO_NO_EXISTE';
        END IF;

        IF coalesce(btrim(v_programa_origen), '') = ''
            OR coalesce(btrim(v_pensum_origen), '') = ''
            OR coalesce(btrim(v_programa_destino), '') = ''
            OR coalesce(btrim(v_pensum_destino), '') = '' THEN
            RAISE EXCEPTION 'DOCUMENTOS_INCOMPLETOS';
        END IF;

        v_porcentaje :=
            nullif(v_item->>'porcentaje_propuesto', '')::NUMERIC;
        v_justificacion :=
            nullif(btrim(v_item->>'justificacion_manual'), '');
        v_nota_obtenida :=
            nullif(v_item->>'nota_obtenida', '')::NUMERIC;
        v_nota_maxima :=
            nullif(v_item->>'nota_maxima', '')::NUMERIC;

        IF v_nota_obtenida IS NULL
            OR v_nota_maxima IS NULL
            OR v_nota_obtenida < 0
            OR v_nota_maxima <= 0
            OR v_nota_obtenida > v_nota_maxima THEN
            RAISE EXCEPTION 'NOTA_ESTUDIANTE_INVALIDA';
        END IF;

        IF p_modalidad = 'MANUAL' THEN
            IF v_porcentaje IS NULL
                OR v_porcentaje < 0
                OR v_porcentaje > 100
                OR v_justificacion IS NULL
                OR length(v_justificacion) > 500 THEN
                RAISE EXCEPTION 'DATOS_MANUALES_INVALIDOS';
            END IF;
        ELSE
            IF v_porcentaje IS NOT NULL OR v_justificacion IS NOT NULL THEN
                RAISE EXCEPTION 'DATOS_MANUALES_NO_PERMITIDOS';
            END IF;
        END IF;

        INSERT INTO public.caso_equivalencia (
            id_materia_origen,
            id_materia_destino,
            id_solicitud,
            nota_obtenida,
            nota_maxima,
            descripcion,
            porcentaje_propuesto,
            justificacion_manual,
            estado,
            estado_calculo
        )
        VALUES (
            v_id_materia_origen,
            v_id_materia_destino,
            v_id_solicitud,
            v_nota_obtenida,
            v_nota_maxima,
            NULL,
            CASE WHEN p_modalidad = 'MANUAL' THEN v_porcentaje ELSE NULL END,
            CASE WHEN p_modalidad = 'MANUAL' THEN v_justificacion ELSE NULL END,
            'PENDIENTE',
            CASE
                WHEN p_modalidad = 'MANUAL' THEN 'NO_APLICA'
                ELSE 'SIN_CALCULAR'
            END
        )
        RETURNING id_caso INTO v_id_caso;

        v_ids_caso := array_append(v_ids_caso, v_id_caso);
    END LOOP;

    RETURN jsonb_build_object(
        'id_solicitud', v_id_solicitud,
        'ids_caso', to_jsonb(v_ids_caso)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.crear_solicitud_equivalencia(
    UUID, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.crear_solicitud_equivalencia(
    UUID, TEXT, TEXT, TEXT, JSONB
) TO service_role;