import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LINE_API = 'https://api.line.me/v2/bot';
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const SECRET = process.env.LINE_CHANNEL_SECRET!;

function verifySignature(body: string, sig: string): boolean {
  const expected = createHmac('sha256', SECRET)
    .update(body)
    .digest('base64');
  return sig === expected;
}

async function getProfile(userId: string) {
  const res = await fetch(`${LINE_API}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ userId: string; displayName: string }>;
}

async function replyMessage(replyToken: string, text: string) {
  await fetch(`${LINE_API}/message/reply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleEvent(event: any) {
  const userId: string = event.source?.userId;
  if (!userId) return;

  if (event.type === 'follow') {
    // 新用戶加好友 → 建預設偏好行
    const profile = await getProfile(userId);
    await supabase.from('user_preferences').upsert(
      {
        line_user_id: userId,
        display_name: profile?.displayName ?? null,
        districts: [],
        time_prefs: [],
        notify_enabled: true,
      },
      { onConflict: 'line_user_id' }
    );

    const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;
    await replyMessage(
      event.replyToken,
      `歡迎使用 Vantage 場地雷達！🎾\n\n點下方連結設定你的偏好地區與時段，有空位時我們會立刻通知你：\n\n👉 ${liffUrl}\n\n（只需 5 秒，完全免費）`
    );
  }

  if (event.type === 'unfollow') {
    // 封鎖/取消好友 → 停止通知
    await supabase
      .from('user_preferences')
      .update({ notify_enabled: false })
      .eq('line_user_id', userId);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('x-line-signature') ?? '';

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody);
  await Promise.all((body.events ?? []).map(handleEvent));

  return NextResponse.json({ ok: true });
}
