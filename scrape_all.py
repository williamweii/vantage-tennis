import re
import os
import sys
import asyncio

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
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 錯誤：找不到 SUPABASE_URL 或 SUPABASE_KEY，請確認 .env 設定。")
    sys.exit(1)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TIME_ONLY_RE = re.compile(r'^[\d:~\-〜\s～–—]+$')

# ==========================================
# 2. 基本設定 (優化參數)
# ==========================================
VENUES = [1060, 1042, 687, 324, 312, 305, 352, 266, 425, 239, 210, 201, 174, 341, 1013, 1006, 998, 994, 984, 968, 886, 849, 816, 767, 766, 760, 747, 635, 624, 609, 604, 489, 342, 320, 253, 117]
BASE_URL = "https://vbs.sports.taipei/venues/?K={}"
# 🚀 提升併發數，因為我們封鎖了圖片，效能大幅提升
CONCURRENCY = 4          
LOCKED_DAYS = 10         
SCRAPE_DAYS = 20         
MIN_RECORDS = 200        

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
                    
                    # 🚀 修復 2：改回 2 秒，給政府那台破舊的伺服器一點反應時間
                    await asyncio.sleep(2) 
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

                    if "RangeOut" in inner_classes or "已過期" in inner_text or "停止租借" in inner_text or "休館" in inner_text:
                        status = "已過期 停止租借"
                    elif "UnBooked" in inner_classes:
                        status = "可預約"
                    elif "Booked" in inner_classes:
                        status = "已額滿"
                    else:
                        status = "已額滿" if inner_text else "無開放"

                    prev = slot_best.get(time_slot)
                    if prev is None or STATUS_PRIORITY.get(status, 0) > STATUS_PRIORITY.get(prev, 0):
                        slot_best[time_slot] = status

                for time_slot, status in slot_best.items():
                    records.append({
                        "venue_k": k,
                        "date": target_date,
                        "time_slot": time_slot,
                        "status": status
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

            print(f"\n=====================================")
            print(f"📅 日期：{target_date}  {'🔒 鎖定期' if is_locked else '🟢 可預約期'}")
            print(f"=====================================")

            if is_locked and has_sufficient_data(target_date):
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

        await context.close()
        await browser.close()
        print("\n🎉 爬蟲執行與資料庫寫入全部完畢！")

if __name__ == '__main__':
    asyncio.run(main())
