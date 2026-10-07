from supabase import create_client, Client
from apps.api.app.core.config import settings

# Client service_role (backend) — contourne les policies RLS
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)

# Client anon (lecture publique — respecte RLS)
supabase_anon: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY,
)