# 8-Ball Lottery V6

የ100 ቁጥር እጣ ስርዓት፦
- 1–100
- አንድ ቁጥር = 100 ETB
- 1ኛ = 7,000 ETB
- 2ኛ = 1,000 ETB
- 3ኛ = 500 ETB
- አዘጋጅ = 1,500 ETB

V6 ዋና ማሻሻያ:
- DATABASE_URL ከመጠቀም በፊት PostgreSQL URI መሆኑን ይፈትሻል።
- በ`base` ያለ የተሳሳተ hostname ካለ በRender Logs ላይ ግልጽ CONFIG_ERROR ያሳያል።
- `/api/health` የdatabase connection ሁኔታን ይፈትሻል።
- Concurrent ticket reservation በPostgreSQL primary key/ON CONFLICT ይጠበቃል።
- Draw በPostgreSQL advisory lock ይጠበቃል።

Render:
Build Command: npm install
Start Command: npm start

Environment:
DATABASE_URL = Supabase Session Pooler URI
JWT_SECRET = የግል ረጅም secret
ADMIN_PIN = የግል PIN
DATABASE_SSL = true

ማስታወሻ:
`DATABASE_URL` ውስጥ የSupabase የተሰጠውን ሙሉ URI ብቻ ይጠቀሙ።
