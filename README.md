# ChatKick Web (جاهز) — تطبيق ويب فقط + Backend واحد + Postgres + OTP Email

هذه النسخة **مركّزة للويب**:
- Backend (Node/TS/Express/Socket.IO/Prisma)
- Web (Vite + Vanilla)
- **الـ Backend يخدم الويب مباشرة** بعد البناء => نفس الدومين (بدون CORS وتعقيد)

## تشغيل محلي سريع
### قاعدة البيانات
```bash
cd backend
cp .env.example .env
docker compose up -d
```

### تشغيل Backend + Web (تطوير)
- شغّل backend:
```bash
cd backend
npm install
npm run db:push
npm run seed
npm run dev
```

- شغّل الويب:
```bash
cd apps/web
npm install
npm run dev
```

## تشغيل إنتاج محلي (Backend يخدم الويب)
```bash
cd backend
npm run build:all
npm run start
```
افتح: http://localhost:5050

## نشر أونلاين بضغطة (Render)
- ارفع الريبو على GitHub
- Render → New → Blueprint → اختر الريبو
- سيتم إنشاء Postgres + خدمة Web واحدة
- بعد النشر افتح رابط Render وستجد الويب شغال + API + Socket بنفس الرابط

## OTP
- بدون SMTP: الكود يظهر في Logs
- مع SMTP: ضع SMTP_* في Render Environment Variables
