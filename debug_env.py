import os
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

print("👉 URL 真實內容：", repr(url))
print("👉 KEY 真實內容：", repr(key))