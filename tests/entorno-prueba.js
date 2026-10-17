// Variables falsas para que las pruebas NUNCA se conecten a la base de datos real.
// Se fijan antes de cargar la aplicación; dotenv no sobrescribe variables que ya existen,
// así que ni siquiera un archivo .env local puede hacer que las pruebas lleguen a Supabase.
process.env.SUPABASE_URL = 'http://127.0.0.1:9';
process.env.SUPABASE_SECRET_KEY = 'clave-falsa-para-pruebas';
process.env.SUPABASE_ANON_KEY = 'clave-falsa-para-pruebas';