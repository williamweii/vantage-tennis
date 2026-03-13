import re
import os
import sys
import asyncio
from datetime import date, timedelta, datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

# ==========================================
# 1. 讀取環境變數與初始化 Supabase
# ==========================================
load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 錯誤：找不到 SUPABASE_URL 或 SUPABASE_KEY，請確認 .env 設定。")
    sys.exit(1)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# 可預約的单格只顯示時間（如 "08:00" 或 "8:00 ~ 9:00"）而非活動名稱
# 注：\d 涵蓋所有全形數字，所以不用额外處理 unicode
TIME_ONLY_RE = re.compile(r'^[\d:~\-〜\s～–—]+$')
# 2. 基本設定
# ==========================================
VENUES = [1060, 1042, 687, 324, 312, 305, 352, 266, 239, 201, 341, 1013, 1006, 998, 994, 984, 968, 886, 849, 767, 635, 624, 604, 320, 253]
BASE_URL = "https://vbs.sports.taipei/venues/?K={}"
CONCURRENCY = 2          # 同時最多 2 個無頭瀏覽器
LOCKED_DAYS = 10         # 近 N 天為鎖定期（不可網路預約）
SCRAPE_DAYS = 20         # 往後抓幾天
MIN_RECORDS = 200        # 判斷「已有完整資料」的最低筆數門檻

# ==========================================
# 3. 檢查 Supabase 某日期是否已有足夠資料
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
# 4. 核心爬蟲邏輯 (單一場地 + 單一日期)，支援自動重試
# ==========================================
async def scrape_single_venue(k: int, target_date: str, context, sem: asyncio.Semaphore):
    MAX_RETRIES = 3
    for attempt in range(1, MAX_RETRIES + 1):
        page = await context.new_page()
        records = []
        try:
            async with sem:
                label = f" [重試#{attempt}]" if attempt > 1 else ""
                print(f"  🔍 [開始] 檢查場地 K={k} ({target_date}){label}...")
                await page.goto(BASE_URL.format(k), timeout=30000, wait_until="networkidle")

                # 1. 填入日期並觸發查詢
                date_input = page.locator('#DatePickupInput')
                if await date_input.count() > 0:
                    await date_input.evaluate(
                        f"(el) => {{ el.value = '{target_date}'; el.dispatchEvent(new Event('change', {{ bubbles: true }})); }}"
                    )
                    await date_input.press("Enter")
                    await asyncio.sleep(2)
                    await page.evaluate(
                        "() => { if(typeof QueryCourts === 'function') QueryCourts(); else if(typeof getSchedule === 'function') getSchedule(); }"
                    )

                try:
                    await page.wait_for_selector('.DTableView table, #PickupDateInterFaceBox table', timeout=10000)
                except PlaywrightTimeoutError:
                    return []

                await asyncio.sleep(1.5)

                # 2. BeautifulSoup 解析
                html = await page.content()
                soup = BeautifulSoup(html, 'html.parser')

                container = soup.select_one('.DTableView') or soup.select_one('#PickupDateInterFaceBox')
                if not container:
                    return []

                tdr_cells = container.find_all('td', class_='TdR')
                dt = datetime.strptime(target_date, "%Y-%m-%d")

                # ======================================================
                # 狀態判定 — 使用內部 Sched.* div 的 class（從 HTML 驗證）：
                #   UnBooked  → 可預約（顯示時間如 "08:00 ~ 09:00"）
                #   Booked    → 已額滿（顯示活動名稱）
                #   RangeOut  → 已過期 停止租借
                #   &nbsp; (無 Sched div) → T2 空格，跳過
                # 多球場同時段（T1/T2）保留最優先狀態
                # ======================================================
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
                        cell_year = int(parts[1])
                        cell_month = int(parts[2])
                        cell_day = int(parts[3])
                        hour = int(parts[4])
                    except (ValueError, IndexError):
                        continue

                    if cell_year != dt.year or cell_month != dt.month or cell_day != dt.day:
                        continue

                    time_slot = f"{hour:02d}:00-{(hour + 1) % 24:02d}:00"

                    # 取內部 Sched.* div；空格（&nbsp;）沒有此 div，跳過
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

                return records  # 成功



        except Exception as e:
            err_msg = str(e)[:100]
            print(f"    ❌ [異常] K={k} 第{attempt}次 ({type(e).__name__}): {err_msg}")
            if attempt < MAX_RETRIES:
                wait = 5 * attempt
                print(f"    ⏳ 等待 {wait}s 後重試...")
                await asyncio.sleep(wait)
        finally:
            try:
                await page.close()
            except Exception:
                pass

    print(f"    💀 K={k} 所有重試均失敗，跳過。")
    return []

# ==========================================
# 5. 主控台：支援指定日期或預設跑未來 20 天
# ==========================================
async def main():
    today = date.today()

    # CLI 指定日期模式：python scrape_all.py 2026-03-17
    if len(sys.argv) > 1:
        try:
            target_dates = [datetime.strptime(sys.argv[1], "%Y-%m-%d").date().isoformat()]
            print(f"🎯 指定日期模式：只跑 {target_dates[0]}")
        except ValueError:
            print("❌ 日期格式錯誤，請用 YYYY-MM-DD，例如：python scrape_all.py 2026-03-17")
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

            # 鎖定期 + 已有足夠資料 → skip
            if is_locked and has_sufficient_data(target_date):
                print(f"  ⏭️  已有完整資料，跳過此日期。")
                continue

            tasks = [scrape_single_venue(k, target_date, context, sem) for k in VENUES]
            results_nested = await asyncio.gather(*tasks)
            all_records = [r for sublist in results_nested for r in sublist]

            # 去重複 + 狀態優先級聚合
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
                    print(f"✅ 日期 {target_date} 成功 Upsert {len(clean_records)} 筆時段至 Supabase。")
                except Exception as e:
                    print(f"❌ 寫入 Supabase 失敗：{e}")
            else:
                print(f"⚠️ 日期 {target_date} 無任何可用資料。")

            # 日期間冷卻
            if target_date != target_dates[-1]:
                await asyncio.sleep(3)

        await context.close()
        await browser.close()
        print("\n🎉 爬蟲執行與資料庫寫入全部完畢！")

if __name__ == '__main__':
    asyncio.run(main())