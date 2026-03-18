import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { line_user_id, display_name, districts, time_prefs } = body;

    if (!line_user_id || !Array.isArray(districts) || !Array.isArray(time_prefs)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          line_user_id,
          display_name: display_name ?? null,
          districts,
          time_prefs,
          notify_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'line_user_id' }
      );

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Preferences API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
