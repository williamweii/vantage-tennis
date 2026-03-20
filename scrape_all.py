import re
import os
import sys
import asyncio
import requests

# 👇 加入這兩行，強制 Python 支援中文 (UTF-8)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')


from datetime import date, timedelta, datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

# ==========================================
# 1. 讀取環境變數與初始化 Supabase
# ==========================================
load_dotenv(override=True)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
LINE_CHANNEL_TOKEN = os.environ.get("LINE_CHANNEL_TOKEN")
LINE_USER_ID = os.environ.get("LINE_USER_ID")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 錯誤：找不到 SUPABASE_URL 或 SUPABASE_KEY，請確認 .env 設定。")
    sys.exit(1)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 地區群組 → 實際 district 列
DISTRICT_MAP: dict[str, list[str]] = {
    "north":   ["士林區", "大同區", "中山區", "北投區"],
    "central": ["中正區", "萬華區"],
    "east":    ["松山區", "內湖區"],
}

# 時段群組 → 小時範圍
TIME_MAP: dict[str, tuple[int, int]] = {
    "weekday_evening":    (18, 22),
    "weekend_morning":    (8,  12),
    "weekend_afternoon":  (12, 21),
    "all":                (0,  24),
}

def push_line_message(user_id: str, text: str):
    if not LINE_CHANNEL_TOKEN:
        print("⚠️ 找不到 LINE_CHANNEL_TOKEN，跳過推播。")
        return
    url = "https://api.line.me/v2/bot/message/push"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {LINE_CHANNEL_TOKEN}"}
    data = {"to": user_id, "messages": [{"type": "text", "text": text}]}
    r = requests.post(url, headers=headers, json=data)
    if r.status_code != 200:
        print(f"⚠️ LINE push 失敗 ({user_id}): {r.text}")

TIME_ONLY_RE = re.compile(r'^[\d:~\-〜\s～–—]+$')

# ==========================================
# 2. 基本設定 (優化參數)
# ==========================================
# 只保留支援線上預約的場地（未開放租借＆練習壁改為前端靜態卡）
VENUES = [
    1060, 1042,       # 士林 - 百齡河濱
    324,              # 大同 - 延平河濱
    341, 687,         # 中山 - 大佳河濱、觀山河濱
    201,              # 松山 - 彩虹河濱
    266, 305, 352,    # 中正 - 中正河濱、古亭河濱、溪洲
    239, 425, 210,    # 萬華 - 華中河濱、道南4-6、雙園
    312,              # 內湖 - 成美右岸
    174,              # 北投 - 美堤河濱
]
BASE_URL = "https://vbs.sports.taipei/venues/?K={}"
CONCURRENCY = 8    # 由 4 提升，圖片/樣式已封鎖所以安全
LOCKED_DAYS = 10
SCRAPE_DAYS = 20
MIN_RECORDS = 200

# 🎾 場地名稱字典
VENUE_NAMES = {
    117:  "青年公園運動園區網球練習壁",
    174:  "美堤河濱公園網球場",
    201:  "彩虹河濱公園網球場",
    210:  "雙園河濱公園網球場",
    239:  "華中河濱公園網球場",
    253:  "道南河濱公園網球場1-2",
    266:  "中正河濱公園中正網球場",
    305:  "古亭河濱公園網球場",
    312:  "成美右岸河濱公園網球場",
    320:  "民權公園網球場",
    324:  "延平河濱公園網球場",
    341:  "大佳河濱運動公園網球場",
    342:  "天母運動場區網球場",
    352:  "溪洲(福和)河濱公園網球場",
    425:  "道南河濱公園網球場4-6",
    489:  "景美河濱公園網球場",
    604:  "碧湖公園網球場",
    609:  "南港公園網球場",
    624:  "玉成公園網球場",
    635:  "中研公園網球場",
    687:  "觀山河濱公園網球場",
    747:  "道南河濱公園3號網球場",
    760:  "煙波庭公園網球場",
    766:  "石潭公園網球場",
    767:  "瑞湖公園網球場",
    816:  "天壽公園網球場",
    849:  "萬有2號公園網球場",
    886:  "臺北網球場",
    968:  "天溪綠地游泳池網球場",
    984:  "觀海公園網球場",
    994:  "大豐公園網球場",
    998:  "復興公園網球場",
    1006: "榮華公園網球場",
    1013: "蘭興公園網球場",
    1042: "百齡河濱公園(社子岸)網球場",
    1060: "百齡河濱公園(社子岸)網球場A",
}

