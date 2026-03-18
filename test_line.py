import os
import requests
from dotenv import load_dotenv

load_dotenv(override=True)
token = os.environ.get("LINE_CHANNEL_TOKEN")
user_id = os.environ.get("LINE_USER_ID")

def send_line_message(text):
    if not token or not user_id:
        print("❌ 找不到 LINE_CHANNEL_TOKEN 或 LINE_USER_ID，請檢查 .env！")
        return

    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    # Messaging API 的資料格式
    data = {
        "to": user_id,
        "messages": [
            {
                "type": "text",
                "text": text
            }
        ]
    }

    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 200:
        print("✅ 官方帳號訊息發送成功！快去看手機！")
    else:
        print(f"❌ 發送失敗：{response.status_code}", response.text)

if __name__ == "__main__":
    test_msg = "🎾 Vantage 系統報告：\n你的專屬【官方帳號狙擊手】已成功升級並上線！"
    send_line_message(test_msg)