# 🎾 場地 → 行政區字典
VENUE_DISTRICT_MAP: dict[int, str] = {
    1060: "士林區",
    1042: "士林區",
    324:  "大同區",
    341:  "中山區",
    687:  "中山區",
    201:  "松山區",
    266:  "中正區",
    305:  "中正區",
    352:  "中正區",
    239:  "萬華區",
    425:  "萬華區",
    210:  "萬華區",
    312:  "內湖區",
    174:  "北投區",
}

# ==========================================
# 3. 檢查 Supabase
# ==========================================
def has_sufficient_data(target_date: str) -> bool:
    try:
        result = supabase.table('court_availability') \
            .select('id', count='exact') \
            .eq('date', target_date) \
            .execute()
        count = result.count if hasattr(result, 'count') else len(result.data)
        return count >= MIN_RECORDS
    except Exception as e:
        print(f"    ⚠️ 查詢 Supabase 失敗：{e}")
        return False

# ==========================================
# 4. 核心爬蟲邏輯 (穩定與速度平衡版)
# ==========================================
async def scrape_single_venue(k: int, target_date: str, context, sem: asyncio.Semaphore):
    MAX_RETRIES = 2 
    
    for attempt in range(1, MAX_RETRIES + 1):
        async with sem:
            page = await context.new_page()
            
            # 保留：攔截圖片和樣式表，保持乾淨
            await page.route("**/*", lambda route: route.abort() 
                if route.request.resource_type in ["image", "stylesheet", "font", "media"] 
                else route.continue_()
            )

            records = []
            try:
                label = f" [重試#{attempt}]" if attempt > 1 else ""
                print(f"  🔍 [開始] 檢查場地 K={k} ({target_date}){label}...")
                
                # 🚀 修復 1：改回 networkidle，確保底層 JS 完全載入
                await page.goto(BASE_URL.format(k), timeout=30000, wait_until="networkidle")

                date_input = page.locator('#DatePickupInput')
                if await date_input.count() > 0:
                    await date_input.evaluate(
                        f"(el) => {{ el.value = '{target_date}'; el.dispatchEvent(new Event('change', {{ bubbles: true }})); }}"
                    )
                    await date_input.press("Enter")
                    await asyncio.sleep(1)  # 從 2s 降到 1s，搭配更高 concurrency 
                    await page.evaluate(
                        "() => { if(typeof QueryCourts === 'function') QueryCourts(); else if(typeof getSchedule === 'function') getSchedule(); }"
                    )

                # 🚀 修復 3：等待時間拉長到 15 秒，並強制印出超時警告！
                try:
                    await page.wait_for_selector('.DTableView table, #PickupDateInterFaceBox table', timeout=15000)
                except PlaywrightTimeoutError:
                    print(f"    ⚠️ [查無表格/超時] K={k} ({target_date})，放棄抓取，可能該日無開放。")
                    return []

                # --- 下面是原本完美的 BeautifulSoup 解析邏輯，一字不漏保留 ---
                html = await page.content()
                soup = BeautifulSoup(html, 'html.parser')

                container = soup.select_one('.DTableView') or soup.select_one('#PickupDateInterFaceBox')
                if not container:
                    return []

                tdr_cells = container.find_all('td', class_='TdR')
                dt = datetime.strptime(target_date, "%Y-%m-%d")

                STATUS_PRIORITY = {"可預約": 4, "已過期 停止租借": 3, "已額滿": 2, "無開放": 1}
                slot_best: dict = {}

                for tdr in tdr_cells:
                    cell_id = tdr.get('id', '')
                    if not cell_id.startswith('DataPickup.'):
                        continue

                    parts = cell_id.split('.')
                    if len(parts) < 5:
                        continue

                    try:
                        cell_year, cell_month, cell_day, hour = int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4])
                    except (ValueError, IndexError):
                        continue

                    if cell_year != dt.year or cell_month != dt.month or cell_day != dt.day:
                        continue

                    time_slot = f"{hour:02d}:00-{(hour + 1) % 24:02d}:00"

                    inner_div = tdr.select_one("div[id^='Sched.']")
                    if not inner_div:
                        continue

                    inner_classes = set(inner_div.get("class") or [])
                    inner_text = inner_div.get_text(separator=" ", strip=True)

                    # ⚠️ 純 class 判定：完全不信任 inner_text 來判斷「可預約」
                    # 政府網站會把預約者名字/時間塞在 inner_text，導致誤判
                    if "RangeOut" in inner_classes:
                        status = "已過期 停止租借"
                    elif "UnBooked" in inner_classes and "Booked" not in inner_classes:
                        # 只有確認有 UnBooked class 且沒有 Booked class 才是真空位
                        status = "可預約"
                    elif "Booked" in inner_classes or inner_text:
                        # Booked class，或有任何文字內容（人名、時間等）都算已額滿
                        status = "已額滿"
                    else:
                        status = "無開放"

                    prev = slot_best.get(time_slot)
                    if prev is None or STATUS_PRIORITY.get(status, 0) > STATUS_PRIORITY.get(prev, 0):
                        slot_best[time_slot] = status

                all_raw_statuses = set()
                for tdr in container.find_all('td', class_='TdR'):
                    inner_div = tdr.select_one("div[id^='Sched.']")
                    if inner_div:
                        all_raw_statuses.add(inner_div.get_text(separator=" ", strip=True) or repr(set(inner_div.get('class') or [])))
                print(f"🚨 K={k} 系統抓到的所有原始狀態種類：{all_raw_statuses}")

                for time_slot, status in slot_best.items():
                    records.append({
                        "venue_k": k,
                        "date": target_date,
                        "time_slot": time_slot,
                        "status": status,
                        "district": VENUE_DISTRICT_MAP.get(k, "")
                    })

                return records

            except Exception as e:
                err_msg = str(e)[:100]
                print(f"    ❌ [異常] K={k} 第{attempt}次: {err_msg}")
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(2)
            finally:
                try:
                    await page.close()
                except Exception:
                    pass

    return []

# ==========================================
# 5. 主控台
# ==========================================
async def main():
    today = date.today()

    if len(sys.argv) > 1:
        try:
            target_dates = [datetime.strptime(sys.argv[1], "%Y-%m-%d").date().isoformat()]
            print(f"🎯 指定日期模式：只跑 {target_dates[0]}")
        except ValueError:
            print("❌ 日期格式錯誤，請用 YYYY-MM-DD")
            sys.exit(1)
    else:
        target_dates = [(today + timedelta(days=d)).isoformat() for d in range(1, SCRAPE_DAYS + 1)]
        print(f"🚀 開始執行臺北市網球場爬蟲（未來 {SCRAPE_DAYS} 天）...")

    # 準備一個空陣列，用來收集今天爬到的所有「可預約」時段
    available_slots_found = []

    sem = asyncio.Semaphore(CONCURRENCY)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
        )

        for i, target_date in enumerate(target_dates):
            days_ahead = i + 1
            is_locked = days_ahead <= LOCKED_DAYS
            # 邊界日（第 LOCKED_DAYS 天）昨天是可預約期，今天剛鎖定
            # 這段時間可能有人剛預約，必須強制重爬以保持準確
            is_boundary_day = days_ahead == LOCKED_DAYS

            print(f"\n=====================================")
            print(f"📅 日期：{target_date}  {'🔒 鎖定期（邊界，強制重爬）' if is_boundary_day else '🔒 鎖定期' if is_locked else '🟢 可預約期'}")
            print(f"=====================================")

            if is_locked and not is_boundary_day and has_sufficient_data(target_date):
                print(f"  ⏭️  已有完整資料，跳過此日期。")
                continue

            tasks = [scrape_single_venue(k, target_date, context, sem) for k in VENUES]
            results_nested = await asyncio.gather(*tasks)
            all_records = [r for sublist in results_nested for r in sublist]

            PRIORITY = {"可預約": 4, "已額滿": 3, "已過期 停止租借": 2, "無開放": 1}
            aggregated: dict = {}
            for r in all_records:
                if not isinstance(r, dict):
                    continue
                key = (r.get("venue_k"), r.get("date"), r.get("time_slot"))
                st = r.get("status", "未知")
                if key not in aggregated or PRIORITY.get(st, 0) > PRIORITY.get(aggregated[key], 0):
                    aggregated[key] = st

            clean_records = [
                {"venue_k": vk, "date": d, "time_slot": ts, "status": st}
                for (vk, d, ts), st in aggregated.items()
            ]

            if clean_records:
                try:
                    supabase.table('court_availability').upsert(
                        clean_records,
                        on_conflict='venue_k,date,time_slot'
                    ).execute()
                    print(f"✅ 日期 {target_date} 成功寫入 {len(clean_records)} 筆。")
                except Exception as e:
                    print(f"❌ 寫入 Supabase 失敗：{e}")
            else:
                print(f"⚠️ 日期 {target_date} 無可用資料。")
                continue

            # 🎯 收集可預約空位（補 district）
            for r in clean_records:
                if r['status'] == '可預約':
                    if 'district' not in r:
                        r['district'] = VENUE_DISTRICT_MAP.get(r['venue_k'], "")
                    available_slots_found.append(r)

        await context.close()
        await browser.close()
        print("\n🎉 爬蟲執行與資料庫寫入全部完畢！")

    # ==========================================
    # 6. 爬蟲結束後，結算並發送 LINE 通知
    # 策略：只報告「剛進可預約窗口」的 11-14 天
    #       因為 1-10 天無法線上預約，15-20 天都是空的不稀奇
    # ==========================================
    today = date.today()
    # 「剛開放」的窗口：第 11~14 天（依照 LOCKED_DAYS 計算）
    window_start = LOCKED_DAYS + 1
    window_end   = LOCKED_DAYS + 4
    window_dates = {
        (today + timedelta(days=d)).isoformat()
        for d in range(window_start, window_end + 1)
    }

    # 只取窗口內的可預約空位
    hot_slots = [r for r in available_slots_found if r['date'] in window_dates]

    # 如果窗口內沒空位，fallback 到全部可預約中最早的日期
    if not hot_slots and available_slots_found:
        earliest_date = min(r['date'] for r in available_slots_found)
        hot_slots = [r for r in available_slots_found if r['date'] == earliest_date]

    # ==========================================
    # 7. 個人化推播：按用戶偏好篩選空位
    # ==========================================
    from collections import defaultdict

    def get_slot_hour(ts: str) -> int:
        try: return int(ts.split(':')[0])
        except: return -1

    def build_push_msg(user_slots: list) -> str:
        grouped: dict = defaultdict(list)
        for r in user_slots:
            grouped[(r['venue_k'], r['date'])].append(r['time_slot'])
        sorted_groups = sorted(grouped.items(), key=lambda x: (x[0][1], x[0][0]))
        is_window = user_slots[0]['date'] in window_dates
        msg = "🎾 Vantage 空位快報\n"
        msg += f"（第 {window_start}~{window_end} 天剛開放預約）\n\n" if is_window \
               else f"（最早可約：{user_slots[0]['date']}）\n\n"
        for (vk, d), slots in sorted_groups[:8]:
            v_name = VENUE_NAMES.get(vk, f"K={vk}")
            times  = "  ".join(s[:5] for s in sorted(slots))
            msg += f"📍 {v_name}\n📅 {d}｜{times}\n\n"
        if len(sorted_groups) > 8:
            msg += f"… 共 {len(user_slots)} 個時段\n\n"
        msg += "👉 https://vantage-tennis.vercel.app"
        return msg

    # 從 Supabase 取出所有啟用通知的用戶
    users_res = supabase.table('user_preferences') \
        .select('line_user_id, districts, time_prefs') \
        .eq('notify_enabled', True) \
        .execute()
    users = users_res.data or []

    if not users:
        # 還沒有用戶：用舊的單一推播備用（開發測試期）
        if hot_slots and LINE_USER_ID:
            push_line_message(LINE_USER_ID, build_push_msg(hot_slots))
            print(f"📱 [單代模式] 已發送 LINE 通知（{len(hot_slots)} 個近期空位）！")
    else:
        push_count = 0
        for user in users:
            uid     = user['line_user_id']
            dgroups = user.get('districts') or []
            tprefs  = user.get('time_prefs') or []

            allowed_districts = [d for g in dgroups for d in DISTRICT_MAP.get(g, [])] if dgroups else []
            time_ranges = [TIME_MAP.get(tp, (0, 24)) for tp in tprefs] if tprefs else [(0, 24)]

            def slot_matches(r, ad=allowed_districts, tr=time_ranges):
                if ad and r.get('district') not in ad:
                    return False
                h = get_slot_hour(r['time_slot'])
                return any(lo <= h < hi for lo, hi in tr)

            user_slots = [r for r in hot_slots if slot_matches(r)]
            if not user_slots:
                continue
            push_line_message(uid, build_push_msg(user_slots))
            push_count += 1

        print(f"📱 已對 {push_count} 位用戶發送個人化推播。")

    # ==========================================
    # 8. 上帝模式測試推播（無條件執行）
    # ==========================================
    print("🚨 準備執行上帝模式測試推播...")
    test_msg = "🚨 上帝模式測試：系統執行完畢！若您收到此訊息，代表 LINE API 通道完全正常。"
    target_id = users[0]['line_user_id'] if users else LINE_USER_ID
    if target_id:
        push_line_message(target_id, test_msg)
        print("✅ 上帝模式測試推播發送成功！")
    else:
        print("⚠️ 找不到目標 LINE ID 可發送上帝模式測試。")

if __name__ == '__main__':
    asyncio.run(main())